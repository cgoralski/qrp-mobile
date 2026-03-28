# Deploy QRP Mobile (Option A – existing Supabase)

Project path: `/var/www/html/sites/qrpmobile.vk4cgo.com`  
Served at: **https://qrpmobile.vk4cgo.com**

## 0. Prerequisites: Node.js 22+

Capacitor CLI 8, Supabase tooling, and this repo expect **Node.js ≥ 22**. Check with `node -v`. The repo’s `.nvmrc` is `22`.

**Option A – NodeSource (system-wide, typical on Ubuntu server):**

```bash
# Ubuntu/Debian – use NodeSource 22.x (see nodesource.com for current setup script if needed)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # should show v22.x
```

**Option B – nvm (per-user, no sudo):**

```bash
# https://github.com/nvm-sh/nvm#installing-and-updating
nvm install 22
nvm use
```

## 1. Build the app

If `npm` is not found after installing PlatformIO (PATH changed), you can either fix PATH or use the wrapper:

**Option A – use the build wrapper (no PATH change needed):**

```bash
cd /var/www/html/sites/qrpmobile.vk4cgo.com
bash scripts/build.sh
```

**Option B – fix PATH for your user:** run once, then `source ~/.bashrc` or open a new session:

```bash
bash /var/www/html/sites/qrpmobile.vk4cgo.com/scripts/fix-npm-path.sh
source ~/.bashrc
```

Then build as usual (both `npm` and `pio` will work):

```bash
cd /var/www/html/sites/qrpmobile.vk4cgo.com
npm ci
npm run build
```

This produces `dist/` (Vite build). Ensure `.env` exists with at least:

- `VITE_SUPABASE_PROJECT_ID=oonaetktfrwnfppgpccj`
- `VITE_SUPABASE_URL=https://oonaetktfrwnfppgpccj.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>`

## 2. SSL (Let's Encrypt) and nginx – first-time setup

One-time setup for **qrpmobile.vk4cgo.com** (site dir, cert, HTTPS):

```bash
cd /var/www/html/sites/qrpmobile.vk4cgo.com
sudo CERTBOT_EMAIL=your@email.com bash scripts/setup-qrpmobile-vk4cgo-com.sh
```

Or manually: copy `nginx/qrpmobile.vk4cgo.com-http-only.conf` to nginx apps-available, enable it, reload nginx, then:

```bash
sudo certbot certonly --webroot -w /var/www/html/sites/qrpmobile.vk4cgo.com -d qrpmobile.vk4cgo.com
```

Then install the full config `nginx/qrpmobile.vk4cgo.com.conf` and reload nginx.

**Certificate paths (must match `server_name`):**

- Live cert: `/etc/letsencrypt/live/qrpmobile.vk4cgo.com/fullchain.pem` and `privkey.pem`
- Nginx vhost: `nginx/qrpmobile.vk4cgo.com.conf` → `/etc/nginx/wcc/apps-available/qrpmobile.vk4cgo.com.conf`

Verify cert covers the site:

```bash
sudo openssl x509 -in /etc/letsencrypt/live/qrpmobile.vk4cgo.com/fullchain.pem -noout -subject -ext subjectAltName
```

You should see `CN = qrpmobile.vk4cgo.com` and `DNS:qrpmobile.vk4cgo.com` in Subject Alternative Name.

## 3. Enable nginx config (if not using the script)

```bash
sudo cp /var/www/html/sites/qrpmobile.vk4cgo.com/nginx/qrpmobile.vk4cgo.com.conf /etc/nginx/wcc/apps-available/
sudo ln -sf /etc/nginx/wcc/apps-available/qrpmobile.vk4cgo.com.conf /etc/nginx/wcc/apps-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 4. Supabase (if not already done)

- Migrations: run in order (repeaters then contacts) if the project DB is empty.
- Edge function: `npx supabase functions deploy import-chirp-csv` (for Settings → CHIRP CSV import).

## 5. After code changes

```bash
cd /var/www/html/sites/qrpmobile.vk4cgo.com
git pull   # or your deploy process
npm ci
npm run build
# No nginx reload needed; root points at dist/
```
