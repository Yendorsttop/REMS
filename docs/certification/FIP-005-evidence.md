# FIP-005 Certification Evidence

## Evidence scope

The repository contains executable RED-001 domain policy, Prisma/PostgreSQL persistence adapters, isolated-test in-memory adapters, transactional REST composition, a web foundation, container descriptors, and CI checks. CI commands are the reproducible evidence index; their results are recorded by the commit's workflow run.

Database validation is a required part of that evidence. The initial PR #2 workflow exposed invalid one-line `generator`, `datasource`, and `enum` blocks in the Prisma schema; the schema has been corrected to Prisma's multiline syntax rather than bypassing validation. A passing workflow for the corrected commit is the authoritative CI result.

FIP-005B integration evidence covers identities, organization/department/team hierarchy, memberships, roles, reporting relationships, scoped permissions, audit-event inserts, command rollback when audit insertion fails, and restrictive foreign-key deletion. The integration suite runs only when `DATABASE_URL` identifies a migrated PostgreSQL test database; a skipped suite is not passing database evidence.

## Required limitations

- In-memory adapters are isolated test doubles and are not application persistence.
- Prisma adapters are production-capable code, but do not prove a production deployment or approved database configuration.
- Application-level append-only audit behavior is not database-enforced immutability.
- Production database-role grants remain pending Founder-approved security policy.
- Production OIDC verification remains unconfigured; the interface and OpenAPI security declaration are compatibility seams only.
- Docker and deployment descriptors are artifacts, not evidence of a production deployment.
- Operational certification cannot be claimed while required integrations or executable checks remain incomplete.

## Certification status

**FIP-005B implementation evidence available; operational certification not claimed.** Passing PostgreSQL integration tests support persistence implementation review. Founder approval and verified production hosting, database roles, audit immutability policy, OIDC, security controls, deployment evidence, and all executable checks are prerequisites to any later operational claim.
