FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY test ./test
RUN npm test

FROM node:24-alpine AS runtime

LABEL org.opencontainers.image.title="SavePinner MCP" \
      org.opencontainers.image.description="Local MCP tools for parsing, validating, and normalizing Pinterest URLs" \
      org.opencontainers.image.url="https://savepinner.com" \
      org.opencontainers.image.source="https://github.com/jiankn/savepinner-mcp" \
      org.opencontainers.image.licenses="MIT"

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=build /app/dist ./dist

USER node
ENTRYPOINT ["node", "dist/index.js"]
