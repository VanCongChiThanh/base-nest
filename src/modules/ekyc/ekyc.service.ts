import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createPublicKey, verify as verifySignature } from 'node:crypto';
import { Repository } from 'typeorm';
import { VerificationLevel, VerificationStatus } from '../../common/enums';
import ekycConfig from '../../config/ekyc.config';
import { User } from '../user/entities';
import {
  VerificationRequest,
  EkycResult,
} from '../verification/entities';
import { CompleteEkycDto, VerifySignatureDto } from './dto';
import { DeepPartial } from 'typeorm';

interface VnptOauthTokenResponse {
  access_token: string;
  expires_in?: number;
  token_type?: string;
}

@Injectable()
export class EkycService {
  constructor(
    @Inject(ekycConfig.KEY)
    private readonly ekycConf: ConfigType<typeof ekycConfig>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(VerificationRequest)
    private readonly verificationRequestRepository: Repository<VerificationRequest>,
    @InjectRepository(EkycResult)
    private readonly ekycResultRepository: Repository<EkycResult>,
  ) {}

  getSdkConfig() {
    return {
      BACKEND_URL: this.ekycConf.backendUrl,
      TOKEN_KEY: this.ekycConf.tokenKey,
      TOKEN_ID: this.ekycConf.tokenId,
      ENABLE_GGCAPCHAR: this.ekycConf.enableGoogleCaptcha,
    };
  }

  async getAccessToken() {
    const staticToken = this.extractBearerToken(this.ekycConf.accessToken);
    if (staticToken) {
      return {
        accessToken: staticToken,
        tokenType: 'bearer',
        expiresIn: null,
      };
    }

    this.validateOAuthConfig();

    const response = await fetch(this.ekycConf.oauthUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: this.ekycConf.username,
        password: this.ekycConf.password,
        client_id: this.ekycConf.clientId,
        grant_type: this.ekycConf.grantType,
        client_secret: this.ekycConf.clientSecret,
      }),
    });

    const raw = await response.text();
    let tokenData: VnptOauthTokenResponse | null = null;

    try {
      tokenData = JSON.parse(raw) as VnptOauthTokenResponse;
    } catch {
      throw new InternalServerErrorException('VNPT token response is invalid');
    }

    if (!response.ok || !tokenData?.access_token) {
      throw new BadRequestException(
        'Unable to get VNPT access token. Check credentials and endpoint.',
      );
    }

    return {
      accessToken: tokenData.access_token,
      tokenType: tokenData.token_type || 'bearer',
      expiresIn: tokenData.expires_in ?? null,
    };
  }

  verifySignature(payload: VerifySignatureDto) {
    const resolvedPublicKey = payload.publicKey || this.ekycConf.publicKey;

    if (!resolvedPublicKey) {
      throw new BadRequestException(
        'publicKey is required (payload.publicKey or VNPT_EKYC_PUBLIC_KEY).',
      );
    }

    const isValidSignature = this.verifyDataSign(
      resolvedPublicKey,
      payload.dataBase64,
      payload.dataSign,
    );

    let decodedPayload: unknown = null;
    let isPayloadMatched: boolean | null = null;

    if (isValidSignature) {
      decodedPayload = this.decodeDataBase64(payload.dataBase64);
      if (payload.responseData) {
        isPayloadMatched =
          this.normalizeObject(decodedPayload) ===
          this.normalizeObject(payload.responseData);
      }
    }

    return {
      isValidSignature,
      isPayloadMatched,
      decodedPayload,
    };
  }

  async completeVerification(userId: string, payload: CompleteEkycDto) {
    const verificationResult = this.verifySignature({
      ...payload,
      publicKey: this.ekycConf.publicKey,
    });

    if (!verificationResult.isValidSignature) {
      throw new BadRequestException('VNPT signature is invalid.');
    }

    if (payload.responseData && verificationResult.isPayloadMatched === false) {
      throw new BadRequestException(
        'Payload mismatch with dataBase64. Verification aborted.',
      );
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found.');
    }

    // ─── Extract OCR + compare data from decoded payload ───
    const decoded = verificationResult.decodedPayload as Record<
      string,
      unknown
    > | null;
    const ocr = this.extractNestedObject(decoded, 'object') ||
      this.extractNestedObject(decoded, 'ocr') || {};
    const compare = this.extractNestedObject(decoded, 'compare') || {};
    const liveness = this.extractNestedObject(decoded, 'liveness') || {};

    // ─── Validate image quality and liveness ───
    const warningMsg = this.safeString(ocr.warning_msg) || '';
    const checkingWarning = warningMsg.toLowerCase();
    if (checkingWarning.includes('mờ') || checkingWarning.includes('nhòe') || checkingWarning.includes('nhoè')) {
      throw new BadRequestException('Ảnh giấy tờ tùy thân quá mờ hoặc nhòe. Vui lòng chụp lại ảnh rõ nét hơn.');
    }
    if (checkingWarning.includes('chói') || checkingWarning.includes('lóa')) {
      throw new BadRequestException('Ảnh giấy tờ tùy thân bị chói sáng. Vui lòng chụp lại.');
    }

    // Nâng cấp: check thông số quality từ VNPT
    const qualityFront = ocr.quality_front as Record<string, any>;
    const qualityBack = ocr.quality_back as Record<string, any>;
    
    if (qualityFront?.final_result?.blurred_likelihood === 'likely' || qualityBack?.final_result?.blurred_likelihood === 'likely') {
      throw new BadRequestException('Hình ảnh giấy tờ bị mờ. Vui lòng chụp lại cho rõ viền và chữ.');
    }
    
    if (qualityFront?.final_result?.bad_luminance_likelihood === 'likely' || qualityBack?.final_result?.bad_luminance_likelihood === 'likely') {
      throw new BadRequestException('Lỗi ánh sáng (quá chói hoặc quá tối). Vui lòng chụp lại giấy tờ.');
    }

    const ocrValid = ocr.valid;
    if (ocrValid === false || ocrValid === 'False') {
      throw new BadRequestException('Trích xuất thông tin thất bại hoặc giấy tờ không hợp lệ. Vui lòng thử lại.');
    }

    // ─── Check duplicate CCCD ───
    const idNumber = this.safeString(ocr.id);
    if (!idNumber) {
      throw new BadRequestException('Không nhận diện được số CCCD/CMND từ ảnh.');
    }

    const existingEkyc = await this.ekycResultRepository.findOne({
      where: { idNumber },
    });

    if (existingEkyc && existingEkyc.userId !== userId) {
      throw new BadRequestException('Số CCCD/CMND này đã được sử dụng để xác thực cho một tài khoản khác.');
    }

    // ─── Save EkycResult (OCR data in dedicated table) ───
    const ekycResultData: DeepPartial<EkycResult> = {
      userId,
      fullName: this.safeString(ocr.name),
      idNumber: this.safeString(ocr.id),
      dateOfBirth: this.safeString(ocr.dob),
      gender: this.safeString(ocr.gender),
      nationality: this.safeString(ocr.nationality),
      placeOfOrigin: this.safeString(ocr.home),
      placeOfResidence: this.safeString(ocr.address),
      expiryDate: this.safeString(ocr.doe),
      cardType: this.safeString(ocr.card_type) || this.safeString(ocr.type),
      documentType: this.safeString(ocr.document_type),
      faceMatchResult: this.safeString(compare.result),
      faceMatchScore: this.safeNumber(compare.prob),
      livenessCardResult: this.safeString(
        liveness.card_liveness || ocr.card_liveness,
      ),
      livenessFaceResult: this.safeString(
        liveness.face_liveness || ocr.face_liveness,
      ),
      maskedFaceResult: this.safeString(ocr.masked),
      rawOcrPayload: ocr as Record<string, unknown>,
      rawComparePayload: compare as Record<string, unknown>,
      rawFullPayload: decoded as Record<string, unknown>,
      dataBase64: payload.dataBase64,
      dataSignature: payload.dataSign,
      isSignatureValid: verificationResult.isValidSignature,
      isPayloadMatched: verificationResult.isPayloadMatched ?? undefined,
    };

    const ekycResult = this.ekycResultRepository.create(ekycResultData);
    const savedEkycResult = await this.ekycResultRepository.save(ekycResult);

    // ─── Save VerificationRequest (audit trail) ───
    const verificationRequestData: DeepPartial<VerificationRequest> = {
      userId,
      requestedLevel: VerificationLevel.BASIC,
      status: VerificationStatus.APPROVED,
      ekycResultId: savedEkycResult.id,
      dataSignature: payload.dataSign,
      reviewedAt: new Date(),
    };

    const verificationRequest = this.verificationRequestRepository.create(verificationRequestData);
    await this.verificationRequestRepository.save(verificationRequest);

    // ─── Update user verification level ───
    if (user.verificationLevel === VerificationLevel.NONE) {
      user.verificationLevel = VerificationLevel.BASIC;
      await this.userRepository.save(user);
    }

    return {
      verified: true,
      verificationLevel: user.verificationLevel,
      verificationRequestId: verificationRequest.id,
      ekycResultId: savedEkycResult.id,
      isPayloadMatched: verificationResult.isPayloadMatched,
      decodedPayload: verificationResult.decodedPayload,
    };
  }

  // ─── Private helpers ───

  private validateOAuthConfig() {
    const requiredConfig = [
      this.ekycConf.username,
      this.ekycConf.password,
      this.ekycConf.clientId,
      this.ekycConf.clientSecret,
    ];

    if (requiredConfig.some((value) => !value)) {
      throw new BadRequestException(
        'VNPT OAuth credentials are missing. Provide VNPT_EKYC_ACCESS_TOKEN or OAuth username/password.',
      );
    }
  }

  private extractBearerToken(token: string | undefined): string | null {
    if (!token) {
      return null;
    }

    const trimmedToken = token.trim();
    if (!trimmedToken) {
      return null;
    }

    const bearerPrefix = /^bearer\s+/i;
    return trimmedToken.replace(bearerPrefix, '');
  }

  private verifyDataSign(
    publicKeyBase64: string,
    dataBase64: string,
    dataSignBase64: string,
  ): boolean {
    try {
      const publicKey = createPublicKey({
        key: Buffer.from(publicKeyBase64, 'base64'),
        format: 'der',
        type: 'spki',
      });

      return verifySignature(
        'RSA-SHA256',
        Buffer.from(dataBase64, 'utf8'),
        publicKey,
        Buffer.from(dataSignBase64, 'base64'),
      );
    } catch {
      throw new BadRequestException(
        'Failed to verify signature. Check public key and payload format.',
      );
    }
  }

  private decodeDataBase64(dataBase64: string): unknown {
    try {
      const jsonString = Buffer.from(dataBase64, 'base64').toString('utf8');
      return JSON.parse(jsonString) as unknown;
    } catch {
      throw new BadRequestException(
        'dataBase64 is not a valid base64 JSON payload',
      );
    }
  }

  private normalizeObject(input: unknown): string {
    if (input === null || input === undefined) {
      return '';
    }

    if (typeof input !== 'object') {
      return JSON.stringify(input);
    }

    if (Array.isArray(input)) {
      return `[${input.map((item) => this.normalizeObject(item)).join(',')}]`;
    }

    const objectInput = input as Record<string, unknown>;
    const sortedEntries = Object.entries(objectInput).sort(([a], [b]) =>
      a.localeCompare(b),
    );

    const normalizedEntries = sortedEntries.map(
      ([key, value]) => `"${key}":${this.normalizeObject(value)}`,
    );

    return `{${normalizedEntries.join(',')}}`;
  }

  private extractNestedObject(
    source: Record<string, unknown> | null | undefined,
    key: string,
  ): Record<string, unknown> | null {
    if (!source || typeof source !== 'object') {
      return null;
    }

    const value = source[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return null;
  }

  private safeString(value: unknown): string | undefined {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed || undefined;
    }

    if (value !== null && value !== undefined) {
      return String(value);
    }

    return undefined;
  }

  private safeNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
  }
}
