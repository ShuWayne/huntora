# Deploy HUNTORA

HUNTORA is a static site — no build step, no environment variables, no
server. Any static host works. Two recommended routes below.

## Option 1 — GitHub Pages (free)

1. Create a **public** repository on GitHub (e.g. `huntora`), e.g. via the
   GitHub web UI → **New repository** → name it `huntora` → **Create
   repository**.
2. Upload this project (all files, including `index.html` at the root) to the
   repository — via `git push` or the web UI's **Add file → Upload files**.
3. In the repository, go to **Settings → Pages** → under **Build and
   deployment**, set **Source: Deploy from a branch**, **Branch: main**,
   folder **/ (root)** → **Save**.
4. After ~1 minute your site is live at:
   `https://<your-username>.github.io/huntora/`

No build command, no dependencies to install — GitHub Pages serves the files
exactly as they are.

## Option 2 — Vercel (free)

1. Push the project to a GitHub repository (same as step 1–2 above), or use
   the Vercel CLI.
2. Go to [vercel.com](https://vercel.com) → **Add New → Project** → **Import**
   the repository.
3. Vercel detects the static site automatically. Framework preset:
   **Other**. Build command: **(leave empty)**. Output directory: **(leave
   empty — root)**. The included `vercel.json` already pins this.
4. Click **Deploy**. Your site goes live at `https://huntora-<hash>.vercel.app`
   (rename it in the project settings if you like).

### Vercel CLI alternative

```bash
npm i -g vercel
vercel          # follow the prompts; accept the detected static settings
vercel --prod   # deploy to production
```

## Other hosts

Netlify, Cloudflare Pages, Surge, or any static host: point the publish
directory at this project root. Nothing to build.

## Notes

- The site loads **Three.js 0.160.0** and **Google Fonts** from public CDNs.
  If the visitor is offline or the CDN is blocked, the app still works — the
  3D background is skipped and system fonts are used.
- No user data leaves the browser. Pipeline stages, tasks, prospect stages,
  and follow-up dates are stored in the visitor's own `localStorage`.
