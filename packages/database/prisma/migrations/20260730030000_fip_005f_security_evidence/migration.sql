-- FIP-005F system-security evidence is deliberately separate from RED-001 AuditEvent.
CREATE TABLE "SystemSecurityEvidence" (
  "id" UUID NOT NULL,
  "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "eventType" VARCHAR(64) NOT NULL,
  "outcome" VARCHAR(32) NOT NULL,
  "reasonCode" VARCHAR(64) NOT NULL,
  "correlationId" VARCHAR(128) NOT NULL,
  CONSTRAINT "SystemSecurityEvidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SystemSecurityEvidence_event_type_check" CHECK ("eventType" IN ('AUTHENTICATION_REJECTED','AUTHORITY_ELEVATION_REJECTED')),
  CONSTRAINT "SystemSecurityEvidence_outcome_check" CHECK ("outcome" = 'DENIED'),
  CONSTRAINT "SystemSecurityEvidence_reason_check" CHECK ("reasonCode" IN ('MISSING_BEARER_TOKEN','MALFORMED_TOKEN','INVALID_SIGNATURE','UNKNOWN_SIGNING_KEY','DISALLOWED_ALGORITHM','WRONG_ISSUER','WRONG_AUDIENCE','EXPIRED_TOKEN','FUTURE_NOT_BEFORE','MISSING_SUBJECT','UNKNOWN_OR_UNLINKED_SUBJECT','INACTIVE_LINK','INACTIVE_EXECUTIVE_IDENTITY','SUSPENDED_EXECUTIVE_IDENTITY','PROVIDER_AUTHORITY_ELEVATION','VERIFICATION_NOT_CONFIGURED','OTHER_GOVERNED_REJECTION'))
);
CREATE INDEX "SystemSecurityEvidence_occurredAt_idx" ON "SystemSecurityEvidence"("occurredAt");
CREATE INDEX "SystemSecurityEvidence_correlationId_idx" ON "SystemSecurityEvidence"("correlationId");
ALTER TABLE "SystemSecurityEvidence" OWNER TO rems_migration_owner;
REVOKE ALL ON TABLE "SystemSecurityEvidence" FROM PUBLIC, rems_application, rems_audit_reader, rems_identity_admin, rems_founder_bootstrap;
GRANT INSERT ON TABLE "SystemSecurityEvidence" TO rems_application;
REVOKE SELECT, UPDATE, DELETE, TRUNCATE ON TABLE "SystemSecurityEvidence" FROM rems_application;
