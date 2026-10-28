import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GeminiService } from '../ai/gemini.service';
import {
  CrossBookQueryDto,
  CrossBookRagResponse,
  GroupedPerspective,
  RelevantChunk,
} from './dto/cross-book-query.dto';

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly geminiService: GeminiService
  ) {}

  /**
   * Execute Cross-Book Knowledge Graph RAG
   * Retrieves relevant chunks across different books and authors,
   * clusters their perspectives, and synthesizes an analytical answer.
   */
  async queryCrossBook(dto: CrossBookQueryDto): Promise<CrossBookRagResponse> {
    const { query, userId, bookIds, limit = 8, minSimilarity = 0.45 } = dto;
    this.logger.log(`[Cross-Book RAG] Processing query: "${query}" (Limit: ${limit})...`);

    // 1. Generate 768-D Vector Embedding for the search query
    const queryEmbedding = await this.geminiService.generateEmbedding(query);
    const vectorString = `[${queryEmbedding.join(',')}]`;

    // 2. Query pgvector across chapters and books with tenant and book filtering
    let filterClause = '';
    const queryParams: any[] = [vectorString, limit];
    let paramIndex = 3;

    if (userId) {
      filterClause += ` AND (b."userId" = $${paramIndex} OR b."userId" IS NULL)`;
      queryParams.push(userId);
      paramIndex++;
    }

    if (bookIds && bookIds.length > 0) {
      filterClause += ` AND b.id = ANY($${paramIndex}::text[])`;
      queryParams.push(bookIds);
      paramIndex++;
    }

    const rawSql = `
      SELECT 
        ce.id AS "embeddingId",
        ce."chunkText",
        c."chapterNumber",
        c.title AS "chapterTitle",
        b.id AS "bookId",
        b.title AS "bookTitle",
        COALESCE(b.author, 'Unknown Author') AS author,
        1 - (ce.embedding <=> $1::vector) AS similarity
      FROM chapter_embeddings ce
      JOIN chapters c ON c.id = ce."chapterId"
      JOIN books b ON b.id = c."bookId"
      WHERE 1=1 ${filterClause}
      ORDER BY ce.embedding <=> $1::vector ASC
      LIMIT $2;
    `;

    const rawResults: any[] = await this.prisma.$queryRawUnsafe(rawSql, ...queryParams);

    // 3. Filter by similarity threshold
    const relevantChunks: RelevantChunk[] = rawResults
      .map((row) => ({
        embeddingId: row.embeddingId,
        chunkText: row.chunkText,
        similarity: parseFloat(parseFloat(row.similarity).toFixed(4)),
        chapterNumber: row.chapterNumber,
        chapterTitle: row.chapterTitle,
        bookId: row.bookId,
        bookTitle: row.bookTitle,
        author: row.author,
      }))
      .filter((row) => row.similarity >= minSimilarity);

    if (relevantChunks.length === 0) {
      return {
        query,
        synthesizedAnswer:
          'Hệ thống không tìm thấy tri thức đủ độ tương đồng trong kho sách của bạn để trả lời câu hỏi này. Bạn hãy thử mở rộng phạm vi tìm kiếm hoặc tải thêm sách vào thư viện.',
        perspectivesCount: { books: 0, authors: 0, chunks: 0 },
        perspectives: [],
        citations: [],
      };
    }

    // 4. Cluster perspectives by Book and Author
    const perspectiveMap = new Map<string, GroupedPerspective>();
    const uniqueAuthors = new Set<string>();

    for (const chunk of relevantChunks) {
      uniqueAuthors.add(chunk.author);
      if (!perspectiveMap.has(chunk.bookId)) {
        perspectiveMap.set(chunk.bookId, {
          bookId: chunk.bookId,
          bookTitle: chunk.bookTitle,
          author: chunk.author,
          relevantExcerpts: [chunk.chunkText],
        });
      } else {
        perspectiveMap.get(chunk.bookId)!.relevantExcerpts.push(chunk.chunkText);
      }
    }

    const perspectives = Array.from(perspectiveMap.values());

    // 5. Build Multi-Perspective Synthesis Prompt
    const contextPrompt = perspectives
      .map(
        (p, idx) =>
          `[Nguồn ${idx + 1}] Sách: "${p.bookTitle}" — Tác giả: ${p.author}\nTrích đoạn liên quan:\n${p.relevantExcerpts.map((e) => `- ${e}`).join('\n')}`
      )
      .join('\n\n---\n\n');

    const systemInstruction = `Bạn là "AuraMind Senior Cognitive Synthesizer" - Chuyên gia tổng hợp và đối chiếu tri thức liên văn bản từ nhiều tác phẩm học thuật.
Nhiệm vụ của bạn: Khi nhận được câu hỏi và các trích đoạn từ nhiều cuốn sách khác nhau:
1. ĐỐI CHIẾU ĐA CHIỀU: Đừng chỉ tóm tắt một nguồn. Hãy chỉ ra rõ tác giả nào nhìn nhận vấn đề ra sao.
2. ĐIỂM ĐỒNG THUẬN (CONSENSUS): Những nguyên lý căn bản mà các tác giả đều đồng tình.
3. ĐIỂM KHÁC BIỆT & ĐÁNH ĐỔI (TRADE-OFFS): Sự khác nhau về trường phái, bối cảnh áp dụng hoặc triết lý kiến trúc giữa các tác giả.
4. KHUYẾN NGHỊ HÀNH ĐỘNG TỔNG HỢP (SYNTHESIZED ACTION): Bài học cô đọng dành cho người thực thi tại Việt Nam.
5. VĂN PHONG SẮC BÉN, ZERO-FLUFF: Tuyệt đối không viết lan man hoặc nhắc lại các câu hỏi mang tính thủ tục.`;

    const userPrompt = `CÂU HỎI CỦA NGƯỜI ĐỌC:
"${query}"

CÁC NGUỒN TRI THỨC ĐƯỢC TRÍCH XUẤT TỪ KHO SÁCH (${perspectives.length} cuốn sách, ${uniqueAuthors.size} tác giả):
${contextPrompt}

Hãy tổng hợp câu trả lời chuyên sâu, khách quan và đa chiều dựa trên các nguồn trên.`;

    // 6. Generate Analytical Synthesis using Gemini
    let synthesizedAnswer = '';
    try {
      synthesizedAnswer = await this.geminiService.generateText(systemInstruction, userPrompt, 0.25);
    } catch (err: any) {
      this.logger.error(`Failed to synthesize cross-book answer: ${err.message}`);
      synthesizedAnswer = `Đã tìm thấy ${relevantChunks.length} trích đoạn liên quan từ ${perspectives.length} cuốn sách, nhưng dịch vụ tổng hợp AI tạm thời bận. Dưới đây là các luận điểm trích xuất từ các tác giả.`;
    }

    // 7. Format Citations
    const citations = relevantChunks.map((chunk) => ({
      bookTitle: chunk.bookTitle,
      author: chunk.author,
      chapterNumber: chunk.chapterNumber,
      chapterTitle: chunk.chapterTitle,
      similarity: chunk.similarity,
    }));

    return {
      query,
      synthesizedAnswer,
      perspectivesCount: {
        books: perspectives.length,
        authors: uniqueAuthors.size,
        chunks: relevantChunks.length,
      },
      perspectives,
      citations,
    };
  }
}

