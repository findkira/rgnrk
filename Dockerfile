
FROM node:22-bookworm

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    ffmpeg \
    libwebp-dev \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Enable Yarn through Corepack
RUN corepack enable

# Clone original repository
RUN git clone --depth 1 \
    https://github.com/souravkl11/raganork-md.git .

# Install dependencies
RUN yarn install --ignore-engines

# Install Express for web server
RUN yarn add express

# Create temporary directory
RUN mkdir -p temp

# Copy web server
COPY server.js /app/server.js

ENV NODE_ENV=production
ENV TZ=Asia/Kolkata

EXPOSE 10000

CMD ["sh", "-c", "printf 'SESSION=%s\\nHANDLERS=%s\\n' \"$SESSION\" \"${HANDLERS:-.,}\" > config.env && node server.js"]
