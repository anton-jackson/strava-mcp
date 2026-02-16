FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built application and config files
COPY dist/ ./dist/
COPY zones.config.json ./zones.config.json

# .env is NOT baked into the image — mount at runtime or pass env vars
# Required env vars: STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET,
# STRAVA_REFRESH_TOKEN, STRAVA_ACCESS_TOKEN, MCP_API_KEY

ENV NODE_ENV=production

EXPOSE 3000

# Use the HTTP entry point for remote deployment
CMD ["node", "dist/http-server.js"]
