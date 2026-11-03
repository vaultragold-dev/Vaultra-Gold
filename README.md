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
