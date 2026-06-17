// Sales Q&A Prep — คู่มือ "เตรียมตอบคำถาม" ที่เซลส์จะโดนถามตอนนำเสนอผลตรวจ
// ธีมเดียวกับรายงาน Deck A4 · สร้างจาก audit จริง (ตัวเลข/ปัญหาเด่น) + ชุดคำถามรับมือข้อโต้แย้งมาตรฐาน
import { explainOf } from './report-sales.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const stripEmoji = (s) => String(s ?? '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').trim();
const full = (s) => stripEmoji(s);
const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

export function renderSalesQA(audit, brand = {}) {
  const host = audit.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const dateTh = new Date(audit.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  const brandName = brand.name || 'AI SEO Audit Pro';
  const brandLogo = brand.logo || '';
  const brandColor = brand.color || '';
  const s = audit.score;
  const n = audit.pagesAnalyzed;
  const gradeWord = (g) => ({ A: 'แข็งแรงมาก', B: 'ดี แต่มีจุดพัฒนา', C: 'พอใช้ ต้องปรับหลายจุด', D: 'อ่อน ต้องรีบแก้', F: 'วิกฤต ต้องลงมือด่วน' }[g] || 'ต้องปรับปรุง');
  const foot = () => `<footer><span>${esc(host)}</span><span>เตรียมตอบคำถาม (Q&amp;A) · ${esc(brandName)} · ${esc(dateTh)}</span><span>__PG__ / __TOTAL__</span></footer>`;

  const fails = audit.checks.filter(c => c.status === 'fail');
  const sevOrder = { high: 0, med: 1, low: 2 };
  const topFails = [...fails].sort((x, y) => (sevOrder[x.severity] ?? 3) - (sevOrder[y.severity] ?? 3)).slice(0, 6);
  const topTitles = topFails.slice(0, 3).map(c => full(c.title)).join(' · ') || 'จุดทางเทคนิคหลายข้อที่ Google ใช้ตัดสินอันดับ';
  const comp = audit.competitor && !audit.competitor.error ? audit.competitor : null;

  // ── ชุดคำถาม-คำตอบ ──
  // โครง { q, a, tip? } · tip = ประโยคปิดการขาย/เคล็ดลับตอบ
  const sectionGeneral = [
    {
      q: `คะแนน ${s.overall}/100 นี่ถือว่าแย่ไหม?`,
      a: `คะแนนนี้คือ "สุขภาพเว็บโดยรวม" เทียบกับมาตรฐานที่ Google แนะนำ — ${s.overall} คะแนน เกรด ${s.grade} แปลว่าอยู่ระดับ "${gradeWord(s.grade)}" ข่าวดีคือเกือบทุกข้อที่เจอเป็นเรื่องที่แก้ได้ และพอแก้แล้วคะแนนจะขยับขึ้นเห็นชัด`,
      tip: `ปิดด้วย: "เราตรวจซ้ำให้ดูคะแนนก่อน–หลังแก้ได้เลย จะได้เห็นว่าดีขึ้นจริงเป็นตัวเลข"`,
    },
    {
      q: `ตัวเลขพวกนี้เชื่อถือได้แค่ไหน เอามาจากไหน?`,
      a: `ทุกตัวเลขมาจากการเปิดเว็บจริงทีละหน้า (ตรวจ ${n} หน้า) บวกกับข้อมูลความเร็วที่วัดโดย Google เองผ่าน PageSpeed/Core Web Vitals ไม่ใช่การเดา — ทุกข้อชี้กลับไปที่หน้าจริงได้ และตรวจกี่รอบผลก็เท่าเดิม`,
      tip: `ถ้าลูกค้าสายเทคนิค: เทียบกับเครื่องมือ Google ได้เลย (Rich Results Test / PageSpeed Insights) ผลตรงกัน`,
    },
    {
      q: `ทำไมเว็บเราถึงได้คะแนนเท่านี้?`,
      a: `หลักๆ มาจาก ${topTitles} — พวกนี้เป็นจุดที่ทั้ง Google และลูกค้าสะดุด พอแก้จุดใหญ่ๆ ก่อน คะแนนจะดีขึ้นเร็วที่สุด`,
    },
    comp ? {
      q: `แล้วคู่แข่งเราเป็นยังไงบ้าง?`,
      a: `เราเทียบกับ ${esc(String(comp.theirs?.url || '').replace(/^https?:\/\//, ''))} ภายใต้เกณฑ์เดียวกันแล้ว — เรา ${comp.ours?.overall ?? '–'} คะแนน เขา ${comp.theirs?.overall ?? '–'} คะแนน จุดที่ต่างกันคือโอกาสที่เราจะแซงได้`,
    } : {
      q: `แล้วคู่แข่งเราเป็นยังไงบ้าง?`,
      a: `เราเทียบกับคู่แข่งได้ภายใต้เกณฑ์เดียวกัน ถ้าบอกชื่อเว็บคู่แข่งมา เดี๋ยวรันเทียบให้เห็นตัวเลขชัดๆ ว่าเราแพ้/ชนะตรงไหน — มักเป็นจุดที่ปิดการขายได้ดีเพราะลูกค้าเห็นภาพทันที`,
    },
    {
      q: `ถ้าปล่อยไว้ไม่แก้ จะเกิดอะไรขึ้น?`,
      a: `เว็บจะยังหาเจอยากบน Google คู่แข่งที่แก้แล้วจะขึ้นนำ และในยุค AI ถ้าเว็บไม่พร้อม เวลาคนถาม ChatGPT/AI เรื่องที่เราขาย มันจะไปแนะนำคู่แข่งแทน — ยิ่งช้ายิ่งเสียลูกค้าให้คนอื่นทุกวัน`,
    },
  ].filter(Boolean);

  const sectionIssues = topFails.map(c => {
    const ex = explainOf(c);
    return {
      q: `"${full(c.title)}" คืออะไร แล้วทำไมเราต้องแก้?`,
      a: `${ex.what || full(c.detail)}${ex.why ? ' — ' + ex.why : ''}`,
    };
  });

  const sectionObjection = [
    {
      q: `แก้ทั้งหมดนี้ใช้เวลานานไหม?`,
      a: `หลายข้อเป็น "quick win" แก้ได้ใน 1–2 วัน เช่น ชื่อหน้า/คำโปรย/ป้าย canonical/ฉลากข้อมูล ส่วนเรื่องความเร็วหรือโครงสร้างใช้เวลามากกว่าหน่อย เราจัดลำดับให้แก้จุดที่คุ้มที่สุดก่อนเสมอ เพื่อให้เห็นผลเร็ว`,
    },
    {
      q: `ต้องรื้อทำเว็บใหม่ทั้งหมดเลยไหม?`,
      a: `ส่วนใหญ่ไม่ต้อง — เป็นการปรับแต่งบนเว็บเดิม (เพิ่มฉลากข้อมูล ปรับส่วนหัวหน้า ใส่คำบรรยายรูป ปรับความเร็ว) ระบบเรายังสร้างไฟล์ที่แก้ให้เสร็จพร้อมนำไปวางได้เลยด้วย`,
    },
    {
      q: `ราคาเท่าไร แล้วมันคุ้มไหม?`,
      a: `มองเป็นการลงทุน: ทุกอันดับที่ขยับขึ้นบน Google = ลูกค้าที่เจอเราแทนคู่แข่ง ลองคิดง่ายๆ ว่าถ้าได้ลูกค้าเพิ่มเดือนละไม่กี่ราย ก็คุ้มค่าบริการแล้ว`,
      tip: `อย่าเริ่มที่ราคา — ให้ลูกค้าเห็นมูลค่า (ลูกค้าที่เสียให้คู่แข่ง) ก่อน แล้วราคาจะดูเล็กลง`,
    },
    {
      q: `การันตีว่าอันดับขึ้นไหม?`,
      a: `ไม่มีใครการันตีอันดับ Google ได้จริง (ใครพูดแบบนั้นให้ระวัง) แต่สิ่งที่เราการันตีได้คือทำให้เว็บผ่านเกณฑ์ที่ Google ใช้ตัดสินครบถ้วน ซึ่งเป็นพื้นฐานที่ทำให้อันดับขึ้นได้จริง และเราวัดผลก่อน–หลังให้เห็นเป็นตัวเลข`,
      tip: `ความซื่อสัตย์ตรงนี้สร้างความเชื่อใจ — ลูกค้ากลัวคนที่สัญญาเกินจริง`,
    },
    {
      q: `จะเห็นผลเมื่อไร?`,
      a: `จุดทางเทคนิค (เช่น ผลค้นหาแบบพิเศษ ความเร็ว) เห็นผลได้ใน 2–4 สัปดาห์หลัง Google เก็บข้อมูลใหม่ ส่วนอันดับและจำนวนผู้เข้าชมจะค่อยๆ ขึ้นในช่วง 1–3 เดือน`,
    },
    {
      q: `เราแก้เองได้ไหม ทำไมต้องจ้าง?`,
      a: `แก้เองได้ถ้ามีทีมเทคนิคและเวลา — แต่จุดคุ้มของเราคือ รู้ว่าต้องแก้อะไรก่อน–หลังตามผลกระทบจริง มีไฟล์แก้ให้พร้อม และวัดผลยืนยันได้ ช่วยประหยัดเวลาลองผิดลองถูกไปมาก`,
    },
  ];

  const sectionTrust = [
    {
      q: `GEO หรือ AI Search คืออะไร สำคัญจริงเหรอ?`,
      a: `คนเริ่มถาม ChatGPT, Google AI Overview และ Perplexity แทนการพิมพ์ค้น Google มากขึ้นเรื่อยๆ ถ้าเว็บเราไม่พร้อมให้ AI อ่าน เวลามีคนถาม AI เรื่องที่เราขาย มันจะไปแนะนำคู่แข่งแทน — นี่คือสนามใหม่ที่เว็บไทยยังทำกันน้อย ทำก่อนได้เปรียบ`,
    },
    {
      q: `ทำ SEO ต่างจากการยิงโฆษณา (ยิงแอด) ยังไง?`,
      a: `ยิงแอดคือจ่ายเงินซื้อพื้นที่ พอหยุดจ่ายก็หายทันที ส่วน SEO คือการสร้างสินทรัพย์ที่ดึงลูกค้าเข้ามาฟรีในระยะยาว สองอย่างเสริมกันได้ และ SEO ที่ดีจะทำให้ทุกบาทที่ยิงแอดคุ้มขึ้นด้วย`,
    },
    {
      q: `ถ้า Google เปลี่ยนอัลกอริทึม สิ่งที่ทำจะเสียเปล่าไหม?`,
      a: `เราแก้ตามหลักพื้นฐานที่ Google ย้ำมาตลอด คือ เว็บเร็ว ปลอดภัย เนื้อหามีคุณภาพ และข้อมูลชัดเจน ซึ่งไม่ว่าอัลกอริทึมจะเปลี่ยนยังไงก็ยังสำคัญเสมอ ไม่ใช่เทคนิคหลอกระบบที่เสี่ยงโดนลงโทษภายหลัง`,
    },
  ];

  // ── เรนเดอร์ ──
  const qaCard = (item, i, startNo) => `
    <div class="qa">
      <div class="qa-q"><span class="qno">${startNo + i}</span><span class="qtext">${esc(full(item.q))}</span></div>
      <div class="qa-a"><span class="lbl">คำตอบแนะนำ</span> ${esc(full(item.a))}</div>
      ${item.tip ? `<div class="qa-tip"><span class="lbl">เคล็ดลับ</span> ${esc(full(item.tip))}</div>` : ''}
    </div>`;

  let runningNo = 0;
  const qaSlides = (items, kick, heading, lead, perPage = 3) => {
    if (!items.length) return '';
    const pages = chunk(items, perPage);
    return pages.map((grp, pi) => {
      const startNo = runningNo;
      runningNo += grp.length;
      return `
    <section class="slide">
      <div class="kick">${esc(kick)}</div>
      <h2>${esc(heading)}${pages.length > 1 ? ` <span class="pgof">(${pi + 1}/${pages.length})</span>` : ''}</h2>
      ${pi === 0 && lead ? `<p class="lede">${esc(lead)}</p>` : ''}
      ${grp.map((it, i) => qaCard(it, i, startNo + 1)).join('')}
      ${foot()}
    </section>`;
    }).join('');
  };

  const divider = (no, title, sub) => `
  <section class="slide dark divider">
    <div class="kick">หมวด ${no}</div>
    <h1>${title}</h1>
    <p class="sub">${sub}</p>
    ${foot()}
    <div class="goldstrip"></div>
  </section>`;

  const cover = `
  <section class="slide dark">
    ${brandLogo ? `<img src="${esc(brandLogo)}" alt="" style="height:44px;width:auto;align-self:flex-start;margin-bottom:26px;object-fit:contain">` : ''}
    <div class="kick">คู่มือเตรียมตอบคำถาม สำหรับทีมขาย · โดย ${esc(brandName)} · ${esc(dateTh)}</div>
    <h1>เตรียมตอบคำถาม<br>ก่อนนำเสนอลูกค้า</h1>
    <p class="sub">รวมคำถามที่ลูกค้ามักถามเซลส์ตอนนำเสนอผลตรวจ SEO ของ ${esc(host)} พร้อม "คำตอบแนะนำ" ที่พูดได้ทันทีโดยไม่ต้องเป็นสายเทคนิค — อ่านก่อนเข้าประชุมเพื่อความมั่นใจ</p>
    <div class="bigstats">
      <div class="bstat"><b>${sectionGeneral.length + sectionIssues.length + sectionObjection.length + sectionTrust.length}</b><span>คำถามพร้อมคำตอบ</span></div>
      <div class="bstat"><b>${s.overall}<small>/100</small></b><span>คะแนนเว็บที่จะนำเสนอ · เกรด ${s.grade}</span></div>
      <div class="bstat"><b>${s.counts.fail}</b><span>ปัญหาที่ต้องแก้ (ประเด็นขาย)</span></div>
      <div class="bstat"><b>4</b><span>หมวดคำถาม</span></div>
    </div>
    ${foot()}
    <div class="goldstrip"></div>
  </section>`;

  const intro = `
  <section class="slide">
    <div class="kick">วิธีใช้คู่มือนี้</div>
    <h2>ใช้ยังไงให้ปิดการขายง่ายขึ้น</h2>
    <div class="why-box">
      <b>หลักการตอบคำถามลูกค้า 3 ข้อ</b>
      <ol class="prio">
        <li><b>อย่าตอบด้วยศัพท์เทคนิค</b> — แปลเป็นผลต่อ "ลูกค้า/ยอดขาย" เสมอ (เช่น แทนที่จะพูด "ไม่มี schema" ให้พูดว่า "Google กับ AI ไม่รู้จักแบรนด์เรา เลยไปแนะนำคู่แข่งแทน")</li>
        <li><b>ทุกปัญหา = โอกาส</b> — ไม่ใช่ตำหนิเว็บลูกค้า แต่ชี้ว่า "นี่คือแต้มที่ยังไม่ได้เก็บ คู่แข่งก็ยังไม่ได้เก็บ ใครทำก่อนได้เปรียบ"</li>
        <li><b>ปิดด้วยการวัดผลได้</b> — ย้ำว่าทุกอย่างตรวจซ้ำเทียบก่อน–หลังเป็นตัวเลขได้ ลูกค้าจะมั่นใจว่าจ่ายแล้วเห็นผล</li>
      </ol>
    </div>
    <p class="note">คำตอบในเล่มนี้เป็น "แนวทาง" ปรับสำนวนให้เข้ากับลูกค้าแต่ละรายได้ · ตัวเลขทั้งหมดอ้างอิงผลตรวจจริงของ ${esc(host)} เมื่อ ${esc(dateTh)}</p>
    ${foot()}
  </section>`;

  const out = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>เตรียมตอบคำถาม (Q&amp;A) — ${esc(host)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--navy:#0e2240;--navy2:#16305a;--gold:#f5c242;--goldtx:#c79a18;--ink:#1c2b40;--mut:#5b6c85;--faint:#8b97a8;--border:#e6e9f0;--paper:#f6f8fb;
--red:#e74c5e;--amber:#f0a92e;--teal:#19b394}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter','Noto Sans Thai',sans-serif;background:#dfe5ee;color:var(--ink);line-height:1.6;font-size:14px;-webkit-font-smoothing:antialiased}
.slide{width:1188px;min-height:840px;background:#fff;margin:28px auto;padding:60px 72px 26px;display:flex;flex-direction:column;box-shadow:0 8px 30px rgba(14,34,64,.28);position:relative}
.slide.dark{background:var(--navy);color:#fff}
.kick{font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:var(--goldtx);margin-bottom:14px}
.dark .kick{color:var(--gold)}
h1{font-size:52px;font-weight:800;letter-spacing:-.02em;line-height:1.12;margin-bottom:10px}
h2{font-size:30px;font-weight:800;letter-spacing:-.01em;color:var(--navy);margin-bottom:8px}
h2::after{content:'';display:block;width:54px;height:5px;background:var(--gold);border-radius:3px;margin:12px 0 16px}
h2 .pgof{font-size:15px;font-weight:600;color:var(--mut)}
.sub{color:#b9c4d6;font-size:15px;max-width:880px}
.lede{font-size:14.5px;color:#3b4d68;max-width:1000px;margin-bottom:18px}
.bigstats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:auto;margin-bottom:22px}
.bstat{border:1px solid rgba(245,194,66,.55);border-top:4px solid var(--gold);padding:22px 26px;background:rgba(255,255,255,.03)}
.bstat b{font-size:40px;font-weight:800;display:block;line-height:1.1;color:var(--gold)}
.bstat b small{font-size:16px;color:#7e8da6;font-weight:600}
.bstat span{font-size:12.5px;color:#b9c4d6}
.why-box{background:var(--paper);border:1px solid var(--border);border-left:5px solid var(--gold);padding:18px 24px;margin:14px 0}
.why-box b{font-size:15px;color:var(--navy);display:block;margin-bottom:6px}
.prio{padding-left:22px;margin-top:6px}
.prio li{font-size:13.5px;color:#3b4d68;margin-bottom:10px}
.prio b{color:var(--navy)}
/* การ์ดคำถาม-คำตอบ */
.qa{border:1px solid var(--border);border-left:5px solid var(--navy);border-radius:8px;padding:15px 20px;margin-bottom:13px;background:#fff}
.qa-q{display:flex;gap:11px;align-items:flex-start;margin-bottom:9px}
.qa-q .qno{flex:0 0 auto;width:25px;height:25px;border-radius:50%;background:var(--navy);color:var(--gold);font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center}
.qa-q .qtext{font-size:16px;font-weight:800;color:var(--navy);line-height:1.34;padding-top:1px}
.qa-a,.qa-tip{font-size:13px;color:#33455f;line-height:1.58;margin-bottom:6px;padding-left:36px}
.qa-tip{padding-top:7px;border-top:1px dashed var(--border);color:#3b4d68}
.qa .lbl{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#fff;background:var(--teal);padding:2px 9px;border-radius:4px;margin-right:7px;vertical-align:middle}
.qa-tip .lbl{background:var(--goldtx)}
.note{font-size:12px;color:var(--mut);font-style:italic;margin-top:12px}
footer{margin-top:auto;padding-top:22px;display:flex;justify-content:space-between;font-size:10.5px;color:var(--faint);border-top:1px solid var(--border)}
.dark footer{border-top-color:rgba(255,255,255,.14);color:#7e8da6}
.goldstrip{position:absolute;left:0;right:0;bottom:0;height:12px;background:var(--gold)}
.slide.divider .kick{margin-top:auto;font-size:14px;letter-spacing:.3em}
.slide.divider h1{font-size:54px;max-width:920px}
.slide.divider .sub{font-size:16px;margin-top:14px}
.toolbar{position:fixed;top:16px;right:20px;z-index:9;display:flex;gap:8px}
.toolbar button{padding:10px 22px;border-radius:8px;border:none;background:var(--navy);color:var(--gold);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 3px 12px rgba(14,34,64,.4)}
@media print{
  body{background:#fff}
  .toolbar{display:none}
  .slide{margin:0;box-shadow:none;page-break-after:always;width:100%;min-height:100vh}
  .qa{break-inside:avoid}
  .chip,.dark,.bstat,.goldstrip,.qno,.lbl{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  @page{size:A4 landscape;margin:0}
}
</style>
${brandColor ? `<style>:root{--gold:${esc(brandColor)};--goldtx:${esc(brandColor)}}</style>` : ''}
</head>
<body>
<div class="toolbar"><button onclick="exportPPTX('Q&A-${esc(host)}', this)">บันทึกเป็น PowerPoint</button><button onclick="window.print()">บันทึกเป็น PDF</button></div>
${cover}
${intro}
${divider(1, 'คำถามเรื่องผลตรวจโดยรวม', 'คำถามแรกๆ ที่ลูกค้ามักถามเมื่อเห็นคะแนนและผลตรวจ')}
${qaSlides(sectionGeneral, 'หมวด 1 — ผลตรวจโดยรวม', 'คำถามเรื่องผลตรวจโดยรวม', 'ตอบให้ลูกค้าเห็นว่าคะแนนนี้หมายความว่าอะไร และทำไมถึงน่าเชื่อถือ')}
${divider(2, 'คำถามเจาะรายปัญหา', 'เมื่อลูกค้าชี้ที่ปัญหาข้อใดข้อหนึ่งแล้วถามว่า "อันนี้คืออะไร ทำไมต้องแก้"')}
${qaSlides(sectionIssues, 'หมวด 2 — เจาะรายปัญหา', 'คำถามเจาะรายปัญหาเด่น', 'แต่ละข้อคือปัญหาสำคัญที่อยู่ในรายงาน พร้อมคำอธิบายภาษาคนให้ตอบได้ทันที')}
${divider(3, 'คำถามเรื่องเวลา ราคา และการลงมือ', 'ข้อโต้แย้งที่พบบ่อยตอนใกล้ปิดการขาย — เตรียมไว้จะได้ไม่สะดุด')}
${qaSlides(sectionObjection, 'หมวด 3 — เวลา/ราคา/การลงมือ', 'คำถามเรื่องเวลา ราคา และการลงมือ')}
${divider(4, 'คำถามเชิงกลยุทธ์ & ความเชื่อมั่น', 'คำถามที่ลูกค้าใช้วัดว่าเรารู้จริงไหม และคุ้มที่จะลงทุนไหม')}
${qaSlides(sectionTrust, 'หมวด 4 — กลยุทธ์ & ความเชื่อมั่น', 'คำถามเชิงกลยุทธ์และความเชื่อมั่น')}
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js"></script>
<script src="/export-pptx.js"></script>
</body>
</html>`;
  let pg = 0;
  const numbered = out.replace(/__PG__/g, () => String(++pg));
  return numbered.replaceAll('__TOTAL__', String(pg));
}
