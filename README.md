# Vaultra DigiGold — Multi-Tenant B2B2C Bullion & Jewellery Platform

Enterprise backend, Master & Jeweller administration consoles, React Native (Expo) mobile client, and 1-Click White-Label App Build Pipeline for **Vaultra Gold Pvt. Ltd.**

## Architecture

- **`backend/`** — FastAPI + Async SQLAlchemy (PostgreSQL) server (`server.py`, `white_label.py`, `database.py`, `models/`).
  - Live Gold (24K/22K/18K) & Silver pricing via MT5 Bridge + automatic MT5 lot cover booking.
  - Multi-tenant isolation (`X-Tenant-ID` / custom domains), per-shop buy/sell/redeem margins, 80/20 pool accumulator, GST bifurcation invoices, and UPI AutoPay SIP scheduler.
  - Master Admin Console (`/api/admin/master`) & Jeweller Shop Console (`/api/admin/jeweller`).
  - App Studio white-label asset generator (`white_label.py`) & 1-Click GitHub Actions build trigger (`POST /api/master/app-studio/{jid}/build`).
- **`frontend/`** — React Native (Expo Router) mobile app for Android & iOS.
  - Dynamic build-time and runtime branding via `tenant.config.json` & `app.config.js`.
- **`.github/workflows/build-branded-app.yml`** — Automated CI/CD pipeline that generates branded icons/splash screens and compiles signed Android (`.apk` / `.aab`) and iOS (`.ipa`) releases per jeweller.

## Quick Start (Docker)

```bash
cp backend/.env.example backend/.env
docker compose up -d --build
```

- **Backend API:** `http://localhost:8001/api/health`
- **Master Admin Console:** `http://localhost:8001/api/admin/master`
- **Jeweller Shop Console:** `http://localhost:8001/api/admin/jeweller`

## Store publishing (per jeweller)

The base app in `frontend/` is never published. Master -> App Studio builds one branded app per jeweller and
every build is store-ready:

- Release-signed Android `.aab`/`.apk` (upload keystore from GitHub secrets, debug signing fails the build)
- App Store-signed iOS `.ipa` (automatic signing with an App Store Connect API key)
- Unique `versionCode` / build number per build (App Studio increments it), Face ID usage string,
  export-compliance flag, HTTPS-only backend (`PUBLIC_BASE_URL`), no cleartext traffic
- Optional one-click upload to Google Play internal track and TestFlight ("Upload to store after build")

Apple (4.2.6 / 4.3) and Google reject many re-skinned apps from one account, so each jeweller's app is published
from the **jeweller's own** Play Console / Apple Developer account. Set the jeweller's "Store account key" in
App Studio and add that jeweller's secrets to this repository with the key as suffix:

| Purpose | Secrets (add `_<KEY>` suffix per jeweller; without suffix = platform default) |
|---|---|
| Android upload keystore | `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` |
| Google Play upload | `PLAY_SERVICE_ACCOUNT_JSON` (Play Console -> Setup -> API access, Release manager) |
| iOS signing + TestFlight | `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_API_KEY_P8_BASE64` (App Store Connect API key, App Manager) |
| iOS (optional) | `IOS_DIST_P12_BASE64`, `IOS_DIST_P12_PASSWORD` (existing Apple Distribution certificate) |

Backend `.env`: `PUBLIC_BASE_URL=https://...` (store builds refuse plain http), `GITHUB_TOKEN` with `actions:write`.
The App Kit `README.md` (download from App Studio) has the step-by-step for onboarding a jeweller's accounts.
