FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci --include=dev
COPY . .
# Validate both the API and compiled React frontend before deployment.
RUN npm run check && npm run build:server && npm run build
RUN mkdir -p /data && chown -R node:node /data
ENV HOST=0.0.0.0 PORT=3000 FASTFORWARD_DATA_DIR=/data FASTFORWARD_REQUIRE_POSTGRES=true
USER node
EXPOSE 3000
# Hosted records persist in Neon; /data is temporary scratch.
CMD ["npm", "run", "start:compiled"]
