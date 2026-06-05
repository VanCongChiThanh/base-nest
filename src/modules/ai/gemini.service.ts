import { Injectable, Logger, Inject } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import geminiConfig from '../../config/gemini.config';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private ai: GoogleGenAI;
  private readonly maxRetries: number;

  constructor(
    @Inject(geminiConfig.KEY)
    private readonly config: ConfigType<typeof geminiConfig>,
  ) {
    if (!config.apiKey) {
      this.logger.warn(
        'GEMINI_API_KEY not set — AI features will be disabled.',
      );
    }
    this.ai = new GoogleGenAI({ apiKey: config.apiKey });
    this.maxRetries = config.maxRetries;
  }

  get isAvailable(): boolean {
    return !!this.config.apiKey;
  }

  /**
   * Generate text content from a prompt with optional context
   */
  async generateContent(
    prompt: string,
    systemInstruction?: string,
  ): Promise<string> {
    if (!this.isAvailable) {
      return 'AI service is not configured. Please set GEMINI_API_KEY.';
    }

    return this.withRetry(async () => {
      const response = await this.ai.models.generateContent({
        model: this.config.generationModel,
        contents: prompt,
        config: systemInstruction ? { systemInstruction } : undefined,
      });
      return response.text || '';
    });
  }

  /**
   * Generate text content from a prompt as an async iterable stream
   */
  async generateContentStream(prompt: string, systemInstruction?: string) {
    if (!this.isAvailable) {
      throw new Error(
        'AI service is not configured. Please set GEMINI_API_KEY.',
      );
    }

    return this.ai.models.generateContentStream({
      model: this.config.generationModel,
      contents: prompt,
      config: systemInstruction ? { systemInstruction } : undefined,
    });
  }

  /**
   * Generate embeddings for a given text.
   * Returns a float[] vector of configured dimension.
   */
  async embedText(text: string): Promise<number[]> {
    if (!this.isAvailable) {
      throw new Error('Gemini API key not configured');
    }

    return this.withRetry(async () => {
      const response = await this.ai.models.embedContent({
        model: this.config.embeddingModel,
        contents: text,
        config: { outputDimensionality: this.config.embeddingDimension },
      });
      return response.embeddings?.[0]?.values || [];
    });
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    // Process in small batches to respect rate limits
    const batchSize = 5;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      const response = await this.withRetry(() =>
        this.ai.models.embedContent({
          model: this.config.embeddingModel,
          contents: batch,
          config: { outputDimensionality: this.config.embeddingDimension },
        }),
      );

      const batchValues = response.embeddings?.map((e) => e.values || []) || [];
      results.push(...batchValues);

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < texts.length) {
        await this.delay(200);
      }
    }
    return results;
  }

  /**
   * Generate a structured JSON response from the model.
   * Uses responseMimeType: 'application/json' so the model is guaranteed
   * to return valid JSON — no manual parsing guards needed.
   * Returns null when AI is unavailable or the response cannot be parsed.
   */
  async generateJson<T = unknown>(
    prompt: string,
    systemInstruction?: string,
  ): Promise<T | null> {
    if (!this.isAvailable) return null;

    return this.withRetry(async () => {
      const response = await this.ai.models.generateContent({
        model: this.config.generationModel,
        contents: prompt,
        config: {
          ...(systemInstruction ? { systemInstruction } : {}),
          responseMimeType: 'application/json',
        },
      });
      const text = response.text?.trim() ?? '';
      if (!text) return null;
      return JSON.parse(text) as T;
    });
  }

  /**
   * Retry wrapper with exponential backoff for 429 rate limits
   */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        const status = error?.status || error?.httpStatusCode;

        // Retry on rate limit (429) or server error (5xx)
        if (status === 429 || (status >= 500 && status < 600)) {
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
          this.logger.warn(
            `Gemini API error (${status}), retry ${attempt + 1}/${this.maxRetries} in ${Math.round(delay)}ms`,
          );
          await this.delay(delay);
          continue;
        }

        // Non-retryable error
        throw error;
      }
    }

    throw lastError || new Error('Gemini API call failed after retries');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
