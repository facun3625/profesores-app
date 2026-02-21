FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

WORKDIR /app

FROM base AS builder

# Copy configuration files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/types ./packages/types
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/web ./apps/web

# Build the application
# We need NEXT_PUBLIC_API_URL during build time for Next.js to embed it if used in SSG/ISR
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN pnpm --filter web build

FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy standalone build
# In monorepos, Next.js standalone includes the whole workspace structure
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# Important: next.js expects server.js to be in the folder apps/web inside standalone
# but we are running it from /app.
# We might need to adjust the CMD if server.js is not in the root.

EXPOSE 3000

ENV PORT=3000

# Command to run the application
# In monorepos, server.js is located inside the app's directory within standalone
CMD ["node", "apps/web/server.js"]
