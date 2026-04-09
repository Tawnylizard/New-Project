FROM node:22-alpine AS base
WORKDIR /app

# ─── dependencies ────────────────────────────────────────────────────────────
FROM base AS deps
COPY package*.json ./
COPY apps/tma/package*.json ./apps/tma/
COPY packages/shared/package*.json ./packages/shared/
RUN npm install --workspaces --include-workspace-root

# ─── development ─────────────────────────────────────────────────────────────
FROM deps AS development
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--workspace=apps/tma", "--", "--host", "0.0.0.0"]

# ─── builder ─────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY . .
ARG VITE_API_URL
ARG VITE_BOT_USERNAME
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_BOT_USERNAME=$VITE_BOT_USERNAME
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/tma

# ─── production (nginx) ──────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS production

COPY --from=builder /app/apps/tma/dist /usr/share/nginx/html

# SPA routing: all paths → index.html
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  index index.html;\n  location / {\n    try_files $uri $uri/ /index.html;\n  }\n}\n' \
    > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
