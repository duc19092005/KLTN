FROM node:22-alpine AS base
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm run build

FROM builder AS development
RUN apk add --no-cache postgresql16-client

FROM base AS prod-deps
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev \
  && npx prisma generate \
  && npm cache clean --force

FROM base AS production
ENV NODE_ENV=production \
  PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1

RUN apk add --no-cache curl postgresql16-client \
  && addgroup -S appgroup -g 1001 \
  && adduser -S appuser -u 1001 -G appgroup

COPY --from=prod-deps --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/prisma ./prisma
COPY --from=builder --chown=appuser:appgroup /app/package*.json ./

USER appuser
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -fsS http://localhost:${PORT:-3001}/api/health || exit 1

CMD ["npm", "run", "start:prod"]

