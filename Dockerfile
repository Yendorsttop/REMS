FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig*.json .prettierrc.json ./
COPY apps ./apps
COPY packages ./packages
RUN find apps packages -type f -name '*.tsbuildinfo' -exec rm -f {} + \
 && find apps packages -type d \( -name dist -o -name .next -o -name .cache \) -prune -exec rm -rf {} + \
 && pnpm install --frozen-lockfile \
 && pnpm --filter @rems/database prisma:generate \
 && pnpm --filter @rems/config build \
 && pnpm --filter @rems/contracts build \
 && pnpm --filter @rems/observability build \
 && pnpm --filter @rems/red-001 build \
 && pnpm --filter @rems/database build \
 && for package in config contracts observability red-001 database; do \
      test -s "packages/$package/dist/index.js" \
      && test -s "packages/$package/dist/index.d.ts" \
      || { echo "missing required workspace output: @rems/$package/dist/index.js or index.d.ts" >&2; exit 1; }; \
    done \
 && pnpm --filter @rems/api build \
 && pnpm --filter @rems/web build \
 && find /app -type f \( -name '*.test.ts' -o -name '*.map' \) -delete \
 && find /app -type d \( -name .cache -o -name coverage \) -prune -exec rm -rf '{}' + \
 && pnpm --filter @rems/api deploy --prod /prod/api \
 && source_prisma_client="$(find /app/node_modules/.pnpm -path '*/node_modules/.prisma/client' -type d -print -quit)" \
 && target_prisma_package="$(find /prod/api/node_modules/.pnpm -path '*/node_modules/@prisma/client' -type d -print -quit)" \
 && test -n "$source_prisma_client" -a -n "$target_prisma_package" \
 && target_prisma_modules="$(dirname "$(dirname "$target_prisma_package")")" \
 && mkdir -p "$target_prisma_modules/.prisma" \
 && staged_prisma_client="$target_prisma_modules/.prisma/client.generated" \
 && rm -rf "$staged_prisma_client" \
 && cp -R "$source_prisma_client" "$staged_prisma_client" \
 && test -s "$staged_prisma_client/schema.prisma" \
 && test -s "$staged_prisma_client/default.js" \
 && test -s "$staged_prisma_client/index.js" \
 && test -n "$(find "$staged_prisma_client" -maxdepth 1 -type f -name 'libquery_engine-*.so.node' -print -quit)" \
 && rm -rf "$target_prisma_modules/.prisma/client" \
 && mv "$staged_prisma_client" "$target_prisma_modules/.prisma/client" \
 && test ! -e "$target_prisma_modules/.prisma/client/client" \
 && test -s "$target_prisma_modules/.prisma/client/schema.prisma" \
 && test -s "$target_prisma_modules/.prisma/client/default.js" \
 && test -n "$(find "$target_prisma_modules/.prisma/client" -maxdepth 1 -type f -name 'libquery_engine-*.so.node' -print -quit)" \
 && for pattern in typescript browserslist acorn webpack prettier prisma; do \
      test -z "$(find /prod/api/node_modules/.pnpm -mindepth 1 -maxdepth 1 -type d -name "$pattern@*" -print -quit)" \
      || { echo "prohibited build package present in API deployment: $pattern" >&2; exit 1; }; \
    done \
 && find /prod/api -type f \( -name '*.map' -o -name '*.ts' \) -delete \
 && test -s /prod/api/dist/main.js \
 && cd /prod/api \
 && node -e "Promise.all([import('@rems/config'),import('@rems/database'),import('@rems/observability'),import('@rems/red-001')]).then(([,database])=>new database.PrismaService())"

FROM node:22-alpine AS api
RUN apk add --no-cache wget \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-v1.22.22 \
 && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
      /usr/local/bin/pnpm /usr/local/bin/pnpx /usr/local/bin/yarn /usr/local/bin/yarnpkg
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /prod/api /app
USER node
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:3001/health/ready || exit 1
CMD ["node","dist/main.js"]

FROM node:22-alpine AS web
RUN apk add --no-cache wget && corepack enable
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build --chown=node:node /app/apps/web/package.json ./apps/web/package.json
COPY --from=build --chown=node:node /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=build --chown=node:node /app/apps/web/.next ./apps/web/.next
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:3000/ || exit 1
CMD ["pnpm","--filter","@rems/web","start"]

FROM node:22-alpine AS migration
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app /app
USER node
CMD ["sh","-c","test -n \"$MIGRATION_DATABASE_URL\" && DATABASE_URL=\"$MIGRATION_DATABASE_URL\" pnpm --filter @rems/database prisma:migrate:deploy"]

# Render builds the final stage. REMS_TARGET is a non-secret build selector; each
# Blueprint service selects one of the governed targets above.
ARG REMS_TARGET=api
FROM ${REMS_TARGET} AS runtime
