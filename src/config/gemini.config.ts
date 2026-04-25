import { registerAs } from '@nestjs/config';

/**
 * Google Gemini AI configuration
 */
export default registerAs('gemini', () => ({
  apiKey: process.env.GEMINI_API_KEY || '',
  generationModel: process.env.GEMINI_MODEL || 'gemini-3-flash-preview',
  embeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2-preview',
  embeddingDimension: parseInt(process.env.GEMINI_EMBEDDING_DIMENSION || '768', 10),
  maxRetries: parseInt(process.env.GEMINI_MAX_RETRIES || '3', 10),
  chatHistoryLimit: parseInt(process.env.GEMINI_CHAT_HISTORY_LIMIT || '10', 10),
}));
