# Apex Strategy — Strategy Lab

A multi-industry **business strategy simulation** for teams, classrooms and MBA programs.
Run many industries in parallel, each with its own market scenario, companies, quarterly
rounds, deadlines, balanced-scorecard scoring, leaderboard and downloadable reports.

Built with plain HTML + CSS + JS (no build step, no dependencies, works from `file://`,
GitHub Pages and Vercel). Chart.js is bundled locally.

---

## Features

- **Role hierarchy** — Super Admin (full control) · Manager (assigned industries: rounds,
  deadlines, users, reports) · Team Coordinator (allotted teams only) · Player (own team).
- **Many industries in parallel** — create any number of simulation instances.
- **3 market scenarios** — Smartphones, Electric Scooters, Home Appliances.
- **Up to 7 companies per industry** and **up to 7 players per team** (both adjustable
  per industry by the Super Admin, along with quarters 2–12 and practice rounds 0–2).
- **Quarterly decision cycle** — Product Design (price, specs, R&D targets, channel mix),
  Marketing Mix, Operations (production schedule), Manpower (workforce, sales force,
  training, innovation), Finance (loans, equity, dividends), Special Projects.
- **Deadlines & locks** — set a per-quarter deadline; decisions auto-lock when it passes;
  manual lock/unlock; processing is done by Manager or Super Admin.
- **Balanced scorecard scoring** — 8 measures, practice rounds excluded, cumulative ranking.
- **Reports & logs** — per-team per-quarter reports (CSV + print/PDF), all-companies summary
  CSV, and a full activity log (every sign-in, edit, submission, round) downloadable as CSV.
- **Google Sheets database (optional)** — connect an Apps Script Web App so every browser
  and device shares the same live state. Without it, the app runs in local demo mode.
- **Google colors, light & dark themes**, collapsible side menu, fully responsive.

## Demo accounts

| Role             | Email                    | Password   |
| ---------------- | ------------------------ | ---------- |
| Super Admin      | superadmin@apex.app      | `Apex@123` |
| Manager          | manager@apex.app         | `Apex@123` |
| Team Coordinator | coordinator@apex.app     | `Apex@123` |
| Player           | player@apex.app          | `Apex@123` |

The seeded demo industry is a running smartphone market with 7 companies, 8 quarters and
2 practice rounds. A second scooter industry sits in setup to show multi-industry support.

## Run locally

Just open `index.html` in a browser — no server or install needed. Or:

```bash
npx serve .        # or: python3 -m http.server
```

## Deploy

### GitHub Pages (this repo ships with the workflow)

1. Create an empty repository on GitHub (do not initialise with a README).
2. Push this folder:
   ```bash
   git init
   git add .
   git commit -m "Apex Strategy"
   git branch -M main
   git remote add origin https://github.com/<USER>/<REPO>.git
   git push -u origin main
   ```
3. The included GitHub Action (`.github/workflows/deploy.yml`) enables Pages and deploys
   automatically. If you see 404, set **Settings → Pages → Source: GitHub Actions** and
   re-run the workflow. Your app: `https://<USER>.github.io/<REPO>/`.

### Vercel

1. Push this folder to any Git host (or `vercel` CLI: `npx vercel --prod`).
2. Import the repo at [vercel.com/new](https://vercel.com/new) — it is a static site,
   no build command, output directory `.` (the included `vercel.json` handles routing).

## Google Sheets database (optional but recommended for classes)

1. Create a Google Sheet → **Extensions → Apps Script**.
2. Paste `google-apps-script.gs` (also downloadable from the app: Super Admin →
   Administration → Sheets Database).
3. **Deploy → New deployment → Web app**, execute as **Me**, access **Anyone**. Copy the `/exec` URL.
4. In the app: Super Admin → Sheets Database → paste URL → **Connect**.

All data (users, industries, decisions, results, logs) then lives in the sheet and syncs
to every device. The app still works offline per browser and merges on reconnect.

> Auth is client-side (demo/classroom grade) — do not reuse real passwords.

## Files

```
index.html            app shell
app.css               Google light/dark theme
chart.umd.min.js      Chart.js v4 (bundled, MIT)
js/util.js            formatting, icons, CSV/print helpers
js/data.js            scenarios, defaults, seed factories
js/engine.js          quarterly simulation engine + scorecard
js/store.js           state, auth, permissions, logs, rounds
js/sheets.js          Google Sheets sync (pull → merge → push)
js/ui.js              router, navigation, components
js/pages-core.js      dashboard, learner guide, password
js/pages-results.js   leaderboard + 6 analyse pages
js/pages-decide.js    8 decision pages with live calculators
js/pages-admin.js     industries, users, round control, sheets, reports
google-apps-script.gs Apps Script backend for Google Sheets
```

## License

MIT — see [LICENSE](LICENSE). Built by **Magesh Kanna S**.
