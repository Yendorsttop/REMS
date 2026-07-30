FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig*.json .prettierrc.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile && pnpm --filter @rems/database prisma:generate && pnpm build \
 && find /app -type f \( -name '*.test.ts' -o -name '*.map' \) -delete \
 && find /app -type d \( -name .cache -o -name coverage \) -prune -exec rm -rf '{}' +

FROM node:22-alpine AS api
RUN apk add --no-cache wget && corepack enable
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /app/packages ./packages
RUN find packages -type f ! -path '*/dist/*' ! -name package.json -delete && find packages -type d -empty -delete
USER node
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:3001/health/ready || exit 1
CMD ["pnpm","--filter","@rems/api","exec","node","dist/main.js"]

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
