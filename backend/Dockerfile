FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy prisma schema
COPY prisma ./prisma/

# Generate Prisma client
RUN npx prisma generate

# Copy source
COPY src ./src/

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 3001

# Start with migration and seed
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
