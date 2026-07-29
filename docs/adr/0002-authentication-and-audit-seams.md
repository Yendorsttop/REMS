# ADR-0002: Authentication and audit seams

- Status: Accepted
- Date: 2026-07-29

## Decision

Define an OIDC/OAuth-compatible identity-provider port and keep business authorization inside RED-001. Local HTTP composition accepts an actor header only as a non-production seam. Production token verification, issuer/audience configuration, key rotation, and claim mapping are unconfigured.

Audit writes use an append-only application port. The in-memory adapter never mutates emitted event objects, but application-level append-only behavior is not database-enforced immutability. Database triggers, retention, archival, and production role grants require Founder-approved policy.
