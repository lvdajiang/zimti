FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# 安装依赖
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/
RUN pnpm install --frozen-lockfile

# 构建共享包
FROM deps AS build-shared
COPY packages/shared/ ./packages/shared/
RUN pnpm --filter @zimti/shared build

# 构建服务端
FROM build-shared AS build-server
COPY packages/server/ ./packages/server/
RUN pnpm --filter @zimti/server build

# 构建客户端
FROM build-server AS build-client
COPY packages/client/ ./packages/client/
RUN pnpm --filter @zimti/client build

# --- 生产镜像：Server ---
FROM node:20-alpine AS server
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

COPY --from=build-shared /app/packages/shared/dist ./packages/shared/dist
COPY --from=build-server /app/packages/server/dist ./packages/server/dist

RUN pnpm install --frozen-lockfile --prod

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "packages/server/dist/index.js"]
