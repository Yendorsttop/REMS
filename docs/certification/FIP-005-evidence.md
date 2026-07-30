# FIP-005 Certification Evidence

## Evidence scope

The repository contains executable RED-001 domain policy, Prisma/PostgreSQL persistence adapters, isolated-test in-memory adapters, transactional REST composition, a web foundation, container descriptors, and CI checks. CI commands are the reproducible evidence index; their results are recorded by the commit's workflow run.

Database validation and integration are required parts of that evidence. The initial PR #2 workflow exposed invalid one-line `generator`, `datasource`, and `enum` blocks in the Prisma schema; the schema has been corrected to Prisma's multiline syntax rather than bypassing validation. Database integration is verified only after CI provisions its disposable PostgreSQL service, waits for its health check, applies the existing Prisma migration, passes `pnpm db:validate`, and passes `RUN_DATABASE_INTEGRATION=1 pnpm test`. A passing workflow for the commit containing those checks is the authoritative CI result.

FIP-005B integration evidence covers identities, organization/department/team hierarchy, memberships, roles, reporting relationships, scoped permissions, audit-event inserts, command rollback when audit insertion fails, and restrictive foreign-key deletion. The integration suite runs only when `RUN_DATABASE_INTEGRATION=1` explicitly enables it against the migrated PostgreSQL test database identified by `DATABASE_URL`; a skipped suite is not passing database evidence.

## Required limitations

- In-memory adapters are isolated test doubles and are not application persistence.
- Prisma adapters are production-capable code, but do not prove a production deployment or approved database configuration.
- Application-level append-only audit behavior is not database-enforced immutability.
- Production database-role grants remain pending Founder-approved security policy.
- Production OIDC verification remains unconfigured; the interface and OpenAPI security declaration are compatibility seams only.
- Production hosting, credentials and secrets, backups, and monitoring remain unconfigured.
- Docker and deployment descriptors are artifacts, not evidence of a production deployment.
- Operational certification cannot be claimed while required integrations or executable checks remain incomplete.

## Certification status

**FIP-005B Prisma persistence is implemented; operational certification not claimed.** Only a successful GitHub CI run of the PostgreSQL migration, validation, and integration checks supplies operational database evidence for the reviewed commit. Founder approval and verified production hosting, credentials and secrets, database roles, audit immutability policy, OIDC, security controls, deployment, backups, monitoring, and all executable checks are prerequisites to any later operational claim.
