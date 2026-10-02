# syntax=docker/dockerfile:1
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_CHAT_LIST_DEBUG
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPER_ADMIN_EMAILS
ARG NEXT_PUBLIC_WHATSAPP_LINK_PHONE_NUMBER
ENV NEXT_PUBLIC_CHAT_LIST_DEBUG=$NEXT_PUBLIC_CHAT_LIST_DEBUG
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPER_ADMIN_EMAILS=$NEXT_PUBLIC_SUPER_ADMIN_EMAILS
ENV NEXT_PUBLIC_WHATSAPP_LINK_PHONE_NUMBER=$NEXT_PUBLIC_WHATSAPP_LINK_PHONE_NUMBER
ENV NEXT_TELEMETRY_DISABLED=1
RUN --mount=type=cache,target=/app/.next/cache npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
# ca-certificates: sin ellos curl no puede verificar HTTPS (error 77) y la tarea programada
# meta-worker, que llama por https al propio ERP, fallaba en cada corrida desde el 23-sep-2026.
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node","server.js"]

