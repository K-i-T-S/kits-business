# Use Node.js 20 as base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with timeout and cache optimization
RUN npm install --production --silent --no-audit --no-fund

# Copy source code
COPY . .

# Expose port 5173
EXPOSE 5173

# Start the application in development mode
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
