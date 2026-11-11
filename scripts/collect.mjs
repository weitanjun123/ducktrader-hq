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
    out.state = out.running.length ? "running" : out.failing.length ? "failed" : out.last_run ? "ok" : "idle";
  } catch (e) {
    out.state = "unknown";
    out.error = String(e.message || e);
    console.error(`${bot.repo}: ${out.error}`);
  }
  return out;
}

const bots = JSON.parse(await readFile("bots.json", "utf8"));
const results = [];
for (const b of bots) results.push(await collectBot(b)); // sequential: kind to the API
await mkdir(OUT.split("/").slice(0, -1).join("/") || ".", { recursive: true });
await writeFile(OUT, JSON.stringify({ generated_at: new Date().toISOString(), owner: OWNER, bots: results }, null, 1));
const tally = results.reduce((t, b) => ((t[b.state] = (t[b.state] || 0) + 1), t), {});
console.log("Wrote", OUT, tally);
