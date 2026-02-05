FROM node:18-alpine

# نصب ابزارهای لازم برای build
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application files
COPY server.js ./

# Expose port
EXPOSE 8000

# Set environment variable for port
ENV PORT=8000

# Health check - برای Client API باید متفاوت باشه چون webhook نداریم
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
  CMD ps aux | grep -v grep | grep "node server.js" || exit 1

# Start the application
CMD ["node", "server.js"]
