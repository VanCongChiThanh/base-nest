export enum PrivacyVisibility {
  PUBLIC = 'PUBLIC',
  ACCEPTED_ONLY = 'ACCEPTED_ONLY',
  PRIVATE = 'PRIVATE',
}

export interface WorkerPrivacySettings {
  phone: PrivacyVisibility;
  address: PrivacyVisibility;
  dateOfBirth: PrivacyVisibility;
  location: PrivacyVisibility;
}

export interface EmployerPrivacySettings {
  phone: PrivacyVisibility;
  address: PrivacyVisibility;
  companyDescription: PrivacyVisibility;
}

export const DEFAULT_WORKER_PRIVACY: WorkerPrivacySettings = {
  phone: PrivacyVisibility.ACCEPTED_ONLY,
  address: PrivacyVisibility.ACCEPTED_ONLY,
  dateOfBirth: PrivacyVisibility.PRIVATE,
  location: PrivacyVisibility.PUBLIC,
};

export const DEFAULT_EMPLOYER_PRIVACY: EmployerPrivacySettings = {
  phone: PrivacyVisibility.ACCEPTED_ONLY,
  address: PrivacyVisibility.PUBLIC,
  companyDescription: PrivacyVisibility.PUBLIC,
};
