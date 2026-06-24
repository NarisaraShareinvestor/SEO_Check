// Report Deck — รายงานฉบับลูกค้าระดับ proposal เอเจนซี่ สร้างจากข้อมูล audit จริง
// โครงอ้างอิง deck มาตรฐานเอเจนซี่ (เช่นตัวอย่างใน EXsam/) แต่เหนือกว่า: ข้อมูลสด + หลักฐานเชิงประจักษ์
import { COPYRIGHT_HTML, MAKER_CSS, watermarkScript } from './brand-logo.js';
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const stripEmoji = (s) => String(s ?? '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').trim();
const trunc = (s, n) => { s = stripEmoji(s); return s.length > n ? s.slice(0, n) + '…' : s; };

const chip = (st, label) => `<span class="chip ${st}">${esc(label)}</span>`;
const ST_TH = { fail: 'Fail', warn: 'Warn', pass: 'Pass', info: 'Info' };

const FLAG_LABELS = {
  ssr: 'เนื้อหาอยู่ใน HTML ดิบ (SSR)', jsonld: 'Structured Data (JSON-LD)', orgSchema: 'Organization schema',
  faq: 'FAQ schema (GEO)', aiBots: 'เปิดรับ AI bots', llms: 'llms.txt',
  canonical: 'Canonical tags', sitemap: 'XML Sitemap', h1: 'H1 ครบทุกหน้า',
  desc: 'Meta description', og: 'Open Graph', trust: 'Trust pages',
  eeat: 'E-E-A-T signals', cwv: 'Core Web Vitals',
};

export function renderReport(audit, brand = {}) {
  const host = audit.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const dateTh = new Date(audit.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  const brandName = brand.name || 'AI SEO Audit Pro';
  const brandLogo = brand.logo || '';
  const brandColor = brand.color || '';
  const s = audit.score;
  const byId = (id) => audit.checks.find(c => c.id === id);
  const fails = audit.checks.filter(c => c.status === 'fail');
  const geoChecks = audit.checks.filter(c => c.category === 'geo');
  const cwv = byId('cwv-score');
  const cwvField = byId('cwv-field');
  const renderDiff = byId('render-diff');
  const spaShell = byId('spa-shell');
  const a = audit.analysis || {};
  const comp = audit.competitor && !audit.competitor.error ? audit.competitor : null;
  const foot = () => `<footer><span>${esc(host)}</span><span>${COPYRIGHT_HTML}</span><span>SEO &amp; GEO Audit · ${esc(brandName)} · ${esc(dateTh)}</span><span>__PG__ / __TOTAL__</span></footer>`;

  // ── สไลด์ 1: ปก ──
  const cover = `
  <section class="slide dark">
    ${brandLogo ? `<img src="${esc(brandLogo)}" alt="" style="height:44px;width:auto;align-self:flex-start;margin-bottom:26px;object-fit:contain">` : ''}
    <div class="kick">SEO &amp; GEO Audit Report · จัดทำโดย ${esc(brandName)} · ${esc(dateTh)}</div>
    <h1>${esc(host)}</h1>
    <p class="sub">Technical SEO · Generative Engine Optimization · Core Web Vitals · เทียบคู่แข่ง — ตรวจ ${audit.pagesAnalyzed} หน้า ${audit.renderedAvailable ? '· เทียบ raw vs rendered ด้วย headless Chrome' : ''}</p>
    <div class="catstrip">
      ${Object.entries(s.categoryScores).map(([cat, sc]) => `<div class="ci"><b>${sc}</b><span>${esc(audit.categories[cat] || cat)}</span></div>`).join('')}
    </div>
    <div class="bigstats">
      <div class="bstat"><b>${s.overall}<small>/100</small></b><span>คะแนนรวม · เกรด ${s.grade}</span></div>
      <div class="bstat"><b>${s.counts.fail}</b><span>ปัญหาร้ายแรง (Fail)</span></div>
      <div class="bstat"><b>${s.counts.warn}</b><span>ควรปรับปรุง (Warn)</span></div>
      <div class="bstat"><b>${s.categoryScores.geo ?? '–'}</b><span>GEO — ความพร้อมบน AI Search</span></div>
    </div>
    ${foot()}
    <div class="goldstrip"></div>
  </section>`;

  // หน้าคั่น PART แบบ deck เอเจนซี่
  const divider = (no, title, sub) => `
  <section class="slide dark divider">
    <div class="kick">Part ${no}</div>
    <h1>${title}</h1>
    <p class="sub">${sub}</p>
    ${foot()}
    <div class="goldstrip"></div>
  </section>`;

  // ── สไลด์ 2: บทสรุปผู้บริหาร ──
  const keyFindings = fails.filter(c => c.severity === 'high').slice(0, 6);
  const execSlide = `
  <section class="slide">
    <div class="kick">Executive Summary</div>
    <h2>เว็บไซต์ยืนอยู่ตรงไหนวันนี้</h2>
    <p class="lede">${esc(stripEmoji(a.executiveSummary || ''))}</p>
    <div class="circles">
      <div class="circ gold"><b>${s.overall}<small>/100</small></b><span>คะแนนรวม · เกรด ${s.grade}</span></div>
      <div class="circ navy"><b>${s.counts.fail}</b><span>ปัญหาร้ายแรง</span></div>
      <div class="sidecard">
        <b>ข้อค้นพบสำคัญ (จากการตรวจจริง ${audit.pagesAnalyzed} หน้า)</b>
        <ul>${keyFindings.slice(0, 5).map(c => `<li><b>${esc(stripEmoji(c.title))}</b> — ${esc(trunc(c.detail, 110))}</li>`).join('')}</ul>
      </div>
    </div>
    ${a.strategicAdvice ? `<p class="note">${esc(stripEmoji(a.strategicAdvice))}</p>` : ''}
    ${foot()}
  </section>`;

  // ── สไลด์ 3: Health Check ──
  const order = { fail: 0, warn: 1, pass: 2, info: 3 };
  const healthRows = [...audit.checks]
    .filter(c => c.severity !== 'low' && c.status !== 'info' && c.category !== 'geo')
    .sort((x, y) => (order[x.status] - order[y.status]))
    .slice(0, 13);
  const healthSlide = `
  <section class="slide">
    <div class="kick">Technical SEO Audit</div>
    <h2>On-Site Health Check</h2>
    <table>
      <tr><th style="width:30%">รายการตรวจ</th><th style="width:72px">สถานะ</th><th>รายละเอียดจากการตรวจจริง</th></tr>
      ${healthRows.map(c => `<tr><td><b>${esc(stripEmoji(c.title))}</b></td><td>${chip(c.status, ST_TH[c.status])}</td><td>${esc(trunc(c.detail, 165))}</td></tr>`).join('')}
    </table>
    ${foot()}
  </section>`;

  // ── สไลด์ 4: ปัญหาเรียงตามผลกระทบธุรกิจ ──
  const prioSlide = (a.topPriorities || []).length ? `
  <section class="slide">
    <div class="kick">Priority Action Plan</div>
    <h2>ปัญหาเรียงตามผลกระทบต่อธุรกิจ</h2>
    <table>
      <tr><th style="width:34px">#</th><th style="width:26%">ปัญหา</th><th>ผลกระทบต่อธุรกิจ</th><th style="width:76px">ความยาก</th><th style="width:96px">ช่วงเวลา</th></tr>
      ${a.topPriorities.map(p => `<tr><td><b>${p.rank}</b></td><td><b>${esc(stripEmoji(p.title))}</b></td><td>${esc(trunc(p.businessImpact, 160))}</td><td>${esc(p.effort)}</td><td>${esc(p.timeline)}</td></tr>`).join('')}
    </table>
    ${(a.quickWins || []).length ? `<div class="qrow"><b>Quick wins ภายใน 1 วัน:</b> ${a.quickWins.map(q => `<span class="qwin">${esc(stripEmoji(q))}</span>`).join('')}</div>` : ''}
    ${foot()}
  </section>` : '';

  // ── สไลด์ 5: หลักฐาน Rendered Crawl ──
  const renderSlide = (renderDiff && renderDiff.status !== 'info') || (spaShell && spaShell.status === 'fail') ? `
  <section class="slide">
    <div class="kick">Rendered Crawl Evidence</div>
    <h2>สิ่งที่ Google และ AI bots มองเห็นจริง</h2>
    <p class="lede">เปรียบเทียบ HTML ดิบ (ที่ crawler เห็นครั้งแรก และที่ AI bots เห็นเสมอ — GPTBot, ClaudeBot, PerplexityBot ไม่รัน JavaScript) กับหน้าหลัง render ด้วย headless Chrome</p>
    ${spaShell?.status === 'fail' ? `<div class="alert"><b>${esc(stripEmoji(spaShell.title))}</b><br>${esc(trunc(spaShell.detail, 280))}</div>` : ''}
    ${renderDiff?.status === 'fail' ? `
      <table>
        <tr><th>หลักฐานรายหน้า (raw vs rendered)</th></tr>
        ${(renderDiff.pages || []).slice(0, 5).map(p => `<tr><td class="mono">${esc(p)}</td></tr>`).join('')}
      </table>` : renderDiff?.status === 'pass' ? `<div class="okbox">${esc(renderDiff.detail)}</div>` : ''}
    <p class="note">วิธีแก้: ${esc(stripEmoji(spaShell?.recommendation || renderDiff?.recommendation || ''))}</p>
    ${foot()}
  </section>` : '';

  // ── สไลด์ 6: Core Web Vitals ──
  const cwvSlide = cwv && !/ข้าม|ไม่สำเร็จ/.test(cwv.title) ? `
  <section class="slide">
    <div class="kick">Performance — วัดจริงโดย Google</div>
    <h2>Core Web Vitals</h2>
    <div class="cwvrow">
      <div class="cwvcard"><span>Lighthouse (มือถือ)</span><b>${esc(cwv.title.match(/(\d+)\/100/)?.[1] ?? '–')}</b>${chip(cwv.status, ST_TH[cwv.status])}</div>
      ${cwvField && !/ไม่มี field/.test(cwvField.title) ? `<div class="cwvcard"><span>ผู้ใช้จริง (CrUX 28 วัน)</span><b style="font-size:22px">${esc(cwvField.title.replace('Core Web Vitals จากผู้ใช้จริง: ', '').split(' ')[0])}</b>${chip(cwvField.status, ST_TH[cwvField.status])}</div>` : ''}
    </div>
    <p class="lede">${esc(stripEmoji(cwv.detail))}</p>
    ${cwvField ? `<p class="lede">${esc(stripEmoji(cwvField.detail))}</p>` : ''}
    ${cwv.recommendation ? `<div class="findbox"><b>จุดที่ลดเวลาโหลดได้มากที่สุด</b><p>${esc(stripEmoji(cwv.recommendation))}</p></div>` : ''}
    ${foot()}
  </section>` : '';

  // ── สไลด์ 7: GEO Checklist ──
  const geoSlide = geoChecks.length ? `
  <section class="slide">
    <div class="kick">GEO Readiness — ยุค AI Search</div>
    <h2>Generative Engine Optimization Checklist</h2>
    <p class="lede">การค้นหากำลังย้ายไป ChatGPT, Google AI Overview และ Perplexity — ตารางนี้คือความพร้อมของเว็บต่อการถูก AI อ้างถึง</p>
    <table>
      <tr><th style="width:30%">สัญญาณ GEO</th><th style="width:72px">สถานะ</th><th>รายละเอียด</th></tr>
      ${geoChecks.map(c => `<tr><td><b>${esc(stripEmoji(c.title))}</b></td><td>${chip(c.status, ST_TH[c.status])}</td><td>${esc(trunc(c.detail, 150))}</td></tr>`).join('')}
    </table>
    ${foot()}
  </section>` : '';

  // ── สไลด์ 8: เทียบคู่แข่ง ──
  let compSlide = '';
  if (comp) {
    const { ours, theirs, commentary } = comp;
    const rank = { pass: 0, warn: 1, fail: 2 };
    const rows = Object.entries(FLAG_LABELS).map(([k, label]) => {
      const u = ours.flags[k], t = theirs.flags[k];
      if (!u && !t) return '';
      const verdict = (u && t) ? (rank[u] < rank[t] ? chip('pass', 'เราชนะ') : rank[u] > rank[t] ? chip('fail', 'เราแพ้') : chip('info', 'เสมอ')) : chip('info', '–');
      return `<tr><td>${esc(label)}</td><td>${u ? chip(u, ST_TH[u]) : '–'}</td><td>${t ? chip(t, ST_TH[t]) : '–'}</td><td>${verdict}</td></tr>`;
    }).join('');
    compSlide = `
  <section class="slide">
    <div class="kick">Competitor Comparison</div>
    <h2>${esc(host)} vs ${esc(theirs.url.replace(/^https?:\/\//, ''))}</h2>
    <div class="vsline">
      <div class="vsbox ${ours.overall >= theirs.overall ? 'win' : ''}"><span>เรา</span><b>${ours.overall}</b><i>เกรด ${ours.grade} · Fail ${ours.counts.fail}</i></div>
      <div class="vsmid">VS</div>
      <div class="vsbox ${theirs.overall > ours.overall ? 'win' : ''}"><span>คู่แข่ง</span><b>${theirs.overall}</b><i>เกรด ${theirs.grade} · Fail ${theirs.counts.fail}</i></div>
    </div>
    <table class="compact">
      <tr><th>ความสามารถ</th><th style="width:70px">เรา</th><th style="width:70px">คู่แข่ง</th><th style="width:80px">ผล</th></tr>
      ${rows}
    </table>
    ${commentary?.battlePlan?.length ? `<div class="findbox"><b>แผนแซง</b><ol>${commentary.battlePlan.slice(0, 3).map(b => `<li>${esc(stripEmoji(b))}</li>`).join('')}</ol></div>` : ''}
    ${foot()}
  </section>`;
  }

  // ── สไลด์ 9: Roadmap ──
  const wk1 = (a.topPriorities || []).filter(p => /1/.test(p.timeline || '')).map(p => p.title);
  const wkLater = (a.topPriorities || []).filter(p => !/1/.test(p.timeline || '')).map(p => p.title);
  const roadmapSlide = `
  <section class="slide">
    <div class="kick">Implementation Roadmap</div>
    <h2>แผนลงมือ 30 วันแรก</h2>
    <div class="timeline">
      <div class="tl-step"><div class="tl-dot">1</div><div class="tl-card"><b>Kick-off</b><i>วันที่ 0</i><p>รับไฟล์ Auto-Fix จากระบบ เข้าถึง Search Console / hosting / CMS วางแผนกับทีม dev</p></div></div>
      <div class="tl-step"><div class="tl-dot">2</div><div class="tl-card"><b>สัปดาห์ที่ 1</b><i>หยุดเลือดไหล</i><p>${esc(stripEmoji((wk1.length ? wk1 : fails.slice(0, 3).map(c => c.title)).slice(0, 3).join(' · ')))}</p></div></div>
      <div class="tl-step"><div class="tl-dot">3</div><div class="tl-card"><b>สัปดาห์ที่ 2</b><i>โครงสร้าง</i><p>${esc(stripEmoji((wkLater.length ? wkLater : ['Structured Data ครบทุกหน้า', 'แก้ canonical / duplicate']).slice(0, 3).join(' · ')))}</p></div></div>
      <div class="tl-step"><div class="tl-dot">4</div><div class="tl-card"><b>สัปดาห์ที่ 3</b><i>GEO</i><p>FAQ schema + เนื้อหาถาม-ตอบ · llms.txt · เปิดรับ AI bots ครบ 14 ตัว</p></div></div>
      <div class="tl-step"><div class="tl-dot">5</div><div class="tl-card"><b>สัปดาห์ที่ 4</b><i>วัดผล</i><p>ตรวจซ้ำทั้งระบบ เทียบคะแนนก่อน/หลังแก้ · ติดตาม Core Web Vitals · เปิดเฝ้าระวังอัตโนมัติ</p></div></div>
    </div>
    ${a.strategicAdvice ? `<div class="findbox"><b>กลยุทธ์ระยะยาว</b><p>${esc(stripEmoji(a.strategicAdvice))}</p></div>` : ''}
    ${foot()}
  </section>`;

  // ── สไลด์ 10: Auto-Fix ──
  const fixSlide = (audit.fixes || []).length ? `
  <section class="slide">
    <div class="kick">Deliverables — ไม่ใช่แค่รายงาน</div>
    <h2>ไฟล์แก้ที่ระบบสร้างให้แล้ว ${audit.fixes.length} ชุด</h2>
    <p class="lede">ต่างจาก audit ทั่วไปที่จบที่ "รายการปัญหา" — รายงานนี้มาพร้อมไฟล์แก้ที่สร้างจากข้อมูลจริงของเว็บ พร้อมนำไปใช้ทันที</p>
    <table>
      <tr><th style="width:30%">ไฟล์</th><th>แก้อะไร</th></tr>
      ${audit.fixes.map(f => `<tr><td class="mono">${esc(f.filename)}</td><td><b>${esc(stripEmoji(f.title))}</b><br><span class="dim">${esc(trunc(f.description, 120))}</span></td></tr>`).join('')}
    </table>
    ${foot()}
  </section>` : '';

  // ── สไลด์ 11: Methodology ──
  const methodSlide = `
  <section class="slide">
    <div class="kick">Methodology &amp; References</div>
    <h2>มาตรฐานที่ใช้ตรวจ</h2>
    <ul class="refs">
      <li><b>Technical SEO (200+ จุดตรวจ)</b> — อ้างอิง Google Search Essentials และเอกสาร Google Search Central: title/meta, H1, canonical, robots.txt, sitemap, hreflang, indexability, redirect</li>
      <li><b>Core Web Vitals</b> — วัดจริงผ่าน Google PageSpeed Insights API (Lighthouse + Chrome UX Report) — เป็น ranking signal อย่างเป็นทางการของ Google</li>
      <li><b>Structured Data</b> — ตามสเปค schema.org และเงื่อนไข Google Rich Results</li>
      <li><b>Rendered Crawl</b> — เทียบ HTML ดิบกับหน้า render จริงด้วย headless Chrome ตามพฤติกรรม two-wave indexing ของ Googlebot และข้อจำกัดของ AI crawlers ที่ไม่รัน JavaScript</li>
      <li><b>E-E-A-T &amp; Trust</b> — ตาม Google Search Quality Rater Guidelines</li>
      <li><b>GEO</b> — แนวปฏิบัติล่าสุดสำหรับ AI Search (ChatGPT, AI Overview, Perplexity): bot access, llms.txt, direct-answer content, FAQ schema</li>
    </ul>
    <p class="note">คะแนนรวม 0–100 เป็นระบบถ่วงน้ำหนักภายในสำหรับเทียบก่อน/หลังแก้และเทียบคู่แข่งภายใต้เกณฑ์เดียวกัน · ตรวจเมื่อ ${esc(dateTh)} · ทุกข้อค้นพบตรวจสอบย้อนกลับได้จากข้อมูล crawl จริง</p>
    ${foot()}
  </section>`;

  const out = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SEO &amp; GEO Audit — ${esc(host)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--navy:#0e2240;--navy2:#16305a;--gold:#f5c242;--goldtx:#c79a18;--ink:#1c2b40;--mut:#5b6c85;--faint:#8b97a8;--border:#e6e9f0;--paper:#f6f8fb;
--red:#e74c5e;--amber:#f0a92e;--teal:#19b394}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter','Noto Sans Thai',sans-serif;background:#dfe5ee;color:var(--ink);line-height:1.6;font-size:14px;-webkit-font-smoothing:antialiased}
.slide{width:1188px;min-height:840px;background:#fff;margin:28px auto;padding:60px 72px 26px;display:flex;flex-direction:column;box-shadow:0 8px 30px rgba(14,34,64,.28)}
.slide.dark{background:var(--navy);color:#fff}
.kick{font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:var(--goldtx);margin-bottom:14px}
.dark .kick{color:var(--gold)}
h1{font-size:56px;font-weight:800;letter-spacing:-.02em;line-height:1.12;margin-bottom:10px}
h2{font-size:31px;font-weight:800;letter-spacing:-.01em;color:var(--navy);margin-bottom:8px}
h2::after{content:'';display:block;width:54px;height:5px;background:var(--gold);border-radius:3px;margin:12px 0 16px}
.sub{color:#b9c4d6;font-size:15px;max-width:780px}
.lede{font-size:14.5px;color:#3b4d68;max-width:980px;margin-bottom:16px}
.bigstats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:auto;margin-bottom:22px}
.bstat{border:1px solid rgba(245,194,66,.55);border-top:4px solid var(--gold);padding:22px 26px;background:rgba(255,255,255,.03)}
.bstat b{font-size:42px;font-weight:800;display:block;line-height:1.1;color:var(--gold)}
.bstat b small{font-size:16px;color:#7e8da6;font-weight:600}
.bstat span{font-size:12.5px;color:#b9c4d6}
.catstrip{display:grid;grid-template-columns:repeat(9,1fr);gap:10px;margin:42px 0 22px}
.catstrip .ci{border-left:3px solid var(--gold);padding:6px 0 2px 12px}
.catstrip .ci b{display:block;font-size:22px;font-weight:800;color:#fff}
.catstrip .ci span{font-size:10px;color:#8fa3c2;line-height:1.3;display:block}
table{width:100%;border-collapse:collapse;font-size:12.5px;background:#fff}
th{text-align:left;padding:10px 14px;background:var(--navy);color:#fff;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;font-weight:700}
td{padding:8.5px 14px;border-bottom:1px solid #edf0f5;vertical-align:top}
table.compact td{padding:5.5px 14px}
.chip{display:inline-block;padding:2.5px 13px;border-radius:4px;font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#fff;white-space:nowrap}
.chip.fail{background:var(--red)} .chip.warn{background:var(--amber)} .chip.pass{background:var(--teal)} .chip.info{background:#8b97a8}
.findbox{background:var(--paper);border:1px solid var(--border);border-left:5px solid var(--gold);padding:18px 26px}
.findbox b{font-size:13.5px;color:var(--navy)}
.findbox ul,.findbox ol{padding-left:20px;margin-top:8px}
.findbox li{font-size:12.5px;color:#3b4d68;margin-bottom:4px}
.findbox p{font-size:12.5px;color:#3b4d68;margin-top:6px}
.alert{background:#fdecee;border-left:5px solid var(--red);padding:16px 22px;font-size:13px;color:#7a2030;margin-bottom:16px}
.okbox{background:#e9f7f3;border-left:5px solid var(--teal);padding:16px 22px;font-size:13px;color:#0c5b4a;margin-bottom:16px}
.mono{font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#3b4d68}
.dim{color:var(--mut);font-size:11.5px}
.note{font-size:12px;color:var(--mut);font-style:italic;margin-top:12px}
.qrow{margin-top:4px;font-size:12.5px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:14px}
.qwin{background:var(--gold);color:var(--navy);font-size:11.5px;font-weight:700;padding:3px 14px;border-radius:4px}
.circles{display:flex;gap:44px;align-items:center;margin:6px 0 22px}
.circ{width:235px;height:235px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;text-align:center}
.circ.gold{background:var(--gold);color:var(--navy)}
.circ.navy{background:var(--navy);color:var(--gold)}
.circ b{font-size:62px;font-weight:800;line-height:1.05}
.circ b small{font-size:20px;font-weight:700;opacity:.65}
.circ span{font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;margin-top:4px}
.circ.navy span{color:#cfd9ea}
.sidecard{flex:1;background:var(--paper);border:1px solid var(--border);padding:22px 28px;align-self:stretch;display:flex;flex-direction:column;justify-content:center}
.sidecard b{font-size:16px;color:var(--navy)}
.sidecard ul{padding-left:18px;margin-top:10px}
.sidecard li{font-size:12.5px;color:#3b4d68;margin-bottom:7px}
.cwvrow{display:flex;gap:16px;margin-bottom:18px}
.cwvcard{border:1px solid var(--border);border-top:4px solid var(--gold);padding:18px 26px;display:flex;flex-direction:column;gap:4px;min-width:220px;background:var(--paper)}
.cwvcard span{font-size:11.5px;color:var(--mut)} .cwvcard b{font-size:38px;font-weight:800;line-height:1.1;color:var(--navy)}
.vsline{display:flex;gap:18px;align-items:center;margin-bottom:18px}
.vsbox{flex:1;border:1px solid var(--border);border-top:4px solid #c4cedd;padding:14px 24px;background:var(--paper)}
.vsbox.win{border-top-color:var(--gold);background:#fffbee}
.vsbox span{font-size:11px;color:var(--mut);letter-spacing:.08em;text-transform:uppercase;font-weight:700}
.vsbox b{font-size:36px;font-weight:800;display:block;line-height:1.1;color:var(--navy)} .vsbox i{font-style:normal;font-size:11.5px;color:var(--mut)}
.vsmid{font-weight:800;color:var(--gold);font-size:18px}
.cols{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-bottom:18px}
.col{border:1px solid var(--border);background:var(--paper);padding:18px 22px}
.colh{font-size:12px;font-weight:800;letter-spacing:.06em;color:var(--navy);border-bottom:3px solid var(--gold);padding-bottom:8px;margin-bottom:10px}
.col ul{padding-left:18px} .col li{font-size:12.5px;color:#3b4d68;margin-bottom:6px}
.refs{padding-left:20px;max-width:1000px} .refs li{font-size:13.5px;color:#3b4d68;margin-bottom:12px}
footer{margin-top:auto;padding-top:22px;display:flex;justify-content:space-between;font-size:10.5px;color:var(--faint);border-top:1px solid var(--border)}
.dark footer{border-top-color:rgba(255,255,255,.14);color:#7e8da6}
table,.findbox,.cols,.vsline,.cwvrow,.alert,.okbox,.refs{margin-bottom:18px}
/* หน้าคั่น PART แบบ deck เอเจนซี่ */
.slide.divider{position:relative}
.slide.divider .kick{margin-top:auto}
.slide.divider .kick{font-size:14px;letter-spacing:.3em}
.slide.divider h1{font-size:58px;max-width:900px}
.slide.divider .sub{font-size:16px;margin-top:14px}
.slide{position:relative}
.goldstrip{position:absolute;left:0;right:0;bottom:0;height:12px;background:var(--gold)}
/* timeline วงกลมทองแบบหน้า 30-Day Plan */
.timeline{display:flex;gap:0;margin:34px 0 20px;position:relative}
.timeline::before{content:'';position:absolute;top:26px;left:9%;right:9%;height:3px;background:var(--gold)}
.tl-step{flex:1;position:relative;padding:0 14px;text-align:center}
.tl-dot{width:52px;height:52px;border-radius:50%;background:var(--gold);color:var(--navy);font-weight:800;font-size:20px;display:flex;align-items:center;justify-content:center;margin:0 auto 18px;position:relative;z-index:1;box-shadow:0 0 0 6px #fff}
.tl-card{background:var(--paper);border:1px solid var(--border);padding:16px 14px;min-height:170px;text-align:left}
.tl-card b{font-size:13px;color:var(--navy);display:block;text-align:center;margin-bottom:2px}
.tl-card i{font-style:italic;font-size:11px;color:#2a9db8;display:block;text-align:center;margin-bottom:10px}
.tl-card p{font-size:11.5px;color:#3b4d68;line-height:1.55}
.toolbar{position:fixed;top:16px;right:20px;z-index:9;display:flex;gap:8px}
.toolbar button{padding:10px 22px;border-radius:8px;border:none;background:var(--navy);color:var(--gold);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 3px 12px rgba(14,34,64,.4)}
@media print{
  body{background:#fff}
  .toolbar{display:none}
  .slide{margin:0;box-shadow:none;page-break-after:always;width:100%;min-height:100vh}
  th,.chip,.circ,.dark,.bstat,.qwin{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  @page{size:297mm 210mm;margin:0}
}
${MAKER_CSS}
</style>
${brandColor ? `<style>:root{--gold:${esc(brandColor)};--goldtx:${esc(brandColor)}}</style>` : ''}
</head>
<body>
<div class="toolbar"><button onclick="exportPPTX('SEO-Audit-${esc(host)}', this)">บันทึกเป็น PowerPoint</button><button onclick="window.print()">บันทึกเป็น PDF</button></div>
${cover}
${execSlide}
${divider(1, 'ผลตรวจ Technical SEO', 'Health check จากการ crawl จริง · หลักฐาน rendered crawl · Core Web Vitals วัดโดย Google')}
${healthSlide}
${prioSlide}
${renderSlide}
${cwvSlide}
${divider(2, 'GEO &amp; การแข่งขัน', 'ความพร้อมบน ChatGPT / AI Overview / Perplexity และตำแหน่งของคุณเทียบคู่แข่งภายใต้เกณฑ์เดียวกัน')}
${geoSlide}
${compSlide}
${divider(3, 'แผนปฏิบัติ &amp; สิ่งที่ส่งมอบ', 'แผน 30 วันพร้อมไฟล์แก้ที่สร้างเสร็จแล้ว — ลงมือได้ทันทีไม่ต้องรอ')}
${roadmapSlide}
${fixSlide}
${methodSlide}
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js"></script>
<script src="/export-pptx.js"></script>
${watermarkScript()}
</body>
</html>`;
  // ไล่เลขหน้าตามลำดับแสดงผลจริง (หน้าคั่นถูกสร้างทีหลังแต่แทรกกลางเล่ม)
  let n = 0;
  const numbered = out.replace(/__PG__/g, () => String(++n));
  return numbered.replaceAll('__TOTAL__', String(n));
}
