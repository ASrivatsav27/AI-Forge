# ─────────────────────────────────────────────────────────────
# Stage 1 — deps + build
# ─────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Build tools required by node-pty (native addon via node-gyp)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy manifests first for better layer-cache reuse
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL deps (devDependencies included — tsx/tsc are needed for build)
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy the rest of the source
COPY . .

# Compile TypeScript → dist/
RUN npm run build

# ─────────────────────────────────────────────────────────────
# Stage 2 — runtime
# ─────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime

WORKDIR /app

# Runtime build tools (node-pty native module needs them at runtime too)
# plus tooling required to install the official Docker CLI
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    && rm -rf /var/lib/apt/lists/*

# ── Official Docker CLI ───────────────────────────────────────
# We deliberately do NOT use the distro's docker.io package —
# that ships Docker API 1.41 on Debian/Ubuntu, which is
# incompatible with current Docker Desktop / Docker Engine
# daemons that require API 1.44+.
#
# The official Docker repo always tracks the current release.
RUN install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg \
       | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && chmod a+r /etc/apt/keyrings/docker.gpg \
    && echo \
       "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
       https://download.docker.com/linux/debian \
       $(lsb_release -cs) stable" \
       > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends docker-ce-cli \
    && rm -rf /var/lib/apt/lists/*

# ── Copy built artefacts from builder ────────────────────────
COPY --from=builder /app/dist         ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma       ./prisma

# Ensure the workspace mount-point exists inside the image.
# The actual directory is volume-mounted at runtime.
RUN mkdir -p /workspaces

EXPOSE 8000

CMD ["node", "dist/index.js"]
