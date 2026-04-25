import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { GeminiService } from './gemini.service';
import { GraphKnowledge, ScamPattern } from './entities';

const FAQ_SEEDS = [
  {
    category: 'guide',
    title: 'Cách tạo tài khoản trên GigWork',
    content:
      'Để tạo tài khoản trên GigWork, bạn có thể: 1) Truy cập trang đăng ký, nhập email, mật khẩu và thông tin cá nhân. 2) Xác thực email qua link được gửi. 3) Hoặc đăng nhập nhanh bằng Google Account. Sau khi tạo tài khoản, bạn nên hoàn thiện hồ sơ để tăng cơ hội được nhận việc.',
  },
  {
    category: 'guide',
    title: 'Cách tạo hồ sơ người tìm việc (Worker)',
    content:
      'Hồ sơ Worker bao gồm: thông tin cá nhân (tên, số điện thoại, địa chỉ), tiểu sử ngắn, danh sách kỹ năng (phục vụ, pha chế, lái xe...), và ảnh đại diện. Hồ sơ đầy đủ sẽ được nhà tuyển dụng ưu tiên. Bạn vào mục Hồ sơ > Chỉnh sửa để cập nhật.',
  },
  {
    category: 'guide',
    title: 'Cách ứng tuyển công việc',
    content:
      'Để ứng tuyển: 1) Duyệt danh sách việc làm hoặc tìm kiếm theo khu vực, danh mục. 2) Click vào công việc muốn ứng tuyển. 3) Nhấn "Ứng tuyển ngay" và viết thư giới thiệu ngắn. 4) Chờ nhà tuyển dụng xem xét và phản hồi. Bạn có thể theo dõi trạng thái ứng tuyển tại mục Dashboard.',
  },
  {
    category: 'guide',
    title: 'Cách đăng tuyển công việc (Employer)',
    content:
      'Để đăng tuyển: 1) Đăng nhập với tài khoản có hồ sơ nhà tuyển dụng. 2) Nhấn "Đăng tuyển" trên thanh menu. 3) Điền thông tin: tiêu đề, mô tả chi tiết, mức lương, số lượng nhân viên cần, kỹ năng yêu cầu, thời gian và địa điểm. 4) Xác nhận đăng. Tin sẽ xuất hiện ngay trên trang việc làm.',
  },
  {
    category: 'faq',
    title: 'eKYC là gì và tại sao cần xác thực?',
    content:
      'eKYC (Electronic Know Your Customer) là quy trình xác thực danh tính điện tử sử dụng CMND/CCCD và nhận diện khuôn mặt. GigWork yêu cầu eKYC để: 1) Đảm bảo người dùng là người thật. 2) Tăng độ tin cậy cho nhà tuyển dụng. 3) Bảo vệ cộng đồng khỏi tài khoản giả mạo. Bạn chỉ cần xác thực 1 lần qua menu Hồ sơ > Xác thực danh tính.',
  },
  {
    category: 'faq',
    title: 'Quy trình thanh toán trên GigWork',
    content:
      'Quy trình thanh toán: 1) Sau khi worker hoàn thành công việc và check-out, employer xác nhận hoàn thành. 2) Employer tạo xác nhận thanh toán với số tiền thỏa thuận. 3) Worker xác nhận đã nhận lương. 4) Nếu có tranh chấp, cả hai bên có thể tạo dispute để admin xem xét. Lưu ý: GigWork không giữ tiền, thanh toán trực tiếp giữa hai bên.',
  },
  {
    category: 'faq',
    title: 'Cách đánh giá sau khi hoàn thành công việc',
    content:
      'Sau khi công việc hoàn thành, cả worker và employer đều có thể đánh giá lẫn nhau. Đánh giá bao gồm: 1) Số sao (1-5). 2) Nhận xét bằng văn bản. Đánh giá giúp xây dựng uy tín trên nền tảng. Employer có nhiều đánh giá tốt sẽ được gắn badge Trusted/Top.',
  },
  {
    category: 'faq',
    title: 'Các gói đăng ký (Subscription) trên GigWork',
    content:
      'GigWork có nhiều gói đăng ký cho nhà tuyển dụng: 1) Free — 2 tin/tháng, 14 ngày hiển thị. 2) Starter — 15 tin/tháng, AI screening 30 lượt. 3) Growth — 60 tin/tháng, AI screening 120 lượt. 4) Pro — 150 tin/tháng, AI screening 600 lượt. Thanh toán qua PayOS (chuyển khoản/QR). Gói có thể nâng cấp bất cứ lúc nào.',
  },
  {
    category: 'faq',
    title: 'Cách sử dụng tính năng "Việc làm gần tôi"',
    content:
      'Tính năng "Việc làm gần tôi" sử dụng định vị GPS để tìm công việc trong bán kính bạn chọn (1-50km). Cách dùng: 1) Bật định vị GPS trên trình duyệt. 2) Vào trang Việc làm > Bật bộ lọc "Gần tôi". 3) Điều chỉnh bán kính. Khoảng cách được tính tự động và hiển thị trên mỗi thẻ công việc.',
  },
  {
    category: 'faq',
    title: 'Cách báo cáo tin tuyển dụng vi phạm',
    content:
      'Nếu phát hiện tin đáng ngờ, bạn có thể báo cáo: 1) Mở chi tiết công việc. 2) Nhấn nút "Báo cáo" (biểu tượng cờ). 3) Chọn lý do: lừa đảo, nội dung không phù hợp, spam, hoặc lý do khác. 4) Mô tả chi tiết. Admin sẽ xem xét và xử lý trong 24-48 giờ.',
  },
  {
    category: 'policy',
    title: 'Chính sách bảo mật thông tin cá nhân',
    content:
      'GigWork cam kết bảo mật: 1) Thông tin cá nhân (SĐT, địa chỉ, ngày sinh) chỉ hiển thị theo cài đặt riêng tư của bạn. 2) SĐT chỉ hiện cho nhà tuyển dụng khi đã chấp nhận ứng tuyển. 3) Dữ liệu eKYC được mã hóa. 4) Không chia sẻ thông tin cho bên thứ 3. Bạn có thể tùy chỉnh quyền riêng tư trong Hồ sơ > Cài đặt riêng tư.',
  },
  {
    category: 'safety',
    title: 'Cách nhận biết tin tuyển dụng lừa đảo',
    content:
      'Các dấu hiệu cần cảnh giác: 1) Yêu cầu đặt cọc, chuyển khoản trước khi làm việc. 2) Lương quá cao so với công việc (>200K/giờ cho việc đơn giản). 3) Không có thông tin công ty rõ ràng. 4) Yêu cầu cung cấp CMND, số tài khoản ngân hàng, OTP. 5) Mô tả mơ hồ kiểu "việc nhẹ lương cao". 6) Liên hệ qua Zalo/Telegram cá nhân. 7) Áp lực "phải quyết định ngay". Hãy dùng tính năng AI kiểm tra tin để được phân tích tự động.',
  },
];

const SCAM_PATTERN_SEEDS = [
  {
    category: 'deposit_scam',
    name: 'Yêu cầu đặt cọc',
    description:
      'Nhà tuyển dụng yêu cầu ứng viên đặt cọc tiền trước khi được nhận việc. Đây là hình thức lừa đảo phổ biến nhất.',
    indicators: ['đặt cọc', 'tiền cọc', 'phí giữ chỗ', 'chuyển khoản trước', 'đóng phí'],
    severity: 'critical',
    exampleText:
      'Tuyển nhân viên bán hàng, lương 15-20 triệu/tháng. Yêu cầu đặt cọc 500.000₫ để giữ chỗ. Liên hệ Zalo: 0901234567',
  },
  {
    category: 'info_theft',
    name: 'Thu thập thông tin nhạy cảm',
    description:
      'Lấy cớ tuyển dụng để thu thập thông tin cá nhân nhạy cảm (CMND, STK, mật khẩu) của ứng viên.',
    indicators: ['số CMND', 'CCCD', 'số tài khoản', 'mật khẩu', 'OTP', 'mã xác nhận'],
    severity: 'critical',
    exampleText:
      'Tuyển CTV online, làm tại nhà. Gửi CMND 2 mặt + ảnh selfie + số tài khoản để xác minh. Thu nhập 200-500k/ngày.',
  },
  {
    category: 'fake_salary',
    name: 'Lương cao bất thường',
    description:
      'Hứa hẹn mức lương quá cao so với thị trường cho công việc đơn giản, không yêu cầu kỹ năng.',
    indicators: [
      'thu nhập cao',
      'triệu/ngày',
      'việc nhẹ lương cao',
      'không cần kinh nghiệm',
      'dễ dàng kiếm',
    ],
    severity: 'high',
    exampleText:
      'Việc nhẹ lương cao! Thu nhập 5-10 triệu/tuần chỉ cần smartphone. Không cần kinh nghiệm. Ai cũng làm được!',
  },
  {
    category: 'pyramid',
    name: 'Mô hình đa cấp',
    description:
      'Sử dụng hình thức tuyển dụng để lôi kéo ứng viên vào mô hình kinh doanh đa cấp.',
    indicators: [
      'thu nhập thụ động',
      'đa cấp',
      'MLM',
      'tuyến dưới',
      'hệ thống',
      'network marketing',
      'tuyển thành viên',
    ],
    severity: 'high',
    exampleText:
      'Cơ hội đầu tư 4.0! Tham gia hệ thống kinh doanh online, xây dựng tuyến dưới, thu nhập thụ động lên đến 50 triệu/tháng.',
  },
  {
    category: 'fake_company',
    name: 'Công ty ma / thông tin giả',
    description:
      'Sử dụng tên công ty không tồn tại hoặc giả mạo thương hiệu lớn để tạo niềm tin giả.',
    indicators: [
      'công ty lớn',
      'tập đoàn quốc tế',
      'chi nhánh mới',
      'vừa thành lập',
    ],
    severity: 'medium',
    exampleText:
      'Tập đoàn XYZ International tuyển gấp 50 nhân viên cho chi nhánh mới tại Việt Nam. Không cần kinh nghiệm, đào tạo từ A-Z.',
  },
  {
    category: 'task_scam',
    name: 'Việc online giả (app task)',
    description:
      'Yêu cầu ứng viên tải app, thực hiện "nhiệm vụ" (like, đánh giá, mua hàng) để nhận hoa hồng. Thường yêu cầu nạp tiền.',
    indicators: [
      'nhiệm vụ online',
      'like/follow',
      'đánh giá 5 sao',
      'hoa hồng',
      'nạp tiền',
      'rút tiền',
      'tải app',
    ],
    severity: 'critical',
    exampleText:
      'Làm nhiệm vụ online đơn giản, mỗi task 50-200K. Chỉ cần điện thoại. Đăng ký qua Telegram @scambot, nạp 100K để kích hoạt.',
  },
  {
    category: 'general',
    name: 'Áp lực thời gian',
    description:
      'Tạo cảm giác gấp gáp để ứng viên không có thời gian suy nghĩ kỹ trước khi quyết định.',
    indicators: [
      'cơ hội cuối',
      'chỉ còn hôm nay',
      'slot cuối cùng',
      'quyết định ngay',
    ],
    severity: 'medium',
    exampleText:
      'CHỈ CÒN 2 SLOT! Tuyển gấp nhân viên kinh doanh, thu nhập 15-30 triệu. Đăng ký NGAY HÔM NAY hoặc mất cơ hội!',
  },
];

@Injectable()
export class AiSeedService implements OnModuleInit {
  private readonly logger = new Logger(AiSeedService.name);

  constructor(
    private readonly geminiService: GeminiService,
    @InjectRepository(GraphKnowledge)
    private readonly graphRepo: Repository<GraphKnowledge>,
    @InjectRepository(ScamPattern)
    private readonly scamPatternRepo: Repository<ScamPattern>,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    await this.ensureVectorExtension();
    await this.ensureVectorColumns();
    await this.seedKnowledgeBase();
    await this.seedScamPatterns();
  }

  /**
   * Ensure pgvector extension is enabled
   */
  private async ensureVectorExtension(): Promise<void> {
    try {
      await this.dataSource.query(
        'CREATE EXTENSION IF NOT EXISTS vector',
      );
      this.logger.log('✅ pgvector extension enabled');
    } catch (error) {
      this.logger.warn(
        '⚠️ Could not enable pgvector extension. Vector features will not work.',
        error,
      );
    }
  }

  /**
   * Ensure the embedding columns have proper vector type
   */
  private async ensureVectorColumns(): Promise<void> {
    try {
      const tables = [
        { table: 'graph_knowledge', column: 'embedding' },
        { table: 'scam_patterns', column: 'embedding' },
      ];

      for (const { table, column } of tables) {
        const colCheck = await this.dataSource.query(
          `SELECT data_type FROM information_schema.columns
           WHERE table_name = $1 AND column_name = $2`,
          [table, column],
        );

        if (colCheck.length > 0 && colCheck[0].data_type === 'text') {
          await this.dataSource.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "${column}"`);
          await this.dataSource.query(`ALTER TABLE "${table}" ADD COLUMN "${column}" vector(768)`);
          this.logger.log(`✅ Converted ${table}.${column} to vector(768)`);
        } else if (colCheck.length === 0) {
          await this.dataSource.query(
            `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" vector(768)`,
          );
          this.logger.log(`✅ Added ${table}.${column} as vector(768)`);
        }
      }

      // IVFFlat index on graph_knowledge for fast vector search
      await this.dataSource
        .query(
          `CREATE INDEX IF NOT EXISTS idx_graph_knowledge_embedding
           ON graph_knowledge USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10)`,
        )
        .catch(() => this.logger.log('IVFFlat index deferred (needs data first)'));

      await this.dataSource
        .query(
          `CREATE INDEX IF NOT EXISTS idx_scam_pattern_embedding
           ON scam_patterns USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10)`,
        )
        .catch(() => this.logger.log('IVFFlat scam index deferred'));
    } catch (error) {
      this.logger.warn('⚠️ Failed to setup vector columns', error);
    }
  }

  /**
   * Seed FAQ/guide/policy into graph_knowledge (unified table)
   */
  private async seedKnowledgeBase(): Promise<void> {
    this.logger.log('📚 Verifying and seeding FAQ/guide/policy into graph_knowledge...');

    for (const faq of FAQ_SEEDS) {
      const sourceId = `faq_${faq.title.toLowerCase().replace(/\s+/g, '_').slice(0, 60)}`;
      const content = `${faq.title}\n${faq.content}`;

      // Check not already inserted (idempotent)
      const dup = await this.graphRepo.findOne({ where: { sourceId } });
      if (dup) continue;

      // Insert into graph_knowledge
      await this.dataSource.query(
        `INSERT INTO graph_knowledge
           (id, node_type, source_id, title, content, category_name,
            skill_names, edges, metadata, is_active, is_available,
            review_count, completed_count, created_at, updated_at)
         VALUES
           (gen_random_uuid(), $1, $2, $3, $4, $5,
            '[]', '[]', '{}', true, true,
            0, 0, NOW(), NOW())`,
        [faq.category, sourceId, faq.title, content, faq.category],
      );

      // Generate and store embedding
      if (this.geminiService.isAvailable) {
        try {
          const embedding = await this.geminiService.embedText(content);
          const vectorStr = `[${embedding.join(',')}]`;
          await this.dataSource.query(
            `UPDATE graph_knowledge SET embedding = $1::vector WHERE source_id = $2`,
            [vectorStr, sourceId],
          );
        } catch (error) {
          this.logger.warn(`Failed to embed FAQ: ${faq.title}`, error);
        }
        // Small delay to respect rate limits
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    this.logger.log(`✅ Seeded ${FAQ_SEEDS.length} knowledge entries`);
  }

  /**
   * Seed scam patterns + embeddings
   */
  private async seedScamPatterns(): Promise<void> {
    const existing = await this.scamPatternRepo.count();
    if (existing > 0) {
      this.logger.log(`Scam patterns already has ${existing} entries, skipping seed`);
      return;
    }

    this.logger.log('🛡️ Seeding scam patterns...');

    for (const pattern of SCAM_PATTERN_SEEDS) {
      const entity = this.scamPatternRepo.create({
        category: pattern.category,
        name: pattern.name,
        description: pattern.description,
        indicators: pattern.indicators,
        severity: pattern.severity,
        exampleText: pattern.exampleText,
      });
      const saved = await this.scamPatternRepo.save(entity);

      // Generate embedding
      if (this.geminiService.isAvailable) {
        try {
          const textToEmbed = `${pattern.name} ${pattern.description} ${pattern.exampleText || ''} ${pattern.indicators.join(' ')}`;
          const embedding = await this.geminiService.embedText(textToEmbed);
          const vectorStr = `[${embedding.join(',')}]`;
          await this.dataSource.query(
            `UPDATE scam_patterns SET embedding = $1::vector WHERE id = $2`,
            [vectorStr, saved.id],
          );
        } catch (error) {
          this.logger.warn(`Failed to embed scam pattern: ${pattern.name}`, error);
        }
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    this.logger.log(`✅ Seeded ${SCAM_PATTERN_SEEDS.length} scam patterns`);
  }
}
