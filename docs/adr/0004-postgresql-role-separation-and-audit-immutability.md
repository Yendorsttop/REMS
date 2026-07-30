# ADR-0004: PostgreSQL role separation and audit-event immutability

- Status: Accepted
- Date: 2026-07-30

## Context

FIP-005C requires database-enforced least privilege without confusing an append-only runtime grant model with absolute resistance to privileged PostgreSQL administration. Cluster role creation and database connection grants require authority that ordinary Prisma migrations must not receive.

## Decision

Use four separated PostgreSQL login roles: `rems_migration_owner`, `rems_application`, `rems_audit_reader`, and `rems_emergency_admin`. Administrative bootstrap SQL creates roles without passwords and grants database/schema bootstrap authority. Approved secret provisioning is external. Prisma migrations run as the migration owner, so it—not the running application—owns approved objects.

The application receives schema usage; operational-table `SELECT`, `INSERT`, `UPDATE`, and `DELETE`; sequence usage; and only `SELECT` and `INSERT` on `AuditEvent`. The audit reader receives only schema usage and `SELECT` on `AuditEvent`. Both roles are explicitly denied audit `UPDATE`, `DELETE`, and `TRUNCATE`; the reader is also denied `INSERT`. Corrections are new compensating events rather than mutation of existing events.

The emergency administrator is non-superuser, does not inherit owner power automatically, and may explicitly `SET ROLE` to the migration owner for documented, Founder-authorized recovery. PostgreSQL superusers, object owners, and sufficiently privileged administrators remain technically capable of alteration. Governance, access controls, and external evidence—not a false technical claim—control that exceptional authority.

## Consequences

Role bootstrap is a prerequisite separate from application migrations. For an upgrade, the administrative bootstrap transfers objects created by the immutable foundation migration to the migration owner; for a fresh database that transfer is a no-op and all migrations run as the owner. CI exercises both paths and then connects tests as the restricted application and reader roles. The required order is bootstrap, migration as owner, then application startup. Production role credentials, host selection, provisioning execution, emergency-access records, deployment, and operational evidence remain outstanding. This decision does not configure OIDC, infrastructure, backups, or monitoring and does not establish operational certification.
