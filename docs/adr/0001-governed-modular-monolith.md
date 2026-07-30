# ADR-0001: Governed modular monolith

- Status: Accepted
- Date: 2026-07-29

## Context

REMS requires independently governed constitutional domains without premature distributed-system complexity. RED-001 exclusively owns executive identity and organizational authority.

## Decision

Use a TypeScript/pnpm modular monolith. `packages/red-001` contains domain and application policy behind repository, authorization, identity-provider, and audit ports. NestJS exposes REST/OpenAPI; Next.js supplies the web foundation; PostgreSQL artifacts are expressed with Prisma. Imports and automated boundary checks prevent other modules from redefining RED-001 concepts.

## Consequences

Modules deploy together initially but communicate through explicit contracts and ports. A future extraction must preserve ownership and be approved through a new ADR. This decision is architecture, not operational certification.
