import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { costOf } from "./pricing.js";

export function defaultSourceDir() {
  const base = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
  return path.join(base, "projects");
}

function* walkJsonl(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walkJsonl(full);
    else if (e.name.endsWith(".jsonl") && e.name !== "journal.jsonl") yield full;
  }
}

function projectNameFromSlug(slug) {
  // Slugs encode paths, e.g. "C--Users-piai-Desktop-song" -> "song"
  const parts = slug.split("-").filter(Boolean);
  return parts[parts.length - 1] || slug;
}

// Reads every session transcript and returns one record per API response.
export function collectEntries(sourceDir = defaultSourceDir()) {
  const seen = new Set();
  const entries = [];
  for (const file of walkJsonl(sourceDir)) {
    const slug = path.relative(sourceDir, file).split(path.sep)[0];
    let text;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const line of text.split("\n")) {
      if (!line || !line.includes('"usage"')) continue;
      let obj;
      try {
        obj = JSON.parse(line);
      } catch {
        continue;
      }
      const msg = obj.message;
      const u = msg && msg.usage;
      if (!u || !obj.timestamp) continue;
      const input = u.input_tokens || 0;
      const output = u.output_tokens || 0;
      const cacheRead = u.cache_read_input_tokens || 0;
      const cacheWrite = u.cache_creation_input_tokens || 0;
      if (input + output + cacheRead + cacheWrite === 0) continue;
      const model = msg.model || "";
      if (model === "<synthetic>") continue;
      // Streaming writes the same message several times; requestId+message.id
      // identifies one billed API response.
      const key = msg.id && obj.requestId ? `${msg.id}:${obj.requestId}` : obj.uuid;
      if (key) {
        if (seen.has(key)) continue;
        seen.add(key);
      }
      entries.push({
        ts: obj.timestamp,
        model,
        input,
        output,
        cacheRead,
        cacheWrite,
        project: projectNameFromSlug(slug),
        sessionId: obj.sessionId,
      });
    }
  }
  return entries;
}

function dayKey(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function emptyBucket() {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, cost: 0, count: 0 };
}

function add(bucket, e) {
  bucket.input += e.input;
  bucket.output += e.output;
  bucket.cacheRead += e.cacheRead;
  bucket.cacheWrite += e.cacheWrite;
  bucket.total += e.input + e.output + e.cacheRead + e.cacheWrite;
  bucket.cost += costOf(e);
  bucket.count += 1;
}

export function aggregate(entries, { days = 30 } = {}) {
  const totals = emptyBucket();
  const byModel = new Map();
  const byDayMap = new Map();
  const byProject = new Map();
  const sessions = new Set();

  for (const e of entries) {
    add(totals, e);
    for (const [map, key] of [
      [byModel, e.model || "unknown"],
      [byDayMap, dayKey(e.ts)],
      [byProject, e.project],
    ]) {
      if (!map.has(key)) map.set(key, emptyBucket());
      add(map.get(key), e);
    }
    if (e.sessionId) sessions.add(e.sessionId);
  }

  // Last `days` calendar days, oldest first, empty days included.
  const byDay = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = dayKey(d);
    byDay.push({ date: key, ...(byDayMap.get(key) ?? emptyBucket()) });
  }

  // Streak of consecutive active days ending today (or yesterday).
  let streak = 0;
  for (let i = 0; ; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    if (byDayMap.has(dayKey(d))) streak++;
    else if (i === 0) continue; // today can still be empty
    else break;
  }

  const sortDesc = (map) =>
    [...map.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total);

  return {
    generatedAt: new Date().toISOString(),
    totals,
    byModel: sortDesc(byModel),
    byProject: sortDesc(byProject),
    byDay,
    activeDays: byDayMap.size,
    streak,
    sessions: sessions.size,
    firstDay: [...byDayMap.keys()].sort()[0] ?? null,
  };
}
