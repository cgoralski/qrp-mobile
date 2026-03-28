# GitHub SSH deploy key setup (qrp-mobile)

This server uses a **deploy key** to access `git@github.com:cgoralski/qrp-mobile.git`.

## 1. Add the public key to GitHub

1. Open: **https://github.com/cgoralski/qrp-mobile/settings/keys**
2. Click **"Add deploy key"**.
3. **Title:** `qrpmobile.vk4cgo.com` (or e.g. `web01.stackflowhq.com`).
4. **Key:** paste the public key below (one line).
5. Leave **"Allow write access"** unchecked unless this server needs to push.
6. Click **"Add key"**.

### Public key (copy this entire line)

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIO/CN9rI3rRto71Q+5JbVOiNNeq8dkz6BXk7vAGeVJ6f qrpmobile.vk4cgo.com-deploy
```

## 2. Test and pull

After adding the key, from this site directory run:

```bash
cd /var/www/html/sites/qrpmobile.vk4cgo.com
git fetch origin
git checkout main   # or master, depending on your default branch
```

The remote is set as `git@github-qrp-mobile:cgoralski/qrp-mobile.git` so this repo uses the deploy key; other GitHub repos on the server are unchanged.
