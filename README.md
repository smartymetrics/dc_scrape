# Discord Archiver

A production-ready Discord message archiver designed to run 24/7 on Render.com (Free Tier) or locally using Docker.

## Features
- **Secure Login**: Logs in via a standard browser session (Playwright) to avoid detection.
- **Live Portal**: View the running browser and solve CAPTCHAs via a web interface (`http://localhost:5000`).
- **Persistence**: Saves browser state to `storage_state.json` to persist sessions across restarts.
- **Supabase Integration**: Uploads archived messages (JSON/PKL) to Supabase Storage using existing project utilities.
- **Alerting**: Sends email alerts when hCaptcha is detected.
- **Dockerized**: Fully containerized with Xvfb for "headless" execution with headful browser support.

## Setup

### Environment Variables
Create a `.env` file or set these in your Render/Docker environment:

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_service_key
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
CHANNELS=https://discord.com/channels/123/456,https://discord.com/channels/123/789
```

### Local Development
1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   playwright install chromium
   ```
2. Run the app:
   ```bash
   python app.py
   ```
3. Open `http://localhost:5000` to monitor and log in.

### Docker Usage (Local)
```bash
docker-compose up --build
```

### Deployment (Render.com)
1. Link your repo to Render.
2. Select **Docker** environment.
3. Render will pick up `render.yaml` automatically (or you can manually configure).
4. **Important**: Add the Environment Variables in the Render Dashboard.

## How it Works
1. **Startup**: The app launches a Flask server (UI) and a background Playwright thread.
2. **Login**: If not logged in, it waits. You must open the Web UI to see the QR code or login screen and log in manually.
3. **Archiving**: Once logged in, it cycles through `CHANNELS`, scraping new messages since the last ID.
4. **Upload**: Batches of messages are serialized to `.pkl` and uploaded to Supabase `discord_josh/`.
5. **Captcha**: If hCaptcha disrupts the flow, the bot pauses, emails you, and waits for you to solve it via the Web UI.
