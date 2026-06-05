export enum MilestoneStatus {
  PENDING = 'PENDING', // Chưa bắt đầu
  IN_PROGRESS = 'IN_PROGRESS', // Worker đang thực hiện
  SUBMITTED = 'SUBMITTED', // Worker đã nộp deliverable
  APPROVED = 'APPROVED', // Employer đã duyệt, chờ giải ngân
  REVISION_REQUESTED = 'REVISION_REQUESTED', // Employer yêu cầu sửa
  RELEASED = 'RELEASED', // Admin đã giải ngân thành công
  DISPUTED = 'DISPUTED', // Đang tranh chấp
}
