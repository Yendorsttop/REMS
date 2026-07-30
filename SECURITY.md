# Security Policy

Report vulnerabilities privately to the repository maintainers; do not open a public exploit report. Never commit credentials, tokens, personal data, production secrets, or fabricated organizational data. Use environment injection and secret managers in approved deployments. Production OIDC verification remains pending. The actor-header development seam must not be exposed as production authentication.

## PostgreSQL authority

`packages/database/security/bootstrap-roles.sql` separates migration ownership, application runtime, audit reading, and emergency administration. The required order is administrative bootstrap, credential injection outside source control, Prisma migration as `rems_migration_owner`, and only then application startup as `rems_application`. When upgrading a database with pre-FIP-005C objects, the administrator reruns the bootstrap to transfer those existing objects before migration. Never use the migration or emergency credential at runtime. `rems_audit_reader` is limited to audit reads.

Runtime grants make `AuditEvent` append-only for the application and read-only for the audit reader. Corrections must be new compensating events. These grants do not and cannot make a PostgreSQL superuser, object owner, or appropriately privileged emergency administrator technically incapable of alteration. Emergency recovery requires documented Founder authorization. Production provisioning, credential custody, deployment verification, and emergency-access evidence are not supplied by repository or CI artifacts.
