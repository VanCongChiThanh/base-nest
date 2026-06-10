import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Job } from '../job/entities';
import { GoogleGenAI } from '@google/genai';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '../../common/exceptions/business.exception';
import { JOB_ERRORS } from '../../common/constants/error-codes.constant';
import { GeminiService } from './gemini.service';

@Injectable()
export class AiMatchingService {
  private readonly logger = new Logger(AiMatchingService.name);
  private readonly ai: GoogleGenAI;

  constructor(
    @InjectRepository(Job)
    private readonly jobRepo: Repository<Job>,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly geminiService: GeminiService,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.ai = new GoogleGenAI({ apiKey });
  }

  async matchCandidatesForJob(jobId: string, limit: number = 10) {
    const job = await this.jobRepo.findOne({
      where: { id: jobId },
      relations: ['jobSkills', 'jobSkills.skill', 'category'],
    });

    if (!job) {
      throw new NotFoundException(JOB_ERRORS.JOB_NOT_FOUND);
    }

    const jobDescriptionStr = `
Title: ${job.title}
Category: ${job.category?.name ?? 'General'}
Description: ${job.description}
Requirements: ${job.jobSkills
      ?.map((s) => s.skill?.name)
      .filter(Boolean)
      .join(', ')}
Location: Province Code ${job.provinceCode}
    `.trim();

    // 1. Generate search query from job description
    const searchQueryPrompt = `
You are an expert recruiter. Given the following job description, generate a concise search query that captures the most important requirements (skills, experience, role). This query will be used to search a vector database of worker profiles. Do not include location.
Job:
${jobDescriptionStr}
    `;

    let searchQuery = job.title;
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: searchQueryPrompt,
        config: {
          temperature: 0.2,
        },
      });
      if (response.text) {
        searchQuery = response.text.trim();
      }
    } catch (e) {
      this.logger.warn(
        'Failed to generate search query with Gemini, using job title',
        e,
      );
    }

    // 2. Embed the search query
    let queryEmbedding: number[] = [];
    try {
      queryEmbedding = await this.geminiService.embedText(searchQuery);
    } catch (error) {
      this.logger.error('Failed to get embeddings for query', error);
      return [];
    }

    if (queryEmbedding.length === 0) return [];

    // 3. Vector Search in PostgreSQL
    const vectorStr = `[${queryEmbedding.join(',')}]`;
    const searchResult = await this.dataSource.query(
      `
      SELECT 
        id, node_type, title, content, metadata,
        owner_id, owner_name, skill_names, province_code, avg_rating, completed_count,
        1 - (embedding <=> $1::vector) AS similarity
      FROM graph_knowledge
      WHERE node_type = 'worker_service' AND is_active = true
      ORDER BY embedding <=> $1::vector
      LIMIT 20
      `,
      [vectorStr],
    );

    if (!searchResult || searchResult.length === 0) {
      return [];
    }

    // 4. Re-rank and score using Gemini
    const candidatesData = searchResult.map((row: any) => {
      return {
        id: row.id,
        workerId: row.owner_id, 
        name: row.owner_name || row.title,
        serviceTitle: row.title,
        content: row.content,
        similarity: row.similarity,
        skills: row.skill_names || [],
        rating: Number(row.avg_rating) || 0,
        completedJobs: Number(row.completed_count) || 0,
        provinceCode: row.province_code,
      };
    });

    const rerankPrompt = `
You are an expert matching system. 
Job Details:
${jobDescriptionStr}

Candidates (JSON format):
${JSON.stringify(candidatesData, null, 2)}

Task:
Evaluate each candidate against the Job Details. 
Score each candidate from 0 to 100 based on fit. 
Prioritize skill match and relevant experience. If the candidate's provinceCode matches the job's provinceCode, give a small boost.
Provide 1-2 short reasons (in Vietnamese) why they match.

Return the result as a valid JSON array of objects. 
Each object must have exactly these keys: "workerId", "matchScore" (number), "matchReasons" (array of strings).
Sort the array by "matchScore" descending.
Limit the response to top ${limit} candidates.
Return ONLY the JSON array, without any markdown formatting like \`\`\`json.
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: rerankPrompt,
        config: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      });

      const responseText = response.text?.trim() || '[]';
      const parsedMatches = JSON.parse(responseText);

      // Map back to full data
      const finalResult = parsedMatches.map((match: any) => {
        const candidate = candidatesData.find(
          (c: any) => c.workerId === match.workerId,
        );
        return {
          workerId: match.workerId,
          fullName: candidate?.name || 'Unknown Candidate',
          avatarUrl: null, // Could fetch from user table if needed
          matchScore: match.matchScore,
          matchReasons: match.matchReasons,
          skills: candidate?.skills || [],
          ratingAvg: candidate?.rating || 0,
          totalJobsCompleted: candidate?.completedJobs || 0,
          isAvailable: true,
          profileUrl: `/workers/${match.workerId}`,
        };
      });

      return finalResult.filter((c: any) => c.workerId);
    } catch (e) {
      this.logger.error('Failed to parse Gemini rerank response', e);

      // Fallback: return vector search results
      return candidatesData.slice(0, limit).map((c: any) => ({
        workerId: c.workerId,
        fullName: c.name,
        avatarUrl: null,
        matchScore: Math.round(c.similarity * 100),
        matchReasons: ['Phù hợp dựa trên mô tả hồ sơ'],
        skills: c.skills || [],
        ratingAvg: c.rating || 0,
        totalJobsCompleted: c.completedJobs || 0,
        isAvailable: true,
        profileUrl: `/workers/${c.workerId}`,
      }));
    }
  }
}
