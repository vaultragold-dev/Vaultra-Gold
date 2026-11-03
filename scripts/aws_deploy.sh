#!/usr/bin/env bash
set -euo pipefail

echo "========================================================"
echo "   VAULTRA DIGIGOLD — 1-CLICK AWS PRODUCTION DEPLOYER   "
echo "========================================================"

# 1. Install Docker, Docker Compose, Git & Nginx if not present
if ! command -v docker >/dev/null 2>&1; then
  echo "[1/5] Installing Docker & Docker Compose..."
  sudo apt-get update -y
  sudo apt-get install -y ca-certificates curl gnupg git nginx certbot python3-certbot-nginx
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER" || true
else
  echo "[1/5] Docker is already installed."
  sudo apt-get update -y
  sudo apt-get install -y git nginx certbot python3-certbot-nginx
fi

# 2. Clone or update repository
APP_DIR="/opt/vaultra-gold"
if [ ! -d "$APP_DIR" ]; then
  echo "[2/5] Cloning Vaultra-Gold repository into $APP_DIR..."
  sudo mkdir -p "$APP_DIR"
  sudo chown -R "$USER:$USER" "$APP_DIR"
  git clone https://github.com/vaultragold-dev/Vaultra-Gold.git "$APP_DIR"
else
  echo "[2/5] Updating existing repository in $APP_DIR..."
  cd "$APP_DIR"
  git pull origin main
fi

cd "$APP_DIR"

# 3. Create backend/.env if it does not exist
if [ ! -f "backend/.env" ]; then
  echo "[3/5] Creating production backend/.env..."
  RAND_JWT=$(openssl rand -hex 32)
  cat > backend/.env <<EOF
DATABASE_URL=postgresql+asyncpg://vaultra:vaultra_secure_db_password@db:5432/vaultra_digigold
JWT_SECRET=${RAND_JWT}
MASTER_ADMIN_USER=master
MASTER_ADMIN_PASS=Vaultra@2026
DEMO_SEED_PASSWORD=ChangeMe@123
MT5_RATES_URL=http://103.6.169.147:8000/rates
MT5_RATES_KEY=0Wub4wk8ja-EXMfsFrbjW_8mdmI0hRBr
GITHUB_REPO=vaultragold-dev/Vaultra-Gold
GITHUB_REF=main
GITHUB_TOKEN=${GITHUB_TOKEN:-}
AWS_S3_BUCKET=
AWS_REGION=ap-south-1
EOF
else
  echo "[3/5] Keeping existing backend/.env"
fi

# 4. Start PostgreSQL + Backend containers via Docker Compose
echo "[4/5] Building and starting PostgreSQL + Vaultra Backend containers..."
sudo docker compose up -d --build

# 5. Configure Nginx Reverse Proxy on Port 80 -> Port 8001
echo "[5/5] Configuring Nginx Reverse Proxy..."
DOMAIN_NAME="${1:-_}"
sudo tee /etc/nginx/sites-available/vaultra >/dev/null <<EOF
server {
    listen 80;
    server_name ${DOMAIN_NAME};
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/vaultra /etc/nginx/sites-enabled/vaultra
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

PUBLIC_IP=$(curl -s http://checkip.amazonaws.com || hostname -I | awk '{print $1}')

echo "========================================================"
echo "✅ VAULTRA DIGIGOLD IS NOW LIVE ON AWS!"
echo "--------------------------------------------------------"
echo "👉 Master Admin Panel : http://${PUBLIC_IP}/api/admin/master"
echo "   Login              : master / Vaultra@2026"
echo "👉 Jeweller Shop Panel: http://${PUBLIC_IP}/api/admin/jeweller"
echo "👉 API Health Check   : http://${PUBLIC_IP}/api/health"
echo "========================================================"
