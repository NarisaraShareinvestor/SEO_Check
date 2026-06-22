// วัดความแม่นของระบบ เทียบ Google Lighthouse เป็น ground truth (FACT dims)
// ใช้: node data/accuracy.mjs   (อ่าน audit ids จาก /tmp/batchids.json หรือ argv)
import { readFileSync } from 'fs';
import { fetchLighthouse, crossCheck, accuracyFromCrossChecks } from '../lib/verify.js';
const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
for (const line of env.split('\n')) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].trim(); }
const key = process.env.PAGESPEED_API_KEY;

let ids = [];
try { ids = JSON.parse(readFileSync('/tmp/batchids.json', 'utf8')); } catch {}
if (process.argv[2]) ids = process.argv.slice(2).map(id => ({ id, url: id }));

const results = [];
for (const { id, url } of ids) {
  try {
    const j = await (await fetch('https://seo.ohmai.me/api/audit/' + id)).json();
    const audit = j.result || j;
    if (!audit.checks) { console.log('skip', url, '(audit ยังไม่เสร็จ)'); continue; }
    const lh = await fetchLighthouse(audit.url, key);
    if (lh.error) { console.log('skip', audit.url, 'LH:', lh.error); continue; }
    const cc = crossCheck(audit, lh);
    results.push(cc);
    console.log(`${audit.url.padEnd(42)} FACT ตรง ${cc.factAgree}/${cc.factComparable} (${cc.factPct}%)${cc.flag ? '  ⚠️ ' + cc.factMismatches.join(',') : ''}`);
  } catch (e) { console.log('err', url, String(e.message || e)); }
}

const acc = accuracyFromCrossChecks(results);
const o = acc.overall;
console.log(`\n════ ACCURACY (เทียบ Google Lighthouse, ${results.length} เว็บ) ════`);
console.log(`Precision: ${o.precision}%  (เราแจ้งว่ามีปัญหา → ถูกจริงกี่ %)`);
console.log(`Recall:    ${o.recall}%  (ปัญหาที่ Google เจอ → เราจับได้กี่ %)`);
console.log(`False Positive Rate: ${o.fpr}%  (เป้า < 3%)`);
console.log(`False Negative Rate: ${o.fnr}%`);
console.log(`confusion: TP ${o.tp} · FP ${o.fp} · FN ${o.fn} · TN ${o.tn}`);
console.log('\n── per dimension ──');
for (const [d, m] of Object.entries(acc.perDim)) console.log(`  ${d.padEnd(12)} P:${m.precision ?? '-'}% R:${m.recall ?? '-'}% FP:${m.fp} FN:${m.fn} (TP${m.tp}/TN${m.tn})`);
