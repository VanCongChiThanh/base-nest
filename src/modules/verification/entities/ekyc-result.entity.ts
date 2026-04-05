import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities';

@Entity('ekyc_results')
export class EkycResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  // ─── OCR fields ───
  @Column({ name: 'full_name', nullable: true })
  fullName: string;

  @Column({ name: 'id_number', nullable: true })
  idNumber: string;

  @Column({ name: 'date_of_birth', nullable: true })
  dateOfBirth: string;

  @Column({ nullable: true })
  gender: string;

  @Column({ nullable: true })
  nationality: string;

  @Column({ name: 'place_of_origin', nullable: true })
  placeOfOrigin: string;

  @Column({ name: 'place_of_residence', nullable: true })
  placeOfResidence: string;

  @Column({ name: 'expiry_date', nullable: true })
  expiryDate: string;

  @Column({ name: 'card_type', nullable: true })
  cardType: string;

  @Column({ name: 'document_type', nullable: true })
  documentType: string;

  // ─── Face compare ───
  @Column({ name: 'face_match_result', nullable: true })
  faceMatchResult: string;

  @Column({
    name: 'face_match_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  faceMatchScore: number;

  // ─── Liveness ───
  @Column({ name: 'liveness_card_result', nullable: true })
  livenessCardResult: string;

  @Column({ name: 'liveness_face_result', nullable: true })
  livenessFaceResult: string;

  @Column({ name: 'masked_face_result', nullable: true })
  maskedFaceResult: string;

  // ─── Raw payload for traceability ───
  @Column({ name: 'raw_ocr_payload', type: 'jsonb', nullable: true })
  rawOcrPayload: Record<string, unknown>;

  @Column({ name: 'raw_compare_payload', type: 'jsonb', nullable: true })
  rawComparePayload: Record<string, unknown>;

  @Column({ name: 'raw_full_payload', type: 'jsonb', nullable: true })
  rawFullPayload: Record<string, unknown>;

  // ─── Signature audit ───
  @Column({ name: 'data_base64', type: 'text', nullable: true })
  dataBase64: string;

  @Column({ name: 'data_signature', type: 'text', nullable: true })
  dataSignature: string;

  @Column({ name: 'is_signature_valid', default: false })
  isSignatureValid: boolean;

  @Column({ name: 'is_payload_matched', nullable: true })
  isPayloadMatched: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
