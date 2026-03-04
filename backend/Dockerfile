# Build stage: compile TypeScript
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx tsc --outDir dist --skipLibCheck

# Production stage
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
# Multer and S3 need writable uploads dir at runtime (or use volume)
RUN mkdir -p uploads profile-images
EXPOSE 3001
CMD ["node", "dist/server.js"]
