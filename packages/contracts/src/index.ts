export interface ErrorResponse {
  readonly statusCode: number;
  readonly message: string;
}
export interface ExecutiveIdentityResponse {
  readonly id: string;
  readonly displayName: string;
  readonly status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  readonly externalSubject?: string;
}
export interface CreateExecutiveIdentityRequest {
  readonly id: string;
  readonly displayName: string;
  readonly externalSubject?: string;
}
