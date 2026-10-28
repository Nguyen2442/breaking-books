import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface ChunkResult {
  totalWords: number;
  totalChunks: number;
  globalContentHash: string;
  chunks: Array<{
    index: number;
    text: string;
    wordCount: number;
    estimatedTokens: number;
    sha256: string;
  }>;
  processingTimeUs: number;
  engine: 'rust' | 'typescript-fallback';
}

export interface Sm2CalculationResult {
  cardId: string;
  nextRepetitions: number;
  nextIntervalDays: number;
  nextEaseFactor: number;
  reviewStatus: string;
}

@Injectable()
export class RustEngineClient {
  private readonly logger = new Logger(RustEngineClient.name);
  private readonly engineUrl: string;

  constructor(private readonly config: ConfigService) {
    this.engineUrl =
      this.config.get<string>('RUST_ENGINE_URL') ||
      process.env.RUST_ENGINE_URL ||
      'http://localhost:8080';
  }

  /**
   * High-speed windowed chunking via Rust Engine with TypeScript Fallback
   */
  async chunkText(
    text: string,
    maxWords: number = 450,
    overlapWords: number = 80
  ): Promise<ChunkResult> {
    const startTime = process.hrtime.bigint();

    // 1. Attempt Rust High-Performance Engine
    try {
      const res = await fetch(`${this.engineUrl}/api/chunk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          max_words_per_chunk: maxWords,
          overlap_words: overlapWords,
        }),
        signal: AbortSignal.timeout(1200), // 1.2s timeout
      });

      if (res.ok) {
        const data = await res.json();
        return {
          totalWords: data.total_words,
          totalChunks: data.total_chunks,
          globalContentHash: data.global_content_hash,
          chunks: data.chunks.map((c: any) => ({
            index: c.index,
            text: c.text,
            wordCount: c.word_count,
            estimatedTokens: c.estimated_tokens,
            sha256: c.sha256,
          })),
          processingTimeUs: data.processing_time_us,
          engine: 'rust',
        };
      }
    } catch {
      // Rust Engine not responding -> Seamlessly execute local TypeScript fallback
    }

    // 2. High-Efficiency In-Process Fallback
    const normalized = text.trim().replace(/\s+/g, ' ');
    const globalContentHash = crypto.createHash('sha256').update(normalized).digest('hex');
    const words = text.split(/\s+/).filter(Boolean);
    const totalWords = words.len = words.length;

    const chunks = [];
    let startIdx = 0;
    let chunkIdx = 0;

    while (startIdx < totalWords) {
      const endIdx = Math.min(startIdx + maxWords, totalWords);
      const slice = words.slice(startIdx, endIdx);
      const chunkText = slice.join(' ');
      const chunkHash = crypto.createHash('sha256').update(chunkText).digest('hex');

      chunks.push({
        index: chunkIdx++,
        text: chunkText,
        wordCount: slice.length,
        estimatedTokens: Math.round(slice.length * 1.4),
        sha256: chunkHash,
      });

      if (endIdx >= totalWords) break;
      startIdx += Math.max(1, maxWords - overlapWords);
    }

    const elapsedUs = Number(process.hrtime.bigint() - startTime) / 1000;
    return {
      totalWords,
      totalChunks: chunks.length,
      globalContentHash,
      chunks,
      processingTimeUs: Math.round(elapsedUs),
      engine: 'typescript-fallback',
    };
  }

  /**
   * SuperMemo-2 Spaced Repetition calculation
   */
  async calculateSm2(
    cardId: string,
    quality: number, // 0 - 5
    currentReps: number,
    currentInterval: number,
    currentEaseFactor: number
  ): Promise<Sm2CalculationResult> {
    // 1. Try Rust microservice
    try {
      const res = await fetch(`${this.engineUrl}/api/sm2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviews: [
            {
              card_id: cardId,
              quality,
              current_repetitions: currentReps,
              current_interval_days: currentInterval,
              current_ease_factor: currentEaseFactor,
            },
          ],
        }),
        signal: AbortSignal.timeout(800),
      });

      if (res.ok) {
        const data = await res.json();
        const r = data.results?.[0];
        if (r) {
          return {
            cardId: r.card_id,
            nextRepetitions: r.next_repetitions,
            nextIntervalDays: r.next_interval_days,
            nextEaseFactor: r.next_ease_factor,
            reviewStatus: r.review_status,
          };
        }
      }
    } catch {}

    // 2. Exact TypeScript implementation of SM-2
    const q = Math.min(5, Math.max(0, quality));
    let ef = currentEaseFactor;
    let reps = currentReps;
    let interval = currentInterval;
    let reviewStatus = 'REVIEWING';

    if (q >= 3) {
      if (reps === 0) {
        interval = 1;
        reviewStatus = 'GRADUATED';
      } else if (reps === 1) {
        interval = 3;
        reviewStatus = 'REVIEWING';
      } else {
        interval = Math.round(interval * ef);
        reviewStatus = 'REVIEWING';
      }
      reps += 1;
      ef = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
      if (ef < 1.3) ef = 1.3;
    } else {
      reps = 0;
      interval = 1;
      reviewStatus = 'RELEARNING';
    }

    return {
      cardId,
      nextRepetitions: reps,
      nextIntervalDays: interval,
      nextEaseFactor: Math.round(ef * 100) / 100,
      reviewStatus,
    };
  }
}

