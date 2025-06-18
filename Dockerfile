# Stage 1: Builder
# This stage installs all dependencies (including development ones)
# and builds the application.
FROM node:18-alpine AS builder

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to leverage Docker cache
COPY package*.json ./

# Install all dependencies
RUN npm install

# Copy the rest of the application source code
COPY . .

# Stage 2: Production
# This stage creates the final, lean production image by copying
# only the necessary files from the builder stage.
FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Copy only production dependencies from the builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy the application code and package file
COPY --from=builder /app/index.js ./index.js
COPY --from=builder /app/package.json ./package.json

# Expose the port the app runs on
EXPOSE 3000

# The command to run the application when the container starts
CMD ["node", "index.js"]
