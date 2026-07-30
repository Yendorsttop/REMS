# Contributing

Use pnpm, conventional commits, and synthetic fixtures only. Changes to domain ownership or cross-module dependencies require an ADR and Founder review. Never make another package authoritative for RED-001 concepts. Run `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm db:validate`, `pnpm test`, `pnpm build`, `pnpm test:e2e`, and `git diff --check` before review. Specifications and passing local tests are evidence, not certification.
