// Golden Fixture Test Runner
// ──────────────────────────────────────────────────────────────────────
// ป้อน fixture HTML (ที่จงใจฝังปัญหาที่รู้คำตอบแน่นอน) ผ่าน rule engine จริง
// (crawler.extractPageData + checks.runChecks) แล้ว assert ผลตรงกับที่ "คน
// ประกาศไว้ล่วงหน้า" — ไม่ใช่ derive จาก regex ใหม่ จึงหลุดกับดักวงกลม
//
// รัน:  npm test        (offline, deterministic, ~0.3s)
// exit code 1 ถ้ามีข้อไหนไม่ตรง → ใช้เป็น regression gate ได้
// ──────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractPageData, decodeHtmlFromResponse, parseRobots } from '../lib/crawler.js';
import { runChecks } from '../lib/checks.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const FIX = join(DIR, 'fixtures');

// สร้าง site object ที่ "สุขภาพดี" เป็น baseline — fixture แต่ละอันจะ override
// เฉพาะส่วนที่จงใจทำพัง ทำให้ check อื่นไม่ false-fire ปนมา
function healthySite(page, { origin = 'https://example.com', siteOverrides = {} } = {}) {
  const robotsTxt = `User-agent: *\nDisallow:\nSitemap: ${origin}/sitemap.xml`;
  return {
    startUrl: origin + '/',
    origin,
    https: origin.startsWith('https://'),
    robots: parseRobots(robotsTxt),
    robotsTxt,
    robotsStatus: 200,
    sitemaps: [origin + '/sitemap.xml'],
    sitemapUrls: [page.url],
    sitemapHasLastmod: true,
    pages: [page],
    fetchErrors: [],
    brokenLinks: [],
    faviconStatus: 200,
    notFoundHandling: { ok: true, status: 404 },
    rendered: { available: false, pages: {} },
    variants: [],
    ...siteOverrides,
  };
}

function pageFromFixture(file, url, pageOverrides = {}) {
  const html = readFileSync(join(FIX, file), 'utf8');
  const headers = new Headers({ 'content-type': 'text/html; charset=utf-8' });
  const page = extractPageData(html, url, headers, 200, 100, []);
  return { ...page, ...pageOverrides };
}

// ── Manifest: ground truth ที่ "คน" ประกาศไว้ ──────────────────────────
// expect:  checkId → status ที่ต้องได้ (pass|warn|fail)
// absent:  checkId ที่ต้อง "ไม่โผล่" (กัน false-positive / cross-contamination)
const FIXTURES = [
  {
    name: 'หน้าสะอาด — ต้องไม่มี false positive',
    file: 'clean.html', url: 'https://example.com/clean',
    expect: {},
    absent: ['h1-multiple', 'h1-hidden', 'charset-not-utf8', 'robots-meta-invalid', 'hreflang'],
  },
  {
    name: 'H1 abuse (6 ตัว/หน้า) → ต้อง FAIL',
    file: 'h1-abuse.html', url: 'https://example.com/h1-abuse',
    expect: { 'h1-multiple': 'fail' },
    absent: ['h1-hidden', 'charset-not-utf8', 'robots-meta-invalid'],
  },
  {
    name: 'H1 ซ่อนด้วย visibility:hidden → ต้อง WARN',
    file: 'hidden-h1.html', url: 'https://example.com/hidden-h1',
    expect: { 'h1-hidden': 'warn' },
    absent: ['h1-multiple', 'charset-not-utf8', 'robots-meta-invalid'],
  },
  {
    name: 'หลายภาษาผ่าน ?language= ใน sitemap แต่ไม่มี hreflang → ต้อง WARN',
    file: 'hreflang-query.html', url: 'https://example.com/home',
    siteOverrides: { sitemapUrls: ['https://example.com/home?language=en', 'https://example.com/home?language=th'] },
    expect: { 'hreflang': 'warn' },
    absent: ['h1-multiple', 'h1-hidden', 'charset-not-utf8', 'robots-meta-invalid'],
  },
  {
    name: 'meta robots = "nodiy,noodp" → ต้อง WARN',
    file: 'robots-nodiy.html', url: 'https://example.com/robots-nodiy',
    expect: { 'robots-meta-invalid': 'warn' },
    absent: ['h1-multiple', 'h1-hidden', 'charset-not-utf8'],
  },
  {
    name: 'charset windows-874 (page.detectedCharset) → ต้อง WARN',
    file: 'clean.html', url: 'https://example.com/charset-874',
    pageOverrides: { detectedCharset: 'windows-874' },
    expect: { 'charset-not-utf8': 'warn' },
    absent: ['h1-multiple', 'h1-hidden', 'robots-meta-invalid'],
  },
];

// ── Runner ─────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
const failures = [];

function assert(cond, label, detail = '') {
  if (cond) { passed++; }
  else { failed++; failures.push({ label, detail }); }
}

console.log('\n══════════════════════════════════════════════════════════════');
console.log('  GOLDEN FIXTURE TEST — rule engine จริง (offline)');
console.log('══════════════════════════════════════════════════════════════\n');

for (const fx of FIXTURES) {
  const page = pageFromFixture(fx.file, fx.url, fx.pageOverrides || {});
  const site = healthySite(page, { siteOverrides: fx.siteOverrides });
  const { checks } = runChecks(site);
  const byId = Object.fromEntries(checks.map(c => [c.id, c]));

  console.log(`▸ ${fx.name}`);

  for (const [id, want] of Object.entries(fx.expect)) {
    const got = byId[id]?.status;
    const ok = got === want;
    assert(ok, `${fx.file} :: ${id}`, `คาดหวัง "${want}" แต่ได้ "${got ?? '(ไม่โผล่)'}"`);
    console.log(`    ${ok ? '✅' : '❌'} ${id} = ${got ?? '(absent)'}  (want ${want})`);
  }
  for (const id of (fx.absent || [])) {
    const got = byId[id]?.status;
    const ok = got === undefined;
    assert(ok, `${fx.file} :: ${id} ต้องไม่โผล่`, `แต่กลับโผล่เป็น "${got}"`);
    if (!ok) console.log(`    ❌ ${id} ไม่ควรโผล่ แต่ได้ "${got}"`);
  }
  console.log('');
}

// ── Byte-level decode test: windows-874 (ต้นเหตุ richsport.co.th) ────────
console.log('▸ decode byte-level: windows-874 → ข้อความไทยต้องไม่เพี้ยน');
{
  // bytes 0xA1 0xA2 0xA3 0xA4 ใน TIS-620/windows-874 = "กขฃค"
  const head = Buffer.from('<html><body>', 'latin1');
  const thai = Buffer.from([0xA1, 0xA2, 0xA3, 0xA4]);
  const tail = Buffer.from('</body></html>', 'latin1');
  const buf = Buffer.concat([head, thai, tail]);
  const fakeRes = {
    headers: { get: (k) => (k.toLowerCase() === 'content-type' ? 'text/html; charset=windows-874' : '') },
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  };
  const { html, charset } = await decodeHtmlFromResponse(fakeRes);
  const okCharset = charset === 'windows-874';
  const okThai = html.includes('กขฃค');
  assert(okCharset, 'decode :: charset detect', `ได้ "${charset}"`);
  assert(okThai, 'decode :: Thai text', `ถอดได้: "${html.replace(/<[^>]+>/g, '')}"`);
  console.log(`    ${okCharset ? '✅' : '❌'} charset = ${charset}`);
  console.log(`    ${okThai ? '✅' : '❌'} ข้อความไทยถอดถูก: "${html.replace(/<[^>]+>/g, '')}"`);
  console.log('');
}

// ── Summary ─────────────────────────────────────────────────────────────
console.log('══════════════════════════════════════════════════════════════');
if (failed === 0) {
  console.log(`  ✅ ผ่านทั้งหมด ${passed}/${passed} assertion`);
  console.log('══════════════════════════════════════════════════════════════\n');
  process.exit(0);
} else {
  console.log(`  ❌ ไม่ผ่าน ${failed}/${passed + failed} assertion`);
  console.log('──────────────────────────────────────────────────────────────');
  for (const f of failures) console.log(`  • ${f.label}\n    ${f.detail}`);
  console.log('══════════════════════════════════════════════════════════════\n');
  process.exit(1);
}
