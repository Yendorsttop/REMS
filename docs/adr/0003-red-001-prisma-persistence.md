# ADR-0003: RED-001 Prisma persistence and transaction boundary

- Status: Accepted
- Date: 2026-07-30

## Context

FIP-005B requires production-capable PostgreSQL persistence without moving RED-001 policy or vocabulary out of its constitutional boundary. A governed command changes an authoritative record and appends its audit event; allowing either write to commit alone would leave incomplete decision evidence.

## Decision

Implement RED-001 persistence ports in `packages/database` with Prisma. A transaction context uses Prisma interactive transactions and asynchronous context propagation so repository, authorization, and audit operations in one RED-001 command share one database transaction. NestJS injects these adapters into `Red001Service`. In-memory adapters remain test doubles for isolated domain, service, and HTTP tests.

PostgreSQL foreign keys continue to use restrictive deletion for organizational hierarchy, memberships, reporting relationships, and permission assignments. Audit events are inserted through an append-only application port.

## Consequences

The application now requires a migrated PostgreSQL database and externally provisioned initial executive authority before governed commands can be authorized. This milestone does not choose a hosting provider, define production database-role grants, configure OIDC, or establish database-enforced audit immutability. Those controls remain subject to Founder approval and future executable evidence.
