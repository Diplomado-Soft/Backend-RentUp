FROM node:22-slim
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install
RUN mkdir -p /app/certs
COPY . .
CMD ["node", "index.js"]
