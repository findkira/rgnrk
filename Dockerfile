
FROM node:22-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y \
    git \
    curl \
    ffmpeg \
    libwebp-dev \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable

RUN git clone --depth 1 \
    https://github.com/souravkl11/raganork-md.git .

RUN yarn install --ignore-engines

RUN mkdir -p temp

ENV NODE_ENV=production
ENV TZ=Asia/Kolkata
ENV PORT=10000

EXPOSE 10000

CMD ["sh", "-c", "printf 'SESSION=%s\\nHANDLERS=%s\\n' \"$SESSION\" \"${HANDLERS:-.,}\" > config.env && node index.js"]
