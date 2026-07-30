# FIP-005 Certification Evidence

## Evidence scope

The repository contains executable RED-001 domain policy, in-memory adapters, PostgreSQL/Prisma artifacts, REST/OpenAPI composition, a web foundation, container descriptors, and CI checks. CI commands are the reproducible evidence index; their results are recorded by the commit's workflow run.

Database validation is a required part of that evidence. The initial PR #2 workflow exposed invalid one-line `generator`, `datasource`, and `enum` blocks in the Prisma schema; the schema has been corrected to Prisma's multiline syntax rather than bypassing validation. A passing workflow for the corrected commit is the authoritative CI result.

## Required limitations

- In-memory adapters are not production persistence.
- Prisma schema and migrations do not prove production persistence integration.
- Application-level append-only audit behavior is not database-enforced immutability.
- Production database-role grants remain pending Founder-approved security policy.
- Production OIDC verification remains unconfigured; the interface and OpenAPI security declaration are compatibility seams only.
- Docker and deployment descriptors are artifacts, not evidence of a production deployment.
- Operational certification cannot be claimed while required integrations or executable checks remain incomplete.

## Certification status

**Foundation implemented; operational certification not claimed.** FIP-005 evidence supports repository-foundation review only. Founder approval and verified production integrations, security controls, deployment evidence, and all executable checks are prerequisites to any later operational claim.
