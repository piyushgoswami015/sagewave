FROM node:22-bookworm-slim

# Install Python 3, FFmpeg, curl, and CA certificates
# (yt-dlp requires python3 + ffmpeg; FFmpeg handles 320kbps MP3, MP4 muxing & low-RAM Studio DSP stem separation)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    ffmpeg \
    curl \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install latest yt-dlp binary
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
  && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Install Node dependencies
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# Copy application source and build Next.js
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV YTDLP_PATH=/usr/local/bin/yt-dlp
ENV FFMPEG_PATH=/usr/bin/ffmpeg

EXPOSE 3000
CMD ["npm", "start"]
