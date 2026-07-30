# ADR 0007: Append-only system-security evidence

## Status

Accepted for FIP-005F repository implementation; not operational certification.

## Decision

Authentication and pre-authentication rejections are security evidence, not RED-001 business
audit events. They have no executive actor; an unauthenticated request must never cause one to be
fabricated. Evidence contains only a UUID, timestamp, bounded type, `DENIED` outcome, bounded reason,
bounded correlation identifier. No free-form technical context is stored in this milestone. Email, bearer tokens,
authorization headers, passwords, secrets, complete claims, and request payloads are forbidden.

The API returns the same generic unauthorized response for every internal reason and writes no more
than one primary event per rejection. If append fails, authentication remains denied and a sanitized
operational error containing only its correlation identifier may be emitted.

PostgreSQL ownership remains `rems_migration_owner`. `rems_application` may insert only;
`rems_security_reader` may select only; Public and existing specialized roles receive no access.
Append-only does not mean absolute immutability against owners, superusers, or properly authorized
emergency administrators.

## Exclusions

Production retention, monitoring vendors, alert destinations, provisioning, and incident-response
services require future Founder decisions. Repository and CI checks do not prove those controls.
