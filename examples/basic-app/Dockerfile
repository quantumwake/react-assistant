FROM node:22-slim

# ── 1. Build the library ──
WORKDIR /repo
COPY package.json tsup.config.ts tsconfig.json ./
COPY src ./src
RUN npm install && npm run build

# ── 2. Build the example app ──
# Place it so that file:../../ resolves to /repo
WORKDIR /repo/examples/basic-app
COPY examples/basic-app/package.json ./
RUN npm install
COPY examples/basic-app/ ./

EXPOSE 5173
CMD ["npx", "vite", "--host", "0.0.0.0"]
