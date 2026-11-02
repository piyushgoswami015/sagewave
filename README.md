---
title: Sagewave Audio Studio
emoji: 🌿
colorFrom: green
colorTo: yellow
sdk: docker
app_port: 3000
pinned: false
---

# Sagewave — AI Stem Separator, Audio Mastering & Creator Backup Studio

Sagewave is a Next.js 15 studio suite featuring:
- **AI Stem & Instrumental Studio**: 4-stem neural separation (`htdemucs`) into Instrumental, Vocals, Drums, Bass & Melody at 320 kbps MP3.
- **Creator Audio Extractor**: Demux and encode 320 kbps CBR MP3 (44.1 kHz) from published social clips.
- **Creator Clip Archiver**: Losslessly remux DASH video + AAC audio into MP4.
- **Google OAuth + Email/Password Authentication** with NextAuth, per-user rate limiting, and 60-minute auto-purge privacy.

## Environment Variables
Copy `.env.example` to `.env.local` (or set as Secrets in your hosting provider):
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL` (your live HTTPS URL, e.g. `https://yourdomain.com`)
