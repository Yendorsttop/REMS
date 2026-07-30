-- RED-001 owns the explicit, provider-neutral association between a verified
-- OIDC (issuer, subject) pair and an executive identity.
CREATE TABLE "ExternalIdentityLink" (
  "id" UUID PRIMARY KEY,
  "issuer" VARCHAR(500) NOT NULL,
  "subject" VARCHAR(255) NOT NULL,
  "executiveId" VARCHAR(64) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL
);
CREATE UNIQUE INDEX "ExternalIdentityLink_issuer_subject_key" ON "ExternalIdentityLink"("issuer", "subject");
CREATE INDEX "ExternalIdentityLink_executiveId_idx" ON "ExternalIdentityLink"("executiveId");
ALTER TABLE "ExternalIdentityLink" ADD CONSTRAINT "ExternalIdentityLink_executiveId_fkey"
  FOREIGN KEY ("executiveId") REFERENCES "ExecutiveIdentity"("id") ON DELETE RESTRICT;

ALTER TABLE "ExternalIdentityLink" OWNER TO rems_migration_owner;
GRANT SELECT ON TABLE "ExternalIdentityLink" TO rems_application;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE "ExternalIdentityLink" FROM rems_application;
REVOKE ALL ON TABLE "ExternalIdentityLink" FROM rems_audit_reader;
