import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { GeminiService } from './gemini.service';
import { ScamPattern } from './entities';

export interface ScamAnalysisResult {
  scamScore: number; // 0-100
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  reasons: string[];
  recommendation: string;
  matchedPatterns: string[];
  aiAnalysis: string;
}

interface JobContent {
  title: string;
  description: string;
  companyName?: string;
  salary?: number;
  salaryText?: string;
  address?: string;
}

// ─── Rule-based scoring weights ───
const RULE_CHECKS: Array<{
  name: string;
  check: (job: JobContent) => boolean;
  score: number;
  reason: string;
}> = [
  {
    name: 'excessive_salary',
    check: (job) =>
      !!job.salary &&
      (!job.salaryText || job.salaryText.includes('giờ')) &&
      job.salary > 200000,
    score: 25,
    reason: 'Mức lương cao bất thường (>200,000₫/giờ) cho công việc thời vụ',
  },
  {
    name: 'deposit_required',
    check: (job) => {
      const text = `${job.title} ${job.description}`.toLowerCase();
      return /đặt cọc|tiền cọc|phí giữ chỗ|chuyển khoản trước|đóng tiền/.test(
        text,
      );
    },
    score: 35,
    reason:
      'Yêu cầu đặt cọc hoặc chuyển khoản trước — dấu hiệu lừa đảo phổ biến nhất',
  },
  {
    name: 'personal_info_request',
    check: (job) => {
      const text = `${job.title} ${job.description}`.toLowerCase();
      return /số cmnd|cccd|số tài khoản|mật khẩu|otp|pin|chứng minh nhân dân/.test(
        text,
      );
    },
    score: 30,
    reason: 'Yêu cầu thông tin cá nhân nhạy cảm (CMND, số tài khoản, OTP)',
  },
  {
    name: 'vague_description',
    check: (job) => job.description.length < 50,
    score: 15,
    reason: 'Mô tả công việc quá ngắn, thiếu chi tiết',
  },
  {
    name: 'no_address',
    check: (job) => !job.address || job.address.trim().length < 10,
    score: 10,
    reason: 'Không có hoặc thiếu địa chỉ làm việc cụ thể',
  },
  {
    name: 'pyramid_keywords',
    check: (job) => {
      const text = `${job.title} ${job.description}`.toLowerCase();
      return /thu nhập thụ động|đa cấp|mlm|tuyến dưới|hệ thống|network marketing/.test(
        text,
      );
    },
    score: 30,
    reason: 'Chứa từ khóa liên quan đến mô hình đa cấp/kim tự tháp',
  },
  {
    name: 'urgency_pressure',
    check: (job) => {
      const text = `${job.title} ${job.description}`.toLowerCase();
      return /gấp|ngay lập tức|hôm nay|trong.*1.*giờ|cơ hội cuối/.test(text);
    },
    score: 10,
    reason: 'Sử dụng ngôn ngữ tạo áp lực thời gian (gấp, ngay lập tức)',
  },
  {
    name: 'too_good_to_be_true',
    check: (job) => {
      const text = `${job.title} ${job.description}`.toLowerCase();
      return /không cần kinh nghiệm.*thu nhập cao|dễ dàng.*triệu|chỉ cần.*điện thoại/.test(
        text,
      );
    },
    score: 20,
    reason:
      'Hứa hẹn "quá tốt để là sự thật" — thu nhập cao mà không yêu cầu kỹ năng',
  },
  {
    name: 'no_company_info',
    check: (job) => !job.companyName || job.companyName.trim().length < 3,
    score: 10,
    reason: 'Thiếu thông tin công ty/nhà tuyển dụng',
  },
  {
    name: 'suspicious_contact',
    check: (job) => {
      const text = `${job.title} ${job.description}`.toLowerCase();
      return (
        /zalo|telegram|whatsapp|liên hệ qua/.test(text) &&
        /thu nhập|lương|triệu/.test(text)
      );
    },
    score: 15,
    reason: 'Yêu cầu liên hệ qua kênh riêng kết hợp hứa hẹn thu nhập cao',
  },
];

const SCAM_ANALYSIS_PROMPT = `Bạn là chuyên gia phân tích tin tuyển dụng lừa đảo tại Việt Nam.
Hãy phân tích tin tuyển dụng sau và trả về kết quả dạng JSON (KHÔNG có markdown code block):

{
  "isScam": true/false,
  "confidence": 0-100,
  "reasons": ["lý do 1", "lý do 2"],
  "recommendation": "lời khuyên cho người tìm việc"
}

Các dấu hiệu cần chú ý:
- Yêu cầu đặt cọc/chuyển khoản
- Lương cao bất thường so với công việc
- Thiếu thông tin công ty
- Yêu cầu thông tin cá nhân nhạy cảm
- Mô hình đa cấp/kim tự tháp
- Mô tả mơ hồ, thiếu chi tiết
- Áp lực thời gian (gấp, ngay lập tức)
`;

@Injectable()
export class ScamDetectorService {
  private readonly logger = new Logger(ScamDetectorService.name);

  constructor(
    private readonly geminiService: GeminiService,
    @InjectRepository(ScamPattern)
    private readonly scamPatternRepo: Repository<ScamPattern>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Full scam analysis pipeline:
   * 1. Rule-based scoring
   * 2. Vector similarity with known scam patterns
   * 3. AI analysis via Gemini
   * 4. Combine scores
   */
  async analyzeJob(job: JobContent): Promise<ScamAnalysisResult> {
    // 1. Rule-based scoring
    const ruleResult = this.runRuleChecks(job);

    // 2. Pattern matching via vector similarity
    const patternResult = await this.matchScamPatterns(job);

    // 3. AI analysis (only if Gemini is available)
    let aiResult = {
      confidence: 0,
      reasons: [] as string[],
      recommendation: '',
    };
    if (this.geminiService.isAvailable) {
      aiResult = await this.runAiAnalysis(job);
    }

    // 4. Combine scores (weighted average)
    const combinedScore = Math.min(
      100,
      Math.round(
        ruleResult.score * 0.4 +
          patternResult.score * 0.3 +
          aiResult.confidence * 0.3,
      ),
    );

    const allReasons = [
      ...ruleResult.reasons,
      ...patternResult.reasons,
      ...aiResult.reasons,
    ];
    // Deduplicate reasons
    const uniqueReasons = [...new Set(allReasons)];

    const riskLevel = this.scoreToRiskLevel(combinedScore);

    const recommendation =
      aiResult.recommendation || this.getDefaultRecommendation(riskLevel);

    return {
      scamScore: combinedScore,
      riskLevel,
      reasons: uniqueReasons,
      recommendation,
      matchedPatterns: patternResult.matchedNames,
      aiAnalysis: aiResult.recommendation || '',
    };
  }

  /**
   * Rule-based scoring
   */
  private runRuleChecks(job: JobContent): {
    score: number;
    reasons: string[];
  } {
    let totalScore = 0;
    const reasons: string[] = [];

    for (const rule of RULE_CHECKS) {
      if (rule.check(job)) {
        totalScore += rule.score;
        reasons.push(rule.reason);
      }
    }

    return { score: Math.min(100, totalScore), reasons };
  }

  /**
   * Vector similarity search against known scam patterns
   */
  private async matchScamPatterns(job: JobContent): Promise<{
    score: number;
    reasons: string[];
    matchedNames: string[];
  }> {
    try {
      if (!this.geminiService.isAvailable) {
        return { score: 0, reasons: [], matchedNames: [] };
      }

      const jobText = `${job.title} ${job.description} ${job.companyName || ''}`;
      const embedding = await this.geminiService.embedText(jobText);
      const vectorStr = `[${embedding.join(',')}]`;

      const results = await this.dataSource.query(
        `SELECT id, name, description, severity, indicators,
                1 - (embedding::vector <=> $1::vector) AS similarity
         FROM scam_patterns
         WHERE is_active = true AND embedding IS NOT NULL
         ORDER BY embedding::vector <=> $1::vector
         LIMIT 5`,
        [vectorStr],
      );

      if (!results || results.length === 0) {
        return { score: 0, reasons: [], matchedNames: [] };
      }

      // Only consider patterns with similarity > 0.5
      const matched = results.filter((r: any) => r.similarity > 0.5);

      if (matched.length === 0) {
        return { score: 0, reasons: [], matchedNames: [] };
      }

      const severityScore: Record<string, number> = {
        low: 10,
        medium: 25,
        high: 40,
        critical: 60,
      };

      let maxScore = 0;
      const reasons: string[] = [];
      const matchedNames: string[] = [];

      for (const pattern of matched) {
        const patternScore =
          (severityScore[pattern.severity] || 20) * pattern.similarity;
        maxScore = Math.max(maxScore, patternScore);
        reasons.push(
          `Tương tự mẫu lừa đảo "${pattern.name}" (${Math.round(pattern.similarity * 100)}% giống)`,
        );
        matchedNames.push(pattern.name);
      }

      return {
        score: Math.min(100, Math.round(maxScore)),
        reasons,
        matchedNames,
      };
    } catch (error) {
      this.logger.warn('Scam pattern matching failed', error);
      return { score: 0, reasons: [], matchedNames: [] };
    }
  }

  /**
   * AI-powered analysis via Gemini
   */
  private async runAiAnalysis(job: JobContent): Promise<{
    confidence: number;
    reasons: string[];
    recommendation: string;
  }> {
    try {
      const jobText = `
Tiêu đề: ${job.title}
Mô tả: ${job.description}
Công ty: ${job.companyName || 'Không rõ'}
Mức lương: ${job.salaryText || (job.salary ? `${job.salary.toLocaleString()}₫` : 'Không rõ')}
Địa chỉ: ${job.address || 'Không rõ'}`.trim();

      const response = await this.geminiService.generateContent(
        `${SCAM_ANALYSIS_PROMPT}\n\nTin tuyển dụng cần phân tích:\n${jobText}`,
      );

      // Parse JSON response
      const cleanResponse = response
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const parsed = JSON.parse(cleanResponse);

      return {
        confidence: Math.min(100, Math.max(0, parsed.confidence || 0)),
        reasons: Array.isArray(parsed.reasons) ? parsed.reasons : [],
        recommendation: parsed.recommendation || '',
      };
    } catch (error) {
      this.logger.warn('AI scam analysis failed', error);
      return { confidence: 0, reasons: [], recommendation: '' };
    }
  }

  private scoreToRiskLevel(
    score: number,
  ): 'safe' | 'low' | 'medium' | 'high' | 'critical' {
    if (score < 10) return 'safe';
    if (score < 30) return 'low';
    if (score < 55) return 'medium';
    if (score < 80) return 'high';
    return 'critical';
  }

  private getDefaultRecommendation(riskLevel: string): string {
    const recs: Record<string, string> = {
      safe: 'Tin tuyển dụng này có vẻ an toàn. Hãy ứng tuyển với sự tự tin!',
      low: 'Tin tuyển dụng có một số điểm cần lưu ý. Hãy tìm hiểu kỹ trước khi ứng tuyển.',
      medium:
        'Có một số dấu hiệu đáng ngờ. Hãy xác minh thông tin nhà tuyển dụng trước khi liên hệ.',
      high: 'Tin này có nhiều dấu hiệu lừa đảo. Hãy rất cẩn thận và KHÔNG chuyển tiền hay cung cấp thông tin cá nhân.',
      critical:
        'CẢNH BÁO: Tin này có khả năng cao là lừa đảo! Không liên hệ, không chuyển tiền, không cung cấp thông tin cá nhân.',
    };
    return recs[riskLevel] || recs.medium;
  }
}
