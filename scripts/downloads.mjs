// Builds site/downloads.json from the downloads/ folder (+ the bonus ledger files).
// Subfolders become categories. Date = last git commit that touched the file.
import { readdir, stat, mkdir, copyFile, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import path from "node:path";

const SITE = process.env.HQ_SITE || "site";
const files = [];
async function walk(dir) {
  let entries = [];
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p); else files.push(p);
  }
}
const gitDate = (p) => { try { return execSync(`git log -1 --format=%cI -- "${p}"`).toString().trim() || null; } catch { return null; } };
const cap = (s) => s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

await walk("downloads");
const out = [];
for (const f of files) {
  const st = await stat(f), rel = path.relative("downloads", f), parts = rel.split(path.sep);
  const dest = path.join(SITE, "downloads", rel);
  await mkdir(path.dirname(dest), { recursive: true }); await copyFile(f, dest);
  out.push({ name: path.basename(f), path: "downloads/" + parts.map(encodeURIComponent).join("/"),
    category: parts.length > 1 ? cap(parts[0]) : "General", ext: path.extname(f).slice(1).toLowerCase(),
    size: st.size, added: gitDate(f) || st.mtime.toISOString() });
}
// always-latest bonus ledger files
let led = []; try { led = (await readdir("ledger")).filter((n) => n.endsWith(".csv")); } catch {}
for (const n of led) {
  const f = path.join("ledger", n), st = await stat(f), dest = path.join(SITE, "ledger", n);
  await mkdir(path.dirname(dest), { recursive: true }); await copyFile(f, dest);
  out.push({ name: n, path: "ledger/" + n, category: "Bot Ledger", ext: "csv", size: st.size, added: gitDate(f) || st.mtime.toISOString(), auto: true });
}
out.sort((a, b) => (b.added || "").localeCompare(a.added || ""));
await writeFile(path.join(SITE, "downloads.json"), JSON.stringify({ generated_at: new Date().toISOString(), files: out }, null, 1));
console.log(`Downloads: ${out.length} files`);
