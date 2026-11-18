// DuckTrader HQ collector — reads GitHub Actions status for every bot repo
// and writes site/status.json. No dependencies (Node 20+).
import { readFile, writeFile, mkdir } from "node:fs/promises";

const TOKEN = process.env.HQ_TOKEN;
const OWNER = process.env.HQ_OWNER || process.env.GITHUB_REPOSITORY_OWNER || "weitanjun123";
const OUT = process.env.HQ_OUT || "site/status.json";
const API = "https://api.github.com";

if (!TOKEN) {
  console.error("HQ_TOKEN secret is missing — add it in Settings → Secrets → Actions.");
  process.exit(1);
}

async function gh(path) {
  const res = await fetch(API + path, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "ducktrader-hq",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} on ${path}: ${body.slice(0, 160)}`);
  }
  return res.json();
}

// ---------- cron (5-field, UTC, GitHub flavour) ----------
const RANGES = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 6]];
const NAMES = {
  3: { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 },
  4: { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 },
};
function parseField(str, i) {
  const [lo, hi] = RANGES[i];
  const set = new Set();
  for (const partRaw of str.toLowerCase().split(",")) {
    let [range, step] = partRaw.split("/");
    step = step ? parseInt(step, 10) : 1;
    let a, b;
    if (range === "*") { a = lo; b = hi; }
    else {
      const conv = (v) => (NAMES[i] && NAMES[i][v] !== undefined ? NAMES[i][v] : parseInt(v, 10));
      const [x, y] = range.split("-");
      a = conv(x); b = y !== undefined ? conv(y) : (partRaw.includes("/") ? hi : a);
    }
    for (let v = a; v <= b; v += step) set.add(i === 4 && v === 7 ? 0 : v);
  }
  return { set, star: str === "*" };
}
function nextCron(expr, from = new Date()) {
  const f = expr.trim().split(/\s+/);
  if (f.length !== 5) return null;
  const [mi, ho, dom, mo, dow] = f.map(parseField);
  const t = new Date(from.getTime());
  t.setUTCSeconds(0, 0);
  t.setUTCMinutes(t.getUTCMinutes() + 1);
  const limit = from.getTime() + 400 * 86400e3;
  while (t.getTime() < limit) {
    if (!mo.set.has(t.getUTCMonth() + 1)) { t.setUTCMonth(t.getUTCMonth() + 1, 1); t.setUTCHours(0, 0); continue; }
    const domOk = dom.set.has(t.getUTCDate());
    const dowOk = dow.set.has(t.getUTCDay());
    const dayOk = dom.star || dow.star ? domOk && dowOk : domOk || dowOk;
    if (!dayOk) { t.setUTCDate(t.getUTCDate() + 1); t.setUTCHours(0, 0); continue; }
    if (!ho.set.has(t.getUTCHours())) { t.setUTCHours(t.getUTCHours() + 1, 0); continue; }
    if (!mi.set.has(t.getUTCMinutes())) { t.setUTCMinutes(t.getUTCMinutes() + 1); continue; }
    return t.toISOString();
  }
  return null;
}

// ---------- collect ----------
const ACTIVE = new Set(["queued", "in_progress", "waiting", "requested", "pending"]);
const BAD = new Set(["failure", "timed_out", "startup_failure"]);

function slimRun(r) {
  const start = r.run_started_at || r.created_at;
  const dur = r.status === "completed" ? Math.max(0, (Date.parse(r.updated_at) - Date.parse(start)) / 1000) : null;
  return {
    id: r.id, status: r.status, conclusion: r.conclusion, event: r.event,
    started_at: start, updated_at: r.updated_at, duration_s: dur ? Math.round(dur) : dur,
    url: r.html_url, title: r.display_title,
  };
}

// All runs created in [from, to] (YYYY-MM-DD, inclusive), following pages (API caps one query at 1000 results)
async function runsBetween(repo, from, to) {
  const out = [];
  for (let page = 1; page <= 10; page++) {
    const j = await gh(`/repos/${repo}/actions/runs?per_page=100&page=${page}&created=${from}..${to}`);
    out.push(...j.workflow_runs);
    if (j.workflow_runs.length < 100) break;
  }
  return out;
}
const day = (t) => new Date(t).toISOString().slice(0, 10);
const runSeconds = (r) => r.status === "completed"
  ? Math.max(0, Math.round((Date.parse(r.updated_at) - Date.parse(r.run_started_at || r.created_at)) / 1000)) : 0;

async function collectBot(bot) {
  const repo = `${OWNER}/${bot.repo}`;
  const out = { ...bot, url: `https://github.com/${repo}`, workflows: [], state: "idle" };
  try {
    const [wfs, runs] = await Promise.all([
      gh(`/repos/${repo}/actions/workflows?per_page=100`),
      gh(`/repos/${repo}/actions/runs?per_page=100`),
    ]);
    for (const wf of wfs.workflows) {
      if (!wf.path.startsWith(".github/workflows/")) continue; // skip dynamic (pages, etc.)
      let crons = [];
      try {
        const file = await gh(`/repos/${repo}/contents/${encodeURIComponent(wf.path).replace(/%2F/g, "/")}`);
        const yaml = Buffer.from(file.content, "base64").toString("utf8");
        crons = [...yaml.matchAll(/cron:\s*["']([^"']+)["']/g)].map((m) => m[1]);
      } catch { /* file unreadable — no schedule info */ }
      const enabled = wf.state === "active";
      const next = enabled ? crons.map((c) => nextCron(c)).filter(Boolean).sort()[0] || null : null;
      const wfRuns = runs.workflow_runs.filter((r) => r.workflow_id === wf.id).slice(0, 10).map(slimRun);
      out.workflows.push({ name: wf.name, path: wf.path, enabled, crons, next_run: next, runs: wfRuns });
    }
    const all = out.workflows.flatMap((w) => w.runs.map((r) => ({ ...r, workflow: w.name })))
      .sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at));
    out.last_run = all[0] || null;
    out.next_run = out.workflows.map((w) => w.next_run).filter(Boolean).sort()[0] || null;
    out.running = all.filter((r) => ACTIVE.has(r.status));
    out.failing = out.workflows.filter((w) => {
      if (!w.enabled) return false;
      const latest = w.runs.find((r) => r.status === "completed" && !["cancelled", "skipped"].includes(r.conclusion));
      return latest && BAD.has(latest.conclusion);
    }).map((w) => ({ workflow: w.name, run: w.runs.find((r) => r.status === "completed") }));
    out.runs_24h = all.filter((r) => Date.now() - Date.parse(r.started_at) < 86400e3).length;
    // last 7 days of work
    const cutoff = Date.now() - 7 * 86400e3;
    const week = (await runsBetween(repo, day(cutoff), day(Date.now() + 86400e3)))
      .filter((r) => Date.parse(r.run_started_at || r.created_at) >= cutoff && r.conclusion !== "skipped");
    const done = week.filter((r) => r.status === "completed" && r.conclusion !== "cancelled");
    out.week = {
      seconds: week.reduce((t, r) => t + runSeconds(r), 0),
      runs: week.length,
      success: done.length ? Math.round(100 * done.filter((r) => r.conclusion === "success").length / done.length) : null,
    };
    out.state = out.running.length ? "running" : out.failing.length ? "failed" : out.last_run ? "ok" : "idle";
  } catch (e) {
    out.state = "unknown";
    out.error = String(e.message || e);
    console.error(`${bot.repo}: ${out.error}`);
  }
  return out;
}

// ---------- public GitHub Pages sites ----------
async function getPublic(path){
  try { return await gh(path); }
  catch (e) { // fall back to an unauthenticated call for public data
    const res = await fetch(API + path, { headers: { Accept: "application/vnd.github+json", "User-Agent": "ducktrader-hq" } });
    if (!res.ok) throw e; return res.json();
  }
}
async function pageInfo(url){
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) return null;
    const html = await res.text();
    const t = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    return { title: t ? t[1].trim() : null };
  } catch { return null; }
}
async function collectPages(){
  let cfg = { exclude: [], sites: {} };
  try { cfg = JSON.parse(await readFile("pages.json", "utf8")); } catch {}
  const repos = await getPublic(`/users/${OWNER}/repos?per_page=100&type=owner&sort=pushed`);
  const out = [];
  for (const r of repos) {
    if (!r.has_pages || r.private || r.archived || cfg.exclude.includes(r.name)) continue;
    const o = cfg.sites[r.name] || {};
    const isUserSite = r.name.toLowerCase() === `${OWNER.toLowerCase()}.github.io`;
    const base = r.homepage && /^https?:\/\//.test(r.homepage) ? r.homepage.replace(/\/?$/, "/")
      : `https://${OWNER.toLowerCase()}.github.io/${isUserSite ? "" : r.name + "/"}`;
    const site = {
      repo: r.name, url: base, repo_url: r.html_url,
      name: o.name || r.name.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
      icon: o.icon || "🌐", description: o.description || r.description || "",
      updated_at: r.pushed_at, subpages: [],
    };
    const main = await pageInfo(base);
    site.online = !!main; if (main?.title && !o.description && !r.description) site.description = main.title;
    // extra .html pages inside the site
    try {
      const tree = await getPublic(`/repos/${OWNER}/${r.name}/git/trees/${r.default_branch}?recursive=1`);
      const files = tree.tree.filter(f => f.type === "blob").map(f => f.path);
      const root = ["", "docs/", "web/", "site/", "public/", "dist/"].find(d => files.includes(d + "index.html")) ?? "";
      const extra = files.filter(f => f.startsWith(root) && f.endsWith(".html") && f !== root + "index.html"
        && !/(^|\/)(node_modules|vendor|assets|lib|test|tests|templates|partials)\//.test(f)).slice(0, 15);
      for (const f of extra) {
        const rel = f.slice(root.length).replace(/index\.html$/, "");
        const url = base + rel, info = await pageInfo(url);
        const fallback = rel.replace(/\/$/, "").replace(/\.html$/, "").replace(/[-_\/]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        if (info) site.subpages.push({ url, title: info.title && info.title !== main?.title ? info.title : fallback });
      }
    } catch (e) { console.error(`pages tree ${r.name}: ${e.message}`); }
    out.push(site);
  }
  return out;
}

// Every completed run is written once (deduped by run id) to ledger/runs-YYYY.csv,
// then ledger/summary-YYYY.{json,csv} is rebuilt: hours, runs and share of all work per bot.
const csvCell = (v) => (/[",\n]/.test(String(v ?? "")) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ""));
function parseCsv(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; } else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
const HEAD = ["run_id", "repo", "bot", "workflow", "started_at", "ended_at", "seconds", "conclusion", "event"];
async function updateLedger(bots) {
  await mkdir("ledger", { recursive: true });
  const year = new Date().getUTCFullYear();
  const file = `ledger/runs-${year}.csv`;
  let rows = [];
  try { rows = parseCsv(await readFile(file, "utf8")).slice(1).filter((r) => r.length >= HEAD.length); } catch {}
  const seen = new Set(rows.map((r) => r[0]));
  const lastByRepo = {};
  for (const r of rows) if (!lastByRepo[r[1]] || r[4] > lastByRepo[r[1]]) lastByRepo[r[1]] = r[4];
  let added = 0;
  for (const b of bots) {
    const repo = `${OWNER}/${b.repo}`;
    // resume 3 days before the last logged run, or backfill from 1 Jan in weekly chunks
    let from = lastByRepo[b.repo] ? Date.parse(lastByRepo[b.repo]) - 3 * 86400e3 : Date.UTC(year, 0, 1);
    from = Math.max(from, Date.UTC(year, 0, 1));
    try {
      for (let t = from; t <= Date.now(); t += 7 * 86400e3) {
        const runs = await runsBetween(repo, day(t), day(Math.min(t + 6 * 86400e3, Date.now() + 86400e3)));
        for (const r of runs) {
          if (r.status !== "completed" || ["skipped", "cancelled"].includes(r.conclusion) || seen.has(String(r.id))) continue;
          const start = r.run_started_at || r.created_at;
          if (new Date(start).getUTCFullYear() !== year) continue;
          rows.push([String(r.id), b.repo, b.name, r.name, start, r.updated_at, String(runSeconds(r)), r.conclusion, r.event]);
          seen.add(String(r.id)); added++;
        }
      }
    } catch (e) { console.error(`ledger ${b.repo}: ${e.message}`); }
  }
  rows.sort((a, b) => (a[4] < b[4] ? -1 : 1));
  await writeFile(file, [HEAD, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n");
  // summary
  const per = {};
  for (const r of rows) {
    const k = r[1], p = (per[k] ||= { repo: k, bot: r[2], seconds: 0, runs: 0, ok: 0 });
    p.bot = r[2]; p.seconds += +r[6]; p.runs++; if (r[7] === "success") p.ok++;
  }
  const names = Object.fromEntries(bots.map((b) => [b.repo, b.name]));
  const total = Object.values(per).reduce((t, p) => t + p.seconds, 0);
  const list = Object.values(per).sort((a, b) => b.seconds - a.seconds).map((p, i) => ({
    rank: i + 1, repo: p.repo, bot: names[p.repo] || p.bot, hours: +(p.seconds / 3600).toFixed(2), runs: p.runs,
    success_pct: p.runs ? Math.round(100 * p.ok / p.runs) : null,
    share_pct: total ? +(100 * p.seconds / total).toFixed(2) : 0,
  }));
  const summary = { year, updated_at: new Date().toISOString(), total_hours: +(total / 3600).toFixed(2), total_runs: rows.length,
    note: "share_pct = this bot's hours / all bots' hours. Use it as each bot's slice of the year-end bonus pool.", bots: list };
  await writeFile(`ledger/summary-${year}.json`, JSON.stringify(summary, null, 1) + "\n");
  await writeFile(`ledger/summary-${year}.csv`, [["rank", "bot", "repo", "hours", "runs", "success_pct", "share_pct"],
    ...list.map((p) => [p.rank, p.bot, p.repo, p.hours, p.runs, p.success_pct, p.share_pct])].map((r) => r.map(csvCell).join(",")).join("\n") + "\n");
  console.log(`Ledger ${year}: +${added} runs, ${rows.length} total, ${summary.total_hours} h`);
}

// Manual mode: only refresh the My Pages list (run from the "Refresh My Pages" workflow)
if (process.env.HQ_PAGES === "1") {
  const pages = await collectPages();
  await writeFile("web/pages-list.json", JSON.stringify({ generated_at: new Date().toISOString(), pages }, null, 1) + "\n");
  console.log("Pages sites:", pages.map(p => p.repo).join(", ") || "(none)");
  process.exit(0);
}

const bots = JSON.parse(await readFile("bots.json", "utf8"));
const results = [];
for (const b of bots) results.push(await collectBot(b)); // sequential: kind to the API
// ---------- hardworking ranking (relative to all bots) ----------
const totalSec = results.reduce((t, b) => t + (b.week?.seconds || 0), 0);
const maxSec = Math.max(0, ...results.map((b) => b.week?.seconds || 0));
[...results].sort((a, b) => (b.week?.seconds || 0) - (a.week?.seconds || 0)).forEach((b, i) => {
  if (!b.week) return;
  b.week.hours = +(b.week.seconds / 3600).toFixed(2);
  b.week.index = totalSec ? +(100 * b.week.seconds / totalSec).toFixed(1) : 0;   // share of all work, %
  b.week.bar = maxSec ? +(b.week.seconds / maxSec).toFixed(3) : 0;               // 1 = hardest worker
  b.week.rank = i + 1;
  b.week.top = maxSec > 0 && b.week.seconds === maxSec;
});
const work = { window_days: 7, total_hours: +(totalSec / 3600).toFixed(2), bots: results.length };

// ---------- year ledger (daily "Work-hours ledger" workflow) ----------
if (process.env.HQ_LEDGER === "1") await updateLedger(bots);

await mkdir(OUT.split("/").slice(0, -1).join("/") || ".", { recursive: true });
await writeFile(OUT, JSON.stringify({ generated_at: new Date().toISOString(), owner: OWNER, work, bots: results }, null, 1));
const tally = results.reduce((t, b) => ((t[b.state] = (t[b.state] || 0) + 1), t), {});
console.log("Wrote", OUT, tally);
