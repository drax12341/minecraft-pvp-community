FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY config ./config
COPY discord ./discord
COPY server ./server
COPY data/results.json data/testing.json ./data/
CMD ["node", "server/runtime.mjs"]
