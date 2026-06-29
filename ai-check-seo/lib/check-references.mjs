// lib/check-references.mjs — Link health-check สำหรับ reference URLs ทั้งหมดใน references.js
// รันเป็น cron กันเอกสาร Google/MDN/X ย้าย URL แล้วลูกค้ากดเจอ 404
//   node lib/check-references.mjs           → เช็ก + เขียน data/reference-health.json (exit 1 ถ้ามีลิงก์ตาย)
// ผลล่าสุดดูผ่าน GET /api/reference-health
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { REFERENCE_IDS, referenceFor } from './references.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, '..', 'data', 'reference-health.json');
const UA = 'Mozilla/5.0 (compatible; SEOAuditRefHealth/1.0; +https://seo.ohmai.me)';

// รวม URL ไม่ซ้ำ → checkIds ที่ใช้
const urls = new Map();
for (const id of REFERENCE_IDS) {
  for (const s of (referenceFor(id)?.sources || [])) {
    if (!urls.has(s.url)) urls.set(s.url, { label: s.label, ids: [] });
    urls.get(s.url).ids.push(id);
  }
}

const norm = (u) => u.replace(/[?#].*$/, '');           // ตัด query/hash
const isHlOnly = (a, b) => norm(a) === norm(b);          // ?hl= localization = ไม่นับว่าย้าย

async function check(url, meta) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, { redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': UA, Accept: 'text/html,*/*' } });
    clearTimeout(to);
    const moved = r.url && r.url !== url && !isHlOnly(r.url, url);
    return { url, status: r.status, final: r.url, moved, ...meta };
  } catch (e) {
    clearTimeout(to);
    return { url, status: 'ERR', err: String(e?.name || e).slice(0, 40), ...meta };
  }
}

async function run() {
  const entries = [...urls.entries()];
  const results = [];
  const N = 6;
  for (let i = 0; i < entries.length; i += N) {
    const batch = await Promise.all(entries.slice(i, i + N).map(([u, m]) => check(u, m)));
    results.push(...batch);
  }
  const dead = results.filter(r => r.status === 'ERR' || (typeof r.status === 'number' && r.status >= 400));
  const moved = results.filter(r => r.moved && !dead.includes(r));
  const report = {
    checkedAt: new Date().toISOString(),
    total: results.length, ok: results.length - dead.length, dead: dead.length, moved: moved.length,
    deadList: dead.map(r => ({ url: r.url, status: r.status, err: r.err, ids: r.ids })),
    movedList: moved.map(r => ({ url: r.url, final: r.final, ids: r.ids })),
  };
  try { fs.writeFileSync(OUT, JSON.stringify(report, null, 2)); } catch (e) { console.error('write failed:', e.message); }
  console.log(`reference health: ${report.ok}/${report.total} ok · dead ${report.dead} · moved ${report.moved}`);
  dead.forEach(r => console.log(`  ❌ [${r.status}${r.err ? ' ' + r.err : ''}] ${r.url}  (ใช้โดย: ${r.ids.join(', ')})`));
  moved.forEach(r => console.log(`  ↪ moved ${r.url} → ${r.final}`));
  return dead.length;
}

run().then(n => process.exit(n ? 1 : 0)).catch(e => { console.error(e); process.exit(2); });
