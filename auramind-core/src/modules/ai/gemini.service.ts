import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ChapterContentSchema,
  ChapterContentType,
  GEMINI_CHAPTER_RESPONSE_SCHEMA,
} from './dto/chapter-output.dto';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly apiKey: string;
  private readonly defaultModel: string;
  private readonly fallbackModel: string = 'gemini-3.5-flash-lite';

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('GEMINI_API_KEY') || process.env.GEMINI_API_KEY || '';
    this.defaultModel = this.config.get<string>('GEMINI_MODEL') || 'gemini-3.5-flash';

    if (!this.apiKey) {
      this.logger.warn('⚠️ GEMINI_API_KEY is not defined. AI pipeline will not be able to generate content.');
    }
  }

  /**
   * Zero-Fluff Vietnamese Senior Mentor System Instruction
   */
  private getSystemInstruction(): string {
    return `Bạn là "AuraMind Senior Mentor" - Chuyên gia diễn giải tri thức sách hàn lâm hàng đầu Việt Nam.
NGUYÊN TẮC BẤT DI BẤT DỊCH (ZERO-FLUFF PROTOCOL):
1. TRIỆT TIÊU VĂN PHONG DỊCH THUẬT CỨNG NHẮC: Tuyệt đối không dịch word-by-word. Chuyển ngữ tự nhiên, súc tích, đắt giá, dễ hiểu ngay từ lần đọc đầu tiên.
2. VÍ DỤ THỰC CHIẾN VIỆT NAM: Bắt buộc phần simplifiedExplanation phải minh họa bằng bối cảnh sinh động, gần gũi tại Việt Nam (ví dụ: mô hình chuỗi quán cafe, sàn thương mại Shopee/Tiki/TikTok Shop, văn hóa làm việc công sở, logistics, ngân hàng hoặc giao thông đô thị).
3. CẤU TRÚC ĐA CHIỀU: Xuất bản đầy đủ các thành phần:
   - coreSummary: Tóm tắt 300-500 từ cốt lõi, loại bỏ hoàn toàn các câu rào đón sáo rỗng.
   - simplifiedExplanation: Góc nhìn ẩn dụ đời thường (analogy), ví dụ ứng dụng thực tế (realWorldExample), bài học cốt lõi (keyTakeaway).
   - mindmap: Cây phân nhánh khái niệm logic có id, label, parentId, description.
   - actionableSteps: 3-5 hành động có thể bắt tay làm ngay ngày mai.
   - flashcards: 3-5 câu hỏi - trả lời phản xạ nhanh (Active Recall) kèm mẹo ghi nhớ.
4. CHUẨN JSON TUYỆT ĐỐI: Phải tuân thủ 100% JSON Schema được định nghĩa. Không chèn thêm bất kỳ văn bản hoặc markdown nào ngoài JSON.`;
  }

  /**
   * Decompose raw chapter text into structured JSON knowledge using Gemini 3.5 Structured Outputs
   */
  async decomposeChapter(
    chapterNumber: number,
    chapterTitle: string,
    rawText: string,
    bookTitle: string
  ): Promise<{ data: ChapterContentType; tokens: number; modelUsed: string }> {
    const prompt = `Cuốn sách: "${bookTitle}"
Chương ${chapterNumber}: "${chapterTitle}"

Nội dung thô của chương sách:
${rawText}

Hãy bóc tách tri thức toàn diện của chương sách trên theo đúng cấu trúc JSON Schema quy định.`;

    const modelsToTry = [this.defaultModel, this.fallbackModel];
    let lastError: any = null;

    for (const model of modelsToTry) {
      try {
        this.logger.log(`Calling Gemini API [${model}] for Chapter ${chapterNumber}: "${chapterTitle}"...`);
        const result = await this.callGeminiWithSchema(model, prompt);
        
        // Runtime Zod Validation
        const parsed = ChapterContentSchema.safeParse(result.parsedJson);
        if (!parsed.success) {
          this.logger.error(`Zod Schema Validation Failed: ${parsed.error.message}`);
          throw new Error(`AI output failed schema validation: ${parsed.error.issues.map(i => i.message).join(', ')}`);
        }

        return {
          data: parsed.data,
          tokens: result.totalTokens,
          modelUsed: model,
        };
      } catch (err: any) {
        this.logger.warn(`Model [${model}] failed: ${err.message}. Trying next fallback if available...`);
        lastError = err;
        // Wait 1.5s before fallback attempt
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    throw new HttpException(
      `Tất cả các mô hình Gemini đều thất bại khi xử lý chương ${chapterNumber}: ${lastError?.message}`,
      HttpStatus.BAD_GATEWAY
    );
  }

  /**
   * Direct REST call to Google Gemini endpoint enforcing JSON Schema Structured Output
   */
  private async callGeminiWithSchema(model: string, prompt: string): Promise<{ parsedJson: any; totalTokens: number }> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

    const body = {
      systemInstruction: {
        parts: [{ text: this.getSystemInstruction() }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2, // Low temperature for high analytical accuracy and consistency
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
        responseSchema: GEMINI_CHAPTER_RESPONSE_SCHEMA,
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      let parsedErr: any = {};
      try {
        parsedErr = JSON.parse(errText);
      } catch {}
      const errMsg = parsedErr?.error?.message || errText;

      if (res.status === 429) {
        throw new HttpException(`Gemini Rate Limit (429): ${errMsg}`, HttpStatus.TOO_MANY_REQUESTS);
      }
      throw new HttpException(`Gemini API Error (${res.status}): ${errMsg}`, HttpStatus.BAD_GATEWAY);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('Gemini trả về kết quả rỗng (No text content returned)');
    }

    const totalTokens = data.usageMetadata?.totalTokenCount || 0;
    const parsedJson = JSON.parse(text);

    return { parsedJson, totalTokens };
  }

  /**
   * Generate 768-dimensional Vector Embedding using text-embedding-004
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${this.apiKey}`;

    const body = {
      model: 'models/text-embedding-004',
      content: {
        parts: [{ text: text.slice(0, 8000) }], // Truncate to maximum input length safely
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      this.logger.error(`Embedding generation failed: ${errText}`);
      throw new Error(`Failed to generate embedding: ${res.statusText}`);
    }

    const data = await res.json();
    const values = data.embedding?.values;
    if (!values || !Array.isArray(values)) {
      throw new Error('Invalid embedding vector returned from Gemini API');
    }

    return values;
  }
}
