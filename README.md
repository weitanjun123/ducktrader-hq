# DuckTrader HQ 🦆

A pixel-art "bot office" showing what every DuckTrader bot is doing, hosted free on GitHub Pages.

- `bots.json` — the bots on the floor (add a line here for each new bot repo)
- `scripts/collect.mjs` — reads GitHub Actions runs + schedules for each bot, writes `status.json`
- `web/index.html` — the office page (demo data until the first collector run)
- `.github/workflows/hq.yml` — runs the collector every ~20 min and deploys to Pages

Setup: secret `HQ_TOKEN` = fine-grained token with **Actions: Read** + **Contents: Read** on the bot repos;
Settings → Pages → Source: **GitHub Actions**.

Living office: ducks walk between the trading floor, pantry, lounge, meeting room and mailroom. Running bots type at their desks, failed bots show a red "!" and get help, finished runs are carried to the Telegram mailbox, and Breadth / Setup Scanner hand data folders to the bots that read their output. Lighting follows Singapore time.
