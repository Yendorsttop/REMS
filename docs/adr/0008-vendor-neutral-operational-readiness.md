# ADR 0008: Vendor-neutral operational readiness boundaries

## Status

Founder-approved repository implementation; production operational certification is pending.

## Decision

REMS keeps release migration, Founder bootstrap, identity administration, API, web, security/audit reading, backup, and restoration as separate processes and credentials. The API startup validator fails closed in production and accepts only a PostgreSQL URL whose username is `rems_application`; it validates HTTPS OIDC issuer, audience, asymmetric signing algorithms, host, port, and bounded proxy hops without echoing secrets.

`/health/live` reports only process life. `/health/ready` reports only `ready` or `unavailable`, checks database usability, and is withdrawn when shutdown starts. Nest shutdown hooks close Prisma gracefully. Structured request logs contain bounded correlation ID, method, path, and status; credential, authorization, cookie, claims, link, and token material is excluded or redacted.

The API, web, and migration images are separate multi-stage targets and run as non-root. Migration is an explicit release operation before application startup. The additive `rems_backup` login is non-owner, non-superuser, read-only, and receives SELECT plus schema usage only. It can read sensitive REMS data, so its credential requires custody separate from runtime and restoration authority. Restore uses migration/restoration authority, then administrative grant bootstrap is reapplied and inspected.

Native PostgreSQL custom-format dump/restore remains vendor-neutral. Disposable CI restoration checks representative RED-001, link, business-audit, security-evidence, ownership, and privilege state. SBOM and vulnerability results are review evidence, never proof that vulnerabilities are absent.

## Consequences and limitations

Hosting, PostgreSQL service, OIDC provider, log/monitoring destination, alerts, retention, recovery objectives, backup scheduling/media, credential custody, and deployment remain Founder decisions. CI exercises disposable infrastructure only. Founder-bootstrap `NOLOGIN` is cluster role state and is deliberately reapplied/verified by the operational procedure rather than encoded in a portable database dump. No production operation or certification is claimed.
