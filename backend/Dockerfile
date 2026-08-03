FROM node:20-alpine AS base

WORKDIR /app

RUN npm i -g pnpm@10.34.5

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma

RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src

RUN pnpm exec prisma generate && pnpm build

EXPOSE 4000

CMD ["sh", "-c", "pnpm db:migrate:deploy && pnpm seed:google-config:docker && node dist/server.js"]
