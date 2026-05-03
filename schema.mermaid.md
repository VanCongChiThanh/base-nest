```mermaid
classDiagram
  class ChatSession {
    +string id
    +string userId
    +User user
    +ChatMessageArray messages
    +string title
    +boolean isActive
    +Date createdAt
  }
  class KnowledgeEmbedding {
    +string id
    +'faq', 'guide', 'policy', 'general' * Category of knowledge
    +string category
    +string title
    +string content
    +'text', type
    +true, nullable
    +{ transformer
    +(value: numberArray | null) to
    +(value: string | null) from
    +numberArray | null embedding
    +Record~string, unknown~ metadata
    +boolean isActive
    +Date createdAt
    +Date updatedAt
  }
  class SavedJob {
    +string id
    +string userId
    +User user
    +string jobId
    +Job job
    +Date createdAt
  }
  class ScamPattern {
    +string id
    +'deposit_scam', 'info_theft', 'fake_salary', 'pyramid', 'general' * Category
    +string category
    +string name
    +string description
    +stringArray indicators
    +'low', 'medium', 'high', 'critical' * Severity level
    +string severity
    +string exampleText
    +'text', type
    +true, nullable
    +{ transformer
    +(value: numberArray | null) to
    +(value: string | null) from
    +numberArray | null embedding
    +boolean isActive
    +Date createdAt
    +Date updatedAt
  }
  class UserProvider {
    +string id
    +'enum', type
    +AuthProvider, enum
    +AuthProvider provider
    +string providerId
    +User user
    +string userId
    +Date createdAt
  }
  class ApplicationMessage {
    +string id
    +string applicationId
    +JobApplication application
    +string senderId
    +User sender
    +string body
    +Date createdAt
  }
  class JobApplication {
    +string id
    +string jobId
    +Job job
    +string workerId
    +User worker
    +string coverLetter
    +'enum', type
    +ApplicationStatus, enum
    +ApplicationStatus.PENDING, default
    +ApplicationStatus status
    +Date appliedAt
    +Date respondedAt
  }
  class JobAssignment {
    +string id
    +string jobId
    +Job job
    +string workerId
    +User worker
    +string applicationId
    +JobApplication application
    +'enum', type
    +AssignmentStatus, enum
    +AssignmentStatus.ASSIGNED, default
    +AssignmentStatus status
    +Date startedAt
    +Date checkedInAt
    +Date completedAt
    +string notes
    +Date createdAt
  }
  class JobSkill {
    +string id
    +string jobId
    +Job job
    +string skillId
    +Skill skill
  }
  class Job {
    +string id
    +string employerId
    +User employer
    +string categoryId
    +JobCategory category
    +string title
    +string description
    +'salary_per_hour', name
    +'decimal', type
    +10, precision
    +2, scale
    +number salaryPerHour
    +number requiredWorkers
    +'enum', type
    +JobSalaryType, enum
    +JobSalaryType.HOURLY, default
    +JobSalaryType salaryType
    +Date startTime
    +Date endTime
    +number provinceCode
    +number wardCode
    +string address
    +number latitude
    +number longitude
    +'enum', type
    +JobType, enum
    +JobType.GIG, default
    +JobType jobType
    +'enum', type
    +JobStatus, enum
    +JobStatus.OPEN, default
    +JobStatus status
    +string contractDuration
    +string workSchedule
    +string paymentNote
    +OnlinePaymentType onlinePaymentType
    +ExperienceLevel experienceLevel
    +string projectScope
    +JobSkillArray jobSkills
    +JobApplicationArray applications
    +Date createdAt
    +Date updatedAt
  }
  class JobCategory {
    +string id
    +string name
    +string description
    +string icon
    +Date createdAt
  }
  class Notification {
    +string id
    +string userId
    +User user
    +NotificationType type
    +ReferenceType | null refType
    +string | null refId
    +Record~string, unknown~ | null data
    +boolean isRead
    +Date createdAt
  }
  class Dispute {
    +string id
    +string jobId
    +Job job
    +string raisedById
    +User raisedBy
    +string reason
    +'enum', type
    +DisputeStatus, enum
    +DisputeStatus.OPEN, default
    +DisputeStatus status
    +string resolution
    +string resolvedById
    +User resolvedBy
    +Date createdAt
    +Date resolvedAt
  }
  class PaymentConfirmation {
    +string id
    +string jobId
    +Job job
    +string workerId
    +User worker
    +string employerId
    +User employer
    +'enum', type
    +PaymentType, enum
    +PaymentType type
    +'decimal', type
    +12, precision
    +2, scale
    +true, nullable
    +number amount
    +'enum', type
    +PaymentStatus, enum
    +PaymentStatus.PENDING, default
    +PaymentStatus status
    +boolean confirmedByWorker
    +Date confirmedAt
    +string note
    +Date createdAt
  }
  class EmployerProfile {
    +string id
    +string userId
    +User user
    +string companyName
    +string companyDescription
    +string phone
    +number provinceCode
    +number wardCode
    +string address
    +number latitude
    +number longitude
    +'rating_avg', name
    +'decimal', type
    +3, precision
    +2, scale
    +0, default
    +number ratingAvg
    +number totalReviews
    +number totalJobsPosted
    +'trust_score', name
    +'decimal', type
    +5, precision
    +2, scale
    +0, default
    +number trustScore
    +boolean isVerifiedBusiness
    +'enum', type
    +EmployerBadge, enum
    +EmployerBadge.NONE, default
    +EmployerBadge badge
    +'privacy_settings', name
    +'jsonb', type
    +() default
    +any privacySettings
    +Date createdAt
    +Date updatedAt
  }
  class WorkerProfile {
    +string id
    +string userId
    +User user
    +string bio
    +string phone
    +Date dateOfBirth
    +number provinceCode
    +number wardCode
    +string address
    +number latitude
    +number longitude
    +boolean isAvailable
    +'rating_avg', name
    +'decimal', type
    +3, precision
    +2, scale
    +0, default
    +number ratingAvg
    +number totalReviews
    +number totalJobsCompleted
    +WorkerSkillArray workerSkills
    +'privacy_settings', name
    +'jsonb', type
    +() default
    +any privacySettings
    +Date createdAt
    +Date updatedAt
  }
  class WorkerSkill {
    +string id
    +string workerProfileId
    +'CASCADE', onDelete
    +WorkerProfile workerProfile
    +string skillId
    +Skill skill
    +number yearsOfExperience
  }
  class Report {
    +string id
    +string reporterId
    +User reporter
    +string reportedUserId
    +User reportedUser
    +string jobId
    +Job job
    +string reason
    +string description
    +'enum', type
    +ReportStatus, enum
    +ReportStatus.PENDING, default
    +ReportStatus status
    +string adminNote
    +Date createdAt
    +Date updatedAt
  }
  class Review {
    +string id
    +string reviewerId
    +User reviewer
    +string revieweeId
    +User reviewee
    +string jobId
    +Job job
    +number rating
    +string comment
    +Date createdAt
  }
  class Skill {
    +string id
    +string name
    +string description
    +WorkerSkillArray workerSkills
    +JobSkillArray jobSkills
    +Date createdAt
  }
  class PaymentOrder {
    +string id
    +string userId
    +User user
    +'plan_code', name
    +'enum', type
    +PlanCode, enum
    +PlanCode planCode
    +number orderCode
    +number amount
    +string description
    +'enum', type
    +PaymentOrderStatus, enum
    +PaymentOrderStatus.PENDING, default
    +PaymentOrderStatus status
    +string paymentLinkId
    +string checkoutUrl
    +Date paidAt
    +Record~string, unknown~ webhookData
    +Date createdAt
    +Date updatedAt
  }
  class SubscriptionPlan {
    +string id
    +'enum', type
    +PlanCode, enum
    +true, unique
    +true, nullable
    +PlanCode | null code
    +string name
    +'enum', type
    +PlanScope, enum
    +PlanScope.EMPLOYER, default
    +PlanScope scope
    +number price
    +number maxPostsPerMonth
    +number postExpiryDays
    +number featuredPosts
    +'feature_config', name
    +'jsonb', type
    +() default
    +Record~string, boolean | number | string | null~ featureConfig
    +boolean isActive
    +Date createdAt
    +Date updatedAt
  }
  class UsageCounter {
    +string id
    +string userId
    +string featureKey
    +string periodKey
    +number count
    +Date createdAt
    +Date updatedAt
  }
  class UserSubscription {
    +string id
    +string userId
    +User user
    +string planId
    +SubscriptionPlan plan
    +Date startDate
    +Date endDate
    +'enum', type
    +SubscriptionStatus, enum
    +SubscriptionStatus.ACTIVE, default
    +SubscriptionStatus status
    +Date createdAt
    +Date updatedAt
  }
  class User {
    +string id
    +string email
    +string password
    +string firstName
    +string lastName
    +'enum', type
    +Role, enum
    +Role.USER, default
    +Role role
    +boolean isEmailVerified
    +string avatarUrl
    +'verification_level', name
    +'enum', type
    +VerificationLevel, enum
    +VerificationLevel.NONE, default
    +VerificationLevel verificationLevel
    +UserProviderArray providers
    +Date createdAt
    +Date updatedAt
    +string verificationToken
    +string resetPasswordToken
    +Date resetPasswordExpires
  }
  class EkycResult {
    +string id
    +string userId
    +User user
    +string fullName
    +string idNumber
    +string dateOfBirth
    +string gender
    +string nationality
    +string placeOfOrigin
    +string placeOfResidence
    +string expiryDate
    +string cardType
    +string documentType
    +string faceMatchResult
    +'face_match_score', name
    +'decimal', type
    +5, precision
    +2, scale
    +true, nullable
    +number faceMatchScore
    +string livenessCardResult
    +string livenessFaceResult
    +string maskedFaceResult
    +Record~string, unknown~ rawOcrPayload
    +Record~string, unknown~ rawComparePayload
    +Record~string, unknown~ rawFullPayload
    +string dataBase64
    +string dataSignature
    +boolean isSignatureValid
    +boolean isPayloadMatched
    +Date createdAt
  }
  class VerificationRequest {
    +string id
    +string userId
    +User user
    +'requested_level', name
    +'enum', type
    +VerificationLevel, enum
    +VerificationLevel requestedLevel
    +string idCardFrontUrl
    +string idCardBackUrl
    +string selfieUrl
    +string businessLicenseUrl
    +'enum', type
    +VerificationStatus, enum
    +VerificationStatus.PENDING, default
    +VerificationStatus status
    +string rejectionReason
    +string reviewedById
    +User reviewedBy
    +Date reviewedAt
    +string ekycResultId
    +EkycResult ekycResult
    +string dataSignature
    +Date createdAt
    +Date updatedAt
  }
  class WorkerServiceEntity {
    +string id
    +string workerId
    +User worker
    +string categoryId
    +JobCategory category
    +string title
    +string description
    +stringArray skillIds
    +Date startTime
    +Date endTime
    +string // e.g. "WEEKENDS", "EVENINGS" recurring
    +number price
    +'HOURLY' | 'FIXED' priceType
    +boolean isNegotiable
    +string provinceCode
    +string wardCode
    +number radiusKm
    +ServiceType type
    +stringArray portfolioUrls
    +boolean isAvailableNow
    +boolean isActive
    +Date createdAt
    +Date updatedAt
  }
  class Wallet {
    +string id
    +string userId
    +User user
    +number balance
    +Date updatedAt
  }
  class Escrow {
    +string id
    +string jobId
    +Job job
    +string employerId
    +User employer
    +string workerId
    +User worker
    +number totalAmount
    +EscrowStatus status
    +Date paidAt
    +Date releasedAt
    +MilestoneArray milestones
    +Date createdAt
  }
  class Milestone {
    +string id
    +string escrowId
    +Escrow escrow
    +string title
    +number amount
    +MilestoneStatus status
    +string submission
    +Date submittedAt
    +Date approvedAt
    +Date createdAt
  }

User "1" <-- "*" ChatSession : ManyToOne
User "1" <-- "*" SavedJob : ManyToOne
Job "1" <-- "*" SavedJob : ManyToOne
User "1" <-- "*" UserProvider : ManyToOne
JobApplication "1" <-- "*" ApplicationMessage : ManyToOne
User "1" <-- "*" ApplicationMessage : ManyToOne
Job "1" <-- "*" JobApplication : ManyToOne
User "1" <-- "*" JobApplication : ManyToOne
Job "1" <-- "*" JobAssignment : ManyToOne
User "1" <-- "*" JobAssignment : ManyToOne
JobAssignment "1" -- "1" JobApplication : OneToOne
Job "1" <-- "*" JobSkill : ManyToOne
Skill "1" <-- "*" JobSkill : ManyToOne
User "1" <-- "*" Job : ManyToOne
JobCategory "1" <-- "*" Job : ManyToOne
Job "1" --> "*" JobSkill : OneToMany
Job "1" --> "*" JobApplication : OneToMany
User "1" <-- "*" Notification : ManyToOne
Job "1" <-- "*" Dispute : ManyToOne
User "1" <-- "*" Dispute : ManyToOne
Job "1" <-- "*" PaymentConfirmation : ManyToOne
User "1" <-- "*" PaymentConfirmation : ManyToOne
EmployerProfile "1" -- "1" User : OneToOne
WorkerProfile "1" -- "1" User : OneToOne
WorkerProfile "1" --> "*" WorkerSkill : OneToMany
WorkerProfile "1" <-- "*" WorkerSkill : ManyToOne
Skill "1" <-- "*" WorkerSkill : ManyToOne
User "1" <-- "*" Report : ManyToOne
Job "1" <-- "*" Report : ManyToOne
User "1" <-- "*" Review : ManyToOne
Job "1" <-- "*" Review : ManyToOne
Skill "1" --> "*" WorkerSkill : OneToMany
Skill "1" --> "*" JobSkill : OneToMany
User "1" <-- "*" PaymentOrder : ManyToOne
User "1" <-- "*" UserSubscription : ManyToOne
SubscriptionPlan "1" <-- "*" UserSubscription : ManyToOne
User "1" --> "*" UserProvider : OneToMany
User "1" <-- "*" EkycResult : ManyToOne
User "1" <-- "*" VerificationRequest : ManyToOne
VerificationRequest "1" -- "1" EkycResult : OneToOne
User "1" <-- "*" WorkerServiceEntity : ManyToOne
JobCategory "1" <-- "*" WorkerServiceEntity : ManyToOne
User "1" -- "1" Wallet : OneToOne
Job "1" -- "1" Escrow : OneToOne
Escrow "1" --> "*" Milestone : OneToMany
User "1" <-- "*" Escrow : ManyToOne
```
