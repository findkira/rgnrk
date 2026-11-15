
FROM node:22-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y \
    git ffmpeg libwebp-dev build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g yarn

RUN git clone https://github.com/souravkl11/raganork-md .

RUN yarn install --ignore-engines

CMD ["sh", "-c", "printf 'SESSION=%s\\nHANDLERS=%s\\n' \"$SESSION\" \"${HANDLERS:-.,}\" > config.env && node index.js"]
