FROM node:18-alpine

# Install eSpeak and sox for TTS
RUN apk add --no-cache espeak espeak-dev sox

# Set working directory
WORKDIR /usr/src/app

# Copy root package files
COPY package*.json ./

# Install root dependencies
RUN npm install

# Copy server package files
COPY server/package*.json ./server/

# Install server dependencies
RUN cd server && npm install

# Copy source code
COPY . .

# Ensure server dependencies are available
RUN cd server && npm install

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "run", "server:dev"]
