CREATE TYPE "IdentityStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');
CREATE TYPE "OrganizationUnitKind" AS ENUM ('ORGANIZATION', 'DEPARTMENT', 'TEAM');
CREATE TYPE "OrganizationRole" AS ENUM ('FOUNDER', 'EXECUTIVE', 'MANAGER', 'MEMBER');
CREATE TABLE "ExecutiveIdentity" ("id" VARCHAR(64) PRIMARY KEY,"displayName" VARCHAR(120) NOT NULL,"status" "IdentityStatus" NOT NULL DEFAULT 'ACTIVE',"externalSubject" VARCHAR(255),"createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMPTZ(6) NOT NULL);
CREATE UNIQUE INDEX "ExecutiveIdentity_externalSubject_key" ON "ExecutiveIdentity"("externalSubject");
CREATE TABLE "OrganizationUnit" ("id" VARCHAR(64) PRIMARY KEY,"name" VARCHAR(120) NOT NULL,"kind" "OrganizationUnitKind" NOT NULL,"parentId" VARCHAR(64));
ALTER TABLE "OrganizationUnit" ADD CONSTRAINT "OrganizationUnit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OrganizationUnit"("id") ON DELETE RESTRICT;
CREATE TABLE "Membership" ("id" VARCHAR(64) PRIMARY KEY,"executiveId" VARCHAR(64) NOT NULL,"unitId" VARCHAR(64) NOT NULL,"role" "OrganizationRole" NOT NULL,"managerExecutiveId" VARCHAR(64));
CREATE UNIQUE INDEX "Membership_executiveId_unitId_role_key" ON "Membership"("executiveId","unitId","role");
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_executiveId_fkey" FOREIGN KEY ("executiveId") REFERENCES "ExecutiveIdentity"("id") ON DELETE RESTRICT;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "OrganizationUnit"("id") ON DELETE RESTRICT;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_managerExecutiveId_fkey" FOREIGN KEY ("managerExecutiveId") REFERENCES "ExecutiveIdentity"("id") ON DELETE RESTRICT;
CREATE TABLE "PermissionAssignment" ("id" VARCHAR(64) PRIMARY KEY,"executiveId" VARCHAR(64) NOT NULL,"permission" VARCHAR(160) NOT NULL,"organizationUnitId" VARCHAR(64));
CREATE UNIQUE INDEX "PermissionAssignment_scope_key" ON "PermissionAssignment"("executiveId","permission","organizationUnitId");
ALTER TABLE "PermissionAssignment" ADD CONSTRAINT "PermissionAssignment_executiveId_fkey" FOREIGN KEY ("executiveId") REFERENCES "ExecutiveIdentity"("id") ON DELETE RESTRICT;
ALTER TABLE "PermissionAssignment" ADD CONSTRAINT "PermissionAssignment_organizationUnitId_fkey" FOREIGN KEY ("organizationUnitId") REFERENCES "OrganizationUnit"("id") ON DELETE RESTRICT;
CREATE TABLE "AuditEvent" ("id" UUID PRIMARY KEY,"occurredAt" TIMESTAMPTZ(6) NOT NULL,"actorId" VARCHAR(64) NOT NULL,"type" VARCHAR(160) NOT NULL,"subjectId" VARCHAR(64) NOT NULL,"payload" JSONB NOT NULL);
CREATE INDEX "AuditEvent_subjectId_occurredAt_idx" ON "AuditEvent"("subjectId","occurredAt");
-- Database-level audit immutability and production role grants are intentionally pending Founder-approved security policy.
