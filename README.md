# REP Entertainment Management System (REMS)

REMS is a Founder-governed modular monolith. FIP-005 establishes the RED-001 repository foundation: the exclusive authority for executive identities, organizational hierarchy, memberships, reporting relationships, roles, permissions, business authorization context, and identity-based organizational participation.

## Workspace

- `apps/api`: NestJS REST API and generated OpenAPI UI/JSON
- `apps/web`: Next.js governance-console foundation
- `packages/red-001`: authoritative domain and application boundary
- `packages/database`: Prisma schema and migration artifacts
- `packages/contracts`, `config`, `observability`, `testing`: shared non-authoritative capabilities
- `docs`: ADRs, constitutional traceability, and evidence limitations

## Local verification

Requires Node.js 22 and pnpm 9. `corepack enable && pnpm install`, then run the commands in `CONTRIBUTING.md`. Copy `.env.example` only for local Compose use.

## Status

Foundation implemented; operational certification is not claimed. See `docs/certification/FIP-005-evidence.md` for precise limitations.
