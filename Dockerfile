# Use Node.js LTS version
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application files
COPY src/ ./src/
COPY public/ ./public/

# Create directory for state file
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Set environment variable for state file location
ENV STATE_FILE=/app/data/state.json

# Start the application
CMD ["node", "src/index.js"]
