FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build
FROM node:22-alpine AS api
RUN corepack enable
WORKDIR /app
COPY --from=build /app /app
EXPOSE 3001
CMD ["pnpm","--filter","@rems/api","exec","node","dist/main.js"]
FROM node:22-alpine AS web
RUN corepack enable
WORKDIR /app
COPY --from=build /app /app
EXPOSE 3000
CMD ["pnpm","--filter","@rems/web","start"]
