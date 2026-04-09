FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate 2>/dev/null || true

# ─── dependencies ────────────────────────────────────────────────────────────
FROM base AS deps
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/bot/package*.json ./apps/bot/
COPY packages/db/package*.json ./packages/db/
COPY packages/shared/package*.json ./packages/shared/
RUN npm install --workspaces --include-workspace-root

# ─── development ─────────────────────────────────────────────────────────────
FROM deps AS development
COPY . .
RUN npx prisma generate --schema=packages/db/schema.prisma
EXPOSE 3000
CMD ["npm", "run", "dev", "--workspace=apps/api"]

# ─── builder ─────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY . .
RUN npx prisma generate --schema=packages/db/schema.prisma
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/db
RUN npm run build --workspace=apps/api
RUN npm run build --workspace=apps/bot

# ─── production ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

# Copy only production deps
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/db/package*.json ./packages/db/
COPY packages/shared/package*.json ./packages/shared/
RUN npm install --workspaces --include-workspace-root --omit=dev

# Copy build artifacts
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/bot/dist ./apps/bot/dist
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY packages/db/schema.prisma ./packages/db/schema.prisma
COPY packages/db/migrations ./packages/db/migrations

EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]
