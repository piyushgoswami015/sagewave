FROM node:22-bookworm-slim

# Install Python 3, FFmpeg, curl, and CA certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    curl \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install latest yt-dlp binary
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
  && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Create Python venv with Demucs AI & pre-download the htdemucs model weights at build time
RUN python3 -m venv /app/.venv \
  && /app/.venv/bin/pip install --no-cache-dir --upgrade pip \
  && /app/.venv/bin/pip install --no-cache-dir demucs soundfile \
  && /app/.venv/bin/python -c "import torch; torch.hub.load_state_dict_from_url('https://dl.fbaipublicfiles.com/demucs/hybrid_transformer/955717e8-8726e21a.th', map_location='cpu')"

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
ENV DEMUCS_PATH=/app/.venv/bin/demucs

EXPOSE 3000
CMD ["npm", "start"]
