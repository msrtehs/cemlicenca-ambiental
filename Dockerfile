# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Backend + serve frontend
FROM node:20-alpine
WORKDIR /app

# Install backend dependencies
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --omit=dev

# Copy Prisma schema and generate client
COPY backend/prisma ./prisma/
RUN npx prisma generate

# Copy backend source
COPY backend/src ./src/

# Copy frontend build
COPY --from=frontend-build /app/frontend/dist ./frontend/dist/

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 3001

# Run migrations and start server
CMD ["sh", "-c", "sleep 3 && npx prisma db push --skip-generate && node src/server.js"]
