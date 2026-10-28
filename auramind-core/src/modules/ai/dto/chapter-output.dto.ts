import { z } from 'zod';

/**
 * -----------------------------------------------------------------------------
 * Zod Schema for Structured Chapter Decomposition Output
 * Validates AI responses at runtime before database persistence.
 * -----------------------------------------------------------------------------
 */

export const MindmapNodeSchema = z.object({
  id: z.string().describe('Unique identifier for this node (e.g. node-1)'),
  label: z.string().describe('Short concise title of the concept (under 10 words)'),
  parentId: z.string().nullable().describe('ID of parent node or null if root'),
  description: z.string().describe('Brief 1-sentence explanation of this branch'),
});

export const ActionableStepSchema = z.object({
  stepNumber: z.number().int().positive().describe('Step sequence order (1, 2, 3...)'),
  action: z.string().describe('Concrete actionable directive starting with an imperative verb'),
  practicalTips: z.string().describe('Real-world tactical tip for immediate execution'),
});

export const FlashcardSchema = z.object({
  question: z.string().describe('Active-recall prompt testing a core mental model'),
  answer: z.string().describe('Clear, decisive, jargon-free answer'),
  tip: z.string().describe('Memory mnemonic or heuristic to retain the concept'),
});

export const SimplifiedExplanationSchema = z.object({
  analogy: z.string().describe('Góc nhìn ẩn dụ gần gũi từ đời sống sinh hoạt hàng ngày'),
  realWorldExample: z.string().describe('Ví dụ ứng dụng thực tế trong môi trường công sở, kinh doanh hoặc khởi nghiệp tại Việt Nam'),
  keyTakeaway: z.string().describe('Một thông điệp cốt lõi đắt giá nhất cần ghi nhớ'),
});

export const ChapterContentSchema = z.object({
  chapterNumber: z.number().int().positive().describe('Số thứ tự của chương sách'),
  title: z.string().describe('Tiêu đề chính xác và cuốn hút của chương'),
  coreSummary: z.string().describe('Bản tóm tắt tinh gọn 300-500 từ theo phong cách Zero-Fluff, trực diện, không từ ngữ hàn lâm rườm rà'),
  simplifiedExplanation: SimplifiedExplanationSchema,
  mindmap: z.array(MindmapNodeSchema).min(3).describe('Cấu trúc cây sơ đồ tư duy phân nhánh trực quan'),
  actionableSteps: z.array(ActionableStepSchema).min(3).max(7).describe('Các hành động thực thi cụ thể áp dụng ngay'),
  flashcards: z.array(FlashcardSchema).min(3).max(8).describe('Bộ thẻ flashcard ôn tập chủ động Spaced Repetition'),
});

export type ChapterContentType = z.infer<typeof ChapterContentSchema>;
export type MindmapNode = z.infer<typeof MindmapNodeSchema>;
export type ActionableStep = z.infer<typeof ActionableStepSchema>;
export type Flashcard = z.infer<typeof FlashcardSchema>;

/**
 * -----------------------------------------------------------------------------
 * Native Gemini Structured Output JSON Schema definition
 * Passed directly into Gemini generationConfig.responseSchema
 * -----------------------------------------------------------------------------
 */
export const GEMINI_CHAPTER_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    chapterNumber: { type: 'INTEGER' },
    title: { type: 'STRING' },
    coreSummary: { type: 'STRING' },
    simplifiedExplanation: {
      type: 'OBJECT',
      properties: {
        analogy: { type: 'STRING' },
        realWorldExample: { type: 'STRING' },
        keyTakeaway: { type: 'STRING' },
      },
      required: ['analogy', 'realWorldExample', 'keyTakeaway'],
    },
    mindmap: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          label: { type: 'STRING' },
          parentId: { type: 'STRING', nullable: true },
          description: { type: 'STRING' },
        },
        required: ['id', 'label', 'description'],
      },
    },
    actionableSteps: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          stepNumber: { type: 'INTEGER' },
          action: { type: 'STRING' },
          practicalTips: { type: 'STRING' },
        },
        required: ['stepNumber', 'action', 'practicalTips'],
      },
    },
    flashcards: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          question: { type: 'STRING' },
          answer: { type: 'STRING' },
          tip: { type: 'STRING' },
        },
        required: ['question', 'answer', 'tip'],
      },
    },
  },
  required: [
    'chapterNumber',
    'title',
    'coreSummary',
    'simplifiedExplanation',
    'mindmap',
    'actionableSteps',
    'flashcards',
  ],
};
