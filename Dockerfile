FROM node:18-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built application
COPY dist/ ./dist/

# Set environment variables
ENV NODE_ENV=production

# Expose the server port
EXPOSE 3000

# Start the server
CMD ["node", "dist/index.js"]
