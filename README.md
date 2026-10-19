# ⚡ Whisper Voice AI (Serverless + Turso Edge DB + Groq)

Ultra-fast, lightweight, and modern Speech-to-Text web application powered by **OpenAI Whisper Large V3 Turbo (via Groq LPU)** and **Turso SQLite Edge Database**. Built with **Next.js (App Router)** and **Tailwind CSS**.

Deployable to **Vercel** with zero-configuration! 🚀

---

## 🌟 Key Features

- **⚡ Blazing Fast Transcription**: Powered by Groq's LPU running `whisper-large-v3-turbo` in **~150-250ms**.
- **👥 Multi-Speaker Support**: Tag and separate transcriptions by Speaker (`Aap (Owner)`, `Guest`, or custom names).
- **🗄️ Turso Edge Database**: All transcriptions and speaker profiles are stored in serverless Turso SQLite database with automatic fallback to local SQLite.
- **📱 Mobile-First Walkie-Talkie UI**: One-tap recording, live sound wave meter, audio timer, copy to clipboard, and instant history feed.
- **🌐 100% Serverless & Lightweight**: Zero heavy local PyTorch / Python models. Cold starts in milliseconds on Vercel Edge.
- **💰 100% Free Stack**: Free Vercel hosting + Free Turso DB + Free Groq Tier.

---

## 🚀 One-Click Deploy to Vercel

1. Push this repository to your GitHub.
2. Go to [Vercel](https://vercel.com/new) and import this repository.
3. Add the following **Environment Variables** in Vercel settings:
   - `GROQ_API_KEY`: Your free Groq API key (from [console.groq.com](https://console.groq.com)).
   - `TURSO_DATABASE_URL`: Your Turso DB URL (e.g., `libsql://your-db.turso.io` from [turso.tech](https://turso.tech)).
   - `TURSO_AUTH_TOKEN`: Your Turso DB auth token.
4. Click **Deploy**! Done in 60 seconds!

---

## 🛠️ Local Development

1. **Clone and install dependencies**:
   ```bash
   git clone https://github.com/nxtzenmaker-max/whisper-voice-ai.git
   cd whisper-voice-ai
   npm install
   ```

2. **Configure environment variables**:
   Create a `.env.local` file (or copy from `.env.example`):
   ```env
   GROQ_API_KEY=gsk_...
   TURSO_DATABASE_URL=libsql://your-db.turso.io  # Or leave empty for local file:local.db
   TURSO_AUTH_TOKEN=your-token
   ```

3. **Run development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📦 Tech Stack

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Voice AI**: Groq Whisper Large V3 Turbo
- **Database**: Turso SQLite (LibSQL)
- **TTS**: Microsoft Edge-TTS (`en-IN-PrabhatNeural` at +20% speed)
- **Mobile Client**: Native Android Kotlin app with biometrics & foreground service

---

## 📱 Android Jarvis Voice Assistant (APK)

The repository includes a native Android client in `android/` equipped with:
- **Biometric Voiceprint Extraction**: YIN fundamental pitch (F0) + 20-band Mel-frequency filterbank calculated locally on device.
- **Strict Silent Gatekeeper**:
  - **Owner (`Aap`)**: Replies with **Prabhat (+20% speed)** audio stream.
  - **Stranger / Mummy / Friends**: 100% **SILENT** (security gate blocks unauthorized voices).
- **Automated CI/CD**: Every push automatically builds `Jarvis-Voice-Assistant.apk` via GitHub Actions and publishes it to GitHub Releases & Artifacts.

- **Icons**: [Lucide React](https://lucide.dev/)
- **Speech AI**: [Groq Whisper Large V3 Turbo](https://console.groq.com/)
- **Database**: [Turso SQLite Edge](https://turso.tech/) (`@libsql/client`)
- **Hosting**: [Vercel](https://vercel.com/)
