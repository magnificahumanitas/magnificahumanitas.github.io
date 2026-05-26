# magnificahumanitas.github.io

GitHub Pages vanity URL for **Magnifica Humanitas** — an interactive reader for the encyclical letter of Pope Leo XIV on safeguarding the human person in the time of artificial intelligence.

## How it works

`index.html` embeds the app in a full-viewport iframe. The URL bar stays at `magnificahumanitas.github.io` while the app loads from the NAS via Tailscale Funnel.

```
User visits magnificahumanitas.github.io
  → GitHub Pages serves index.html (iframe wrapper)
    → iframe loads https://atlas-server.taila932a4.ts.net/magnifica/
      → Tailscale Funnel (TLS) → Caddy → magnifica-humanitas container
```

## Setup (replicable for any app)

This pattern gives any app a clean `<org>.github.io` URL without a custom domain or DNS changes. The URL persists in the browser bar.

### 1. Create a GitHub org

Go to https://github.com/organizations/plan and create a free org matching the desired URL (e.g., `myappname` → `myappname.github.io`).

### 2. Create the iframe repo

```bash
mkdir /tmp/myapp && cd /tmp/myapp

cat > index.html << 'HTML'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My App Name</title>
  <meta name="description" content="Short description of the app.">
  <style>
    * { margin: 0; padding: 0; }
    html, body { height: 100%; overflow: hidden; }
    iframe { width: 100%; height: 100%; border: none; }
  </style>
</head>
<body>
  <iframe src="https://atlas-server.taila932a4.ts.net/<path>" title="My App Name"></iframe>
</body>
</html>
HTML

git init && git add . && git commit -m "iframe wrapper"
gh repo create <org>/<org>.github.io --public --source=. --push
```

Replace `<org>` with your GitHub org name and `<path>` with the Caddy route (empty for root, `magnifica/` for a subpath app).

### 3. Enable GitHub Pages

Usually auto-enabled for `*.github.io` repos. If not:

```bash
gh api repos/<org>/<org>.github.io/pages -X POST \
  --input - <<< '{"build_type":"legacy","source":{"branch":"main","path":"/"}}'
```

### 4. Verify

Wait ~2 minutes for GitHub Pages deploy, then open `https://<org>.github.io/` in a browser. The URL bar should stay at `<org>.github.io` while the app loads inside the iframe.

## Infrastructure context

This repo is part of the NAS Docker migration infrastructure:

| Component | Location | Purpose |
|---|---|---|
| Tailscale Funnel | atlas-server NAS | TLS termination, public ingress |
| Caddy | `/volume1/docker/caddy/` | Path-based reverse proxy |
| App containers | `/volume1/docker/<app>/` | Individual Docker Compose stacks |
| GitHub Pages orgs | `<org>.github.io` repos | Vanity URL (iframe wrapper) |
| Dockge | `http://atlas-server:5001` | Container management UI (LAN only) |
