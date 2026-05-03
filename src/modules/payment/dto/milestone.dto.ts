import { IsString, IsOptional } from 'class-validator';

/** Worker nộp deliverable cho milestone */
export class SubmitMilestoneDto {
  @IsOptional()
  @IsString()
  note?: string;
}

/** Employer duyệt hoặc yêu cầu sửa milestone */
export class ReviewMilestoneDto {
  @IsString()
  action: 'approve' | 'request_revision';

  @IsOptional()
  @IsString()
  note?: string;
}

/** Admin giải ngân milestone cho worker */
export class ReleaseMilestoneDto {
  @IsOptional()
  @IsString()
  note?: string;
}

/** Worker đề xuất milestone mới */
export class ProposeMilestoneDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  amount?: number;
}
