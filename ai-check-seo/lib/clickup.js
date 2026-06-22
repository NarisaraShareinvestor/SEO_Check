// ClickUp Automation (เฟส 1) — แปลง audit → Action Items แล้วสร้าง Task/Subtask ใน ClickUp
// 1 เว็บ = 1 Task (parent) · 1 ปัญหา (fail/warn) = 1 Subtask · กดส่งเองจากแดชบอร์ด
// buildPlan() = pure (ทดสอบ offline ได้) · pushToClickUp() = ยิง ClickUp REST API v2
import { readFileSync } from 'fs';
import { explainOf } from './report-sales.js';

const API = 'https://api.clickup.com/api/v2';

// ── แมป category (ของเรา) → กลุ่มงาน + ทีม (ตารางออกแบบข้อ 4.2) ──
const CATEGORY_MAP = {
  index:       { group: 'Indexing',       team: 'Technical SEO' },
  schema:      { group: 'Schema',         team: 'Technical SEO' },
  performance: { group: 'Performance',    team: 'Dev / DevOps' },
  onpage:      { group: 'Content / SEO',  team: 'Content / SEO' },
  geo:         { group: 'AI Readiness',   team: 'SEO + Dev' },
  links:       { group: 'Technical SEO',  team: 'Dev' },
  images:      { group: 'Technical SEO',  team: 'Dev' },
  rendering:   { group: 'Technical SEO',  team: 'Dev' },
  security:    { group: 'Technical SEO',  team: 'Dev' },
};
const groupOf = (cat) => CATEGORY_MAP[cat] || { group: 'SEO', team: 'SEO' };

// ── severity + status → ClickUp priority (1=Urgent..4=Low) + due (วัน) (ตารางข้อ 4.1) ──
function priorityOf(severity, status) {
  if (severity === 'high' && status === 'fail') return { priority: 1, label: 'Urgent', dueDays: 3 };
  if ((severity === 'high' && status === 'warn') || (severity === 'med' && status === 'fail'))
    return { priority: 2, label: 'High', dueDays: 7 };
  if (severity === 'med' && status === 'warn') return { priority: 3, label: 'Normal', dueDays: 14 };
  return { priority: 4, label: 'Low', dueDays: 30 };
}

const esc = (s) => String(s ?? '').trim();
const hostOf = (url) => esc(url).replace(/^https?:\/\//, '').replace(/\/$/, '');
const REPORT_BASE = process.env.PUBLIC_BASE_URL || 'https://seo.ohmai.me';

// ── check id → fix id (ตรงกับ generator ใน autofix.js) เพื่อหยิบ "โค้ดพร้อมใช้" จาก audit.fixes ──
const FIX_FOR_CHECK = {
  'robots-missing': 'fix-robots', 'robots-blocks-all': 'fix-robots', 'robots-blocks-section': 'fix-robots',
  'geo-bot-access': 'fix-robots', 'robots-sitemap': 'fix-robots',
  'sitemap-exists': 'fix-sitemap', 'sitemap-coverage': 'fix-sitemap',
  'schema-org': 'fix-org-schema', 'jsonld-missing': 'fix-org-schema', 'geo-entity': 'fix-org-schema',
  'geo-faq-schema': 'fix-faq-schema', 'geo-qa-content': 'fix-faq-schema',
  'geo-llms-txt': 'fix-llms-txt',
  'canonical-missing': 'fix-canonical',
  'security-headers': 'fix-headers', 'compression': 'fix-headers',
  'spa-shell': 'fix-ssr', 'geo-spa-risk': 'fix-ssr',
  'title-missing': 'fix-meta', 'desc-missing': 'fix-meta', 'title-length': 'fix-meta', 'title-duplicate': 'fix-meta',
  'hreflang': 'fix-hreflang',
};

// ── snippet สำเร็จรูปสำหรับ check ที่ไม่มีไฟล์ autofix เดี่ยว แต่แก้ได้ด้วยโค้ดสั้นๆ ──
const SNIPPET = {
  'viewport-missing': { language: 'html', label: 'viewport-meta', howTo: 'วางใน <head> ของทุกหน้า',
    code: '<meta name="viewport" content="width=device-width, initial-scale=1">' },
  'viewport-noscale': { language: 'html', label: 'viewport-meta', howTo: 'แทน viewport เดิม (เอา maximum-scale / user-scalable=no ออก เพื่อให้ผู้ใช้ซูมได้)',
    code: '<meta name="viewport" content="width=device-width, initial-scale=1">' },
};

// ── map URL → ชื่อหน้า (title) จากหน้าที่ crawl จริง เพื่อโชว์เป็นลิงก์ที่อ่านรู้เรื่อง ──
const normUrl = (u) => esc(u).replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase();
const cleanTitle = (t) => esc(t).replace(/�/g, '').replace(/\s+/g, ' ').trim(); // ตัด � (เว็บ charset เพี้ยน)
function pageTitleMap(audit) {
  const m = new Map();
  for (const p of audit.pages || []) {
    const t = cleanTitle(p.title);
    if (!t) continue;
    for (const u of [p.url, p.finalUrl]) {
      if (!u) continue;
      const n = normUrl(u);
      m.set(n, t);
      const bare = n.replace(/\?.*$/, '');
      if (!m.has(bare)) m.set(bare, t); // เผื่อ check.pages มี/ไม่มี query string
    }
  }
  return m;
}
const titleFor = (map, url) => { const n = normUrl(url); return map.get(n) || map.get(n.replace(/\?.*$/, '')) || ''; };

// แยกก้อน fix-meta (AI เขียนรวมทั้งเว็บ) เป็น map URL → บล็อก <title>/<meta> ของหน้านั้น
function metaBlockMap(audit) {
  const fx = (audit.fixes || []).find(f => f.id === 'fix-meta' && f.content);
  const map = new Map();
  if (fx) for (const part of String(fx.content).split(/(?=<!-- ═══ )/)) {
    const m = part.match(/<!-- ═══ (\S+)/);
    if (m) map.set(normUrl(m[1]), part.trim());
  }
  return map;
}

// recompute "หน้าที่กระทบครบทุกหน้า" จาก audit.pages (audit เก่าก็ครบ — ไม่ติด cap 50 ของ checks.js)
// คืน null เมื่อไม่ recompute → fixBlock จะ fallback ไปใช้ c.pages เดิม
function affectedPages(audit, c) {
  const ok = (audit.pages || []).filter(p => p.title !== undefined && p.status === 200);
  const U = p => p.finalUrl || p.url;
  const groupDup = (key) => {
    const by = new Map();
    ok.forEach(p => { const k = (key(p) || '').trim(); if (k) { if (!by.has(k)) by.set(k, []); by.get(k).push(U(p)); } });
    return [...by.values()].filter(v => v.length > 1).flat();
  };
  switch (c.id) {
    case 'canonical-missing': return ok.filter(p => !p.canonical).map(U);
    case 'title-missing':     return ok.filter(p => !p.title).map(U);
    case 'desc-missing':      return ok.filter(p => !p.description).map(U);
    case 'h1-missing':        return ok.filter(p => !(p.h1 || []).length).map(U);
    case 'title-duplicate':   return groupDup(p => p.title);
    case 'desc-duplicate':    return groupDup(p => p.description);
    default: return null;
  }
}

// map URL → page object (เอา rendered H1/title/desc จริงมาเสนอ) + เดาแบรนด์/ชื่อหน้าเป็น fallback
function pageByUrlMap(audit) {
  const m = new Map();
  for (const p of audit.pages || []) for (const u of [p.url, p.finalUrl]) if (u) { const n = normUrl(u); if (!m.has(n)) m.set(n, p); }
  return m;
}
function brandOf(audit) {
  const home = (audit.pages || []).find(p => { try { return new URL(p.finalUrl || p.url).pathname === '/'; } catch { return false; } }) || (audit.pages || [])[0];
  const t = (home?.renderedTitle || home?.title || '').split(/[|\-–—:·]/).map(s => s.trim()).filter(Boolean);
  if (t.length) return t[t.length - 1].length <= 40 ? t[t.length - 1] : t[0];
  try { return new URL(audit.url).hostname.replace(/^www\./, '').split('.')[0].replace(/\b\w/g, c => c.toUpperCase()); } catch { return 'แบรนด์'; }
}
// แปลง path → คำอ่านได้ (fallback ตอนไม่มีข้อมูล rendered) เช่น /our-portfolio → "Our Portfolio"
const wordsFromPath = (u) => { try { const seg = new URL(u).pathname.replace(/\/+$/, '').split('/').filter(s => s && s !== 'en' && s !== 'th').pop() || 'Home'; return decodeURIComponent(seg).replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); } catch { return 'Home'; } }
// H1 ที่เหมาะกับหน้า: ใช้ของจริงที่ render แล้วก่อน (มีอยู่ใน DOM) ไม่มีค่อย fallback
const h1For = (p, u) => (p?.renderedH1 && p.renderedH1[0]) || p?.renderedTitle?.split(/[|\-–—]/)[0].trim() || wordsFromPath(u);
// Title ที่เหมาะกับหน้า + ยาวพอ SEO (≤60): ใช้ rendered title จริงก่อน ไม่มีค่อยประกอบจากหน้า+แบรนด์
function titleForPage(p, u, brand) {
  let t = (p?.renderedTitle || '').trim();
  if (!t) { const w = wordsFromPath(u); t = w === 'Home' ? `${brand} — ${'นักลงทุนสัมพันธ์ / IR Website'}` : `${w} | ${brand}`; }
  return t.length > 60 ? t.slice(0, 57).trimEnd() + '…' : t;
}

// ประกอบกล่องโค้ดมาตรฐาน (wrap fence, ตัดความยาว, ใส่หมายเหตุ)
function codeBox(label, howTo, language, content, maxLen = 3500) {
  let truncated = false;
  if (content.length > maxLen) { content = content.slice(0, maxLen).replace(/\n[^\n]*$/, ''); truncated = true; }
  const header = `**โค้ด/ไฟล์สำหรับแก้ (พร้อมใช้ — ${label})**`;
  const body = content.includes('```') ? content : '```' + (language === 'text' ? '' : language) + '\n' + content + '\n```'; // เลี่ยง fence ซ้อน
  const note = truncated ? '\n_(เนื้อหายาวมาก แสดงบางส่วน — ดูฉบับเต็มในรายงาน เมนู Auto-Fix)_' : '';
  return [header, esc(howTo), body].filter(Boolean).join('\n') + note;
}

// ── เปิด SSR/Pre-render — config จริงตาม framework + พิสูจน์ว่า H1/title มีอยู่แล้ว (แค่ติดใน JS) ──
function ssrFix(audit, brand) {
  const fw = (audit.checks?.find(x => x.id === 'spa-shell')?.detail || '').match(/framework:\s*([^)—]+)/i)?.[1]?.trim() || 'JS framework';
  const home = (audit.pages || []).find(p => { try { return new URL(p.finalUrl || p.url).pathname === '/'; } catch { return false; } }) || (audit.pages || [])[0];
  const origin = (() => { try { return new URL(audit.url).origin; } catch { return audit.url; } })();
  const f = fw.toLowerCase();
  let config, lang = 'js';
  if (/nuxt/.test(f)) config = `// nuxt.config.ts\nexport default defineNuxtConfig({\n  ssr: true,                                   // (1) ต้องเป็น true — ห้าม false/'spa'\n  nitro: { prerender: { crawlLinks: true, routes: ['/'] } },  // (2) pre-render ทุกหน้าเป็น static HTML\n})\n\n# build แล้ว deploy โฟลเดอร์ .output/public (static):\nnpx nuxi generate`;
  else if (/next/.test(f)) config = `// แต่ละ app/<route>/page.tsx — ใช้ Server Component (default) ไม่ครอบด้วย "use client"\nexport const dynamic = 'force-static';   // หน้า content แบบ static\n// ถ้าเป็น Pages Router: ใช้ getStaticProps / getServerSideProps ให้ render เนื้อหาฝั่ง server`;
  else { lang = ''; config = `เปิด Server-Side Rendering หรือ Static Generation ของ ${fw}:\n- ให้ H1, title, เนื้อหา, ลิงก์เมนู ถูก render ฝั่ง server แล้วส่งมาใน HTML\n- เว็บแบบ content แนะนำ pre-render เป็น static HTML (เร็ว+ปลอดภัยสุด)\n- ทางลัดชั่วคราว: Prerender.io / Rendertron ดักบอทแล้วส่งหน้า render แล้ว`; }
  const sampleH1 = (home?.renderedH1 && home.renderedH1[0]) || '';
  const sampleTitle = home?.renderedTitle || '';
  const proof = (sampleH1 || sampleTitle)
    ? `\n\n_พิสูจน์ว่าเนื้อหามีอยู่แล้ว (แค่ติดใน JS):_ หน้าแรกตอน render มี${sampleH1 ? ` H1 = "${esc(sampleH1).slice(0, 70)}"` : ''}${sampleTitle ? ` · title = "${esc(sampleTitle).slice(0, 70)}"` : ''} — ค่าเหล่านี้ "หาย" ใน HTML ดิบที่ Googlebot รอบแรก/AI bot เห็น · SSR ทำให้โผล่ใน raw ทันที **ไม่ต้องเขียนเนื้อหาใหม่**`
    : '';
  const dod = `\n\n_ตรวจรับงาน (DoD):_ (1) \`curl -s ${origin} | grep '<h1'\` ต้องเห็น H1 พร้อมข้อความจริง (ไม่ใช่ div ว่าง) (2) view-source หน้าแรกเห็นเนื้อหา+เมนูครบ (3) รัน audit ซ้ำ ข้อ SPA เปลือกเปล่าเป็น PASS`;
  return `**โค้ด/ไฟล์สำหรับแก้ (พร้อมใช้ — เปิด SSR/Pre-render: ${fw})**\nแก้ที่ build config ของ framework (ระดับเว็บ ไม่ใช่รายหน้า) — แก้ข้อนี้ข้อเดียวปลดล็อก H1/title/เนื้อหาให้ search+AI เห็นพร้อมกัน\n` + '```' + lang + '\n' + config + '\n```' + proof + dod;
}

// ── "โค้ด/ไฟล์สำหรับแก้ (พร้อมใช้)" — โค้ดครบทุกหน้าที่กระทบ ใช้เนื้อหาจริง (ไม่มี placeholder/TODO) ──
const PER_PAGE_MAX = 60000; // โค้ดรายหน้ายาวได้ (ให้ครบทุกหน้า)
function fixBlock(audit, c) {
  const full = affectedPages(audit, c);
  const all = (full && full.length) ? full : (c.pages || []);
  const byUrl = pageByUrlMap(audit);
  const brand = brandOf(audit);

  // SSR / SPA shell — แก้ root cause ก่อน
  if (c.id === 'spa-shell' || c.id === 'geo-spa-risk') return ssrFix(audit, brand);

  // H1 รายหน้า — เสนอ H1 จริงครบทุกหน้า (ใช้ของที่ render แล้วก่อน)
  if (c.id === 'h1-missing' && all.length) {
    const code = all.map(u => `<!-- ${u} -->\n<h1>${esc(h1For(byUrl.get(normUrl(u)), u))}</h1>`).join('\n\n');
    const real = all.filter(u => byUrl.get(normUrl(u))?.renderedH1?.length).length;
    return codeBox('h1-tags.html', `วาง <h1> เดียวต่อหน้า ใน HTML ดิบ — ครบ ${all.length} หน้า${real ? ` (${real} หน้าใช้ H1 จริงจากเนื้อหาที่ render แล้ว)` : ''}`, 'html', code, PER_PAGE_MAX);
  }

  // Title รายหน้า — เสนอ <title> จริงครบทุกหน้า (≤60 ตัวอักษร เหมาะ SEO) ไม่มี placeholder
  if (['title-missing', 'title-length', 'title-duplicate'].includes(c.id) && all.length) {
    const code = all.map(u => `<!-- ${u} -->\n<title>${esc(titleForPage(byUrl.get(normUrl(u)), u, brand))}</title>`).join('\n\n');
    const real = all.filter(u => byUrl.get(normUrl(u))?.renderedTitle?.trim()).length;
    return codeBox('title-tags.html', `วางแทน <title> เดิมในแต่ละหน้า — ครบ ${all.length} หน้า${real ? ` (${real} หน้าใช้ title จริงจากเนื้อหา)` : ''} · ≤60 ตัวอักษร แต่ละหน้าไม่ซ้ำกัน`, 'html', code, PER_PAGE_MAX);
  }

  // Description รายหน้า — เสนอ meta description จริง (rendered ก่อน, ไม่มีก็ประกอบจากหัวข้อ+แบรนด์)
  if (['desc-missing', 'desc-duplicate'].includes(c.id) && all.length) {
    const code = all.map(u => {
      const p = byUrl.get(normUrl(u));
      let d = (p?.renderedDescription || '').trim();
      if (!d) { const topic = (titleForPage(p, u, brand).split(/[|–—]/)[0] || '').trim(); d = `${topic} โดย ${brand} — ดูรายละเอียดบริการ ข้อมูล และช่องทางติดต่อได้ที่หน้านี้`; }
      if (d.length > 160) d = d.slice(0, 157).trimEnd() + '…';
      return `<!-- ${u} -->\n<meta name="description" content="${esc(d)}">`;
    }).join('\n\n');
    return codeBox('meta-description.html', `วาง meta description ในแต่ละหน้า — ครบ ${all.length} หน้า · 80-160 ตัวอักษร แต่ละหน้าไม่ซ้ำกัน`, 'html', code, PER_PAGE_MAX);
  }

  // canonical รายหน้า — deterministic
  if (c.id === 'canonical-missing' && all.length) {
    const code = all.map(u => `<!-- ${u} -->\n<link rel="canonical" href="${esc(u).replace(/\?.*$/, '')}">`).join('\n\n');
    return codeBox('canonical-tags.html', `วางใน <head> ของแต่ละหน้า — ครบ ${all.length} หน้า (แต่ละหน้าชี้ canonical ของตัวเอง)`, 'html', code, PER_PAGE_MAX);
  }

  // snippet เหมือนกันทุกหน้า (เช่น viewport)
  if (SNIPPET[c.id]) {
    const s = SNIPPET[c.id];
    const how = all.length > 1 ? `${s.howTo} — โค้ดเดียวกันนี้ใส่ในทุกหน้าที่ระบุ (${all.length} หน้า)` : s.howTo;
    return codeBox(s.label, how, s.language, s.code);
  }

  // fix ระดับเว็บ/ไฟล์เดียว — จาก audit.fixes (robots, sitemap, schema, headers, llms ...)
  const fixId = FIX_FOR_CHECK[c.id];
  const fx = fixId && (audit.fixes || []).find(f => f.id === fixId && f.content);
  if (fx) return codeBox(fx.filename || fixId, fx.howTo || '', fx.language || 'text', String(fx.content));

  return '';
}

// ── Consultant playbook: ผลกระทบ (ธุรกิจ/SEO/AI) + Action Item + Effort ต่อ issue ──
// เขียนเป็น "สิ่งที่ dev เอาไปทำต่อได้ทันที" ไม่ใช้คำลอยๆ (ควรปรับปรุง/แนะนำให้/ควรพิจารณา)
const PLAYBOOK = {
  'spa-shell': {
    business: 'ทั้งเว็บแทบล่องหนในช่องทางหา-ลูกค้ายุคใหม่: ลงทุนทำเว็บ+คอนเทนต์แล้วแต่ Google รอบแรกและ AI ทุกตัวเห็นหน้าเปล่า → เสียโอกาสปิดการขายตั้งแต่หน้าค้นหา',
    seo: 'Googlebot รอบแรกได้ HTML เป็น <div> ว่าง ต้องรอ render รอบสอง (คิวไม่แน่นอน/ช้า) → index ช้า จัดอันดับต่ำกว่าศักยภาพจริงมาก',
    ai: 'GPTBot / OAI-SearchBot / ClaudeBot / PerplexityBot / Google-Extended ไม่รัน JavaScript เลย → เห็นหน้าเปล่า 100% → แบรนด์ไม่มีทางถูกอ้างอิงใน ChatGPT/Claude/Perplexity (นี่คือสาเหตุหลักที่คะแนน GEO ต่ำ)',
    devAction: '1) เปิด SSR (ssr:true) หรือ pre-render เป็น static ตามโค้ด config ด้านบน 2) deploy ให้ origin ส่ง HTML ที่มีเนื้อหาครบ 3) ผ่าน DoD ทั้ง 3 ข้อ — แก้ข้อนี้ข้อเดียวปลดล็อก H1/title/เนื้อหาให้ search+AI เห็นพร้อมกัน',
    effort: 'Dev 2-5 วัน (ระดับ build config — ทำครั้งเดียวคุ้มสุด)',
  },
  'geo-spa-risk': { ai: 'AI bot ไม่ render JS → เห็นหน้าเปล่า ดึงเนื้อหาไปตอบไม่ได้', effort: 'รวมกับงานเปิด SSR (ดู task SPA เปลือกเปล่า)' },
  'h1-missing': {
    business: 'หน้าไม่มีพาดหัวหลักที่บอกว่า "หน้านี้เกี่ยวกับอะไร" — ทั้งคนและ Google จับใจความช้า ลดความชัดเจนของข้อเสนอ',
    seo: 'H1 เป็นสัญญาณหัวข้อหลักที่ Google ใช้เข้าใจหน้า — ขาดไปทำให้ relevance ต่อคีย์เวิร์ดอ่อนลง',
    ai: 'AI ใช้โครงหัวข้อ (H1/H2) สรุปว่าหน้าพูดเรื่องอะไร — ไม่มี H1 ทำให้ AI สรุปเนื้อหาหน้าผิด/ข้าม',
    devAction: '1) วาง <h1> ตามโค้ดด้านบน (1 หน้า = 1 H1 อยู่บนสุดของเนื้อหาหลัก) ใน HTML ดิบ 2) ถ้าเว็บเป็น SPA ให้แก้ผ่าน SSR แล้ว H1 ที่ render อยู่แล้วจะมาเอง (ดู task SPA) 3) view-source ยืนยันเห็น <h1>',
    effort: 'ถ้าแก้ SSR = ได้มาฟรี · ถ้า hardcode รายหน้า ~2-4 ชม.',
  },
  'title-missing': {
    business: 'Title คือพาดหัวสีน้ำเงินบนหน้า Google + ชื่อแท็บ — ขาดไป Google เดาเอง มักได้ข้อความที่ไม่ชวนคลิก เสียลูกค้าตั้งแต่หน้าค้นหา',
    seo: 'Title เป็นปัจจัยจัดอันดับ on-page อันดับต้น — ขาด/ซ้ำ ทำให้ Google สับสนและจัดอันดับเพี้ยน',
    ai: 'AI ใช้ title เป็นชื่ออ้างอิงหน้า — ขาดไปทำให้ถูกอ้างถึงด้วยข้อความมั่ว',
    devAction: '1) วาง <title> ตามโค้ดด้านบนใน <head> ของแต่ละหน้า (หรือ useHead/head config ของ framework) 2) ถ้าเป็น SPA แก้ผ่าน SSR 3) view-source ยืนยัน <title> จริง',
    effort: 'ถ้าแก้ SSR = ได้มาฟรี · ถ้า hardcode ~2-4 ชม.',
  },
  'jsonld-missing': {
    business: 'ไม่มีข้อมูลโครงสร้าง (Schema) ที่บอก Google/AI ว่าแบรนด์คือใคร ขายอะไร — เสียโอกาสได้ rich result + ไม่ปรากฏใน Knowledge Panel/AI answers',
    seo: 'Schema ช่วยให้ได้ rich snippet (ดาว, FAQ, breadcrumb) + ช่วย entity understanding — คู่แข่งที่มีจะเด่นกว่าบนหน้าค้นหา',
    ai: 'JSON-LD คือภาษาที่ AI engine อ่าน entity ได้ตรงสุด — ไม่มี = AI เดาเอาเองว่าแบรนด์คือใคร เสี่ยงข้อมูลผิด',
    devAction: '1) วาง Global Schema (Organization + WebSite + BreadcrumbList) ใน layout หลักทุกหน้า 2) วาง Page-specific schema ตามชนิดหน้า (FAQPage/Service/Article/ContactPage/AboutPage) 3) ตรวจด้วย Google Rich Results Test ให้ผ่าน',
    effort: 'Dev 1 วัน (global + page-type templates)',
  },
  'schema-org': { business: 'ดู jsonld-missing', seo: 'ขาด entity markup', ai: 'AI อ่าน entity ไม่ได้', devAction: 'วาง Organization+WebSite schema ตามโค้ด', effort: '~2 ชม.' },
  'canonical-missing': {
    business: 'หลาย URL ของหน้าเดียวกัน (/, ?param) ถูกนับแยก — คะแนนกระจาย อันดับตก และอาจโชว์ URL ไม่สวยให้ลูกค้า',
    seo: 'เสี่ยง duplicate content — Google เลือกหน้าผิดมา index คะแนน link เจือจาง',
    ai: 'กระทบทางอ้อม (โครงสร้าง URL ชัดช่วยให้ครอว์เข้าใจง่ายขึ้น)',
    devAction: '1) วาง <link rel="canonical"> ตามโค้ดด้านบนใน <head> ของแต่ละหน้า (ชี้ URL หลักของตัวเอง ตัด query) 2) ตั้งใน layout/head config ให้อัตโนมัติ',
    effort: '~2-3 ชม.',
  },
};
const CAT_AI_IMPACT = { geo: 'กระทบโดยตรงต่อการถูก AI (ChatGPT/Claude/Perplexity) เข้าใจและอ้างอิงแบรนด์', rendering: 'กระทบการที่บอท/AI เข้าถึงเนื้อหา', index: 'กระทบการที่ Google/AI ค้นเจอและเก็บหน้า', schema: 'กระทบการที่ AI อ่าน entity ของแบรนด์', performance: 'กระทบทางอ้อม (ประสบการณ์ผู้ใช้/อันดับ)' };

// effort ประเมินจากชนิดงาน (รายหน้า vs config vs architecture)
function effortOf(c, affected) {
  if (c.category === 'rendering') return 'Dev 2-5 วัน (build/SSR config)';
  const perPage = ['h1-missing', 'title-missing', 'title-duplicate', 'desc-missing', 'desc-duplicate', 'canonical-missing', 'image-alt'];
  if (perPage.includes(c.id)) { const hrs = Math.max(1, Math.ceil((affected || 1) * 3 / 60)); return `~${hrs} ชม. (${affected || '?'} หน้า) · หรือทำผ่าน template/SSR ครั้งเดียว`; }
  if (['robots-missing', 'security-headers', 'compression', 'sitemap-exists', 'geo-llms-txt', 'jsonld-missing', 'schema-org'].includes(c.id)) return 'Dev 1-2 ชม. (config/ไฟล์เดียว)';
  return 'Dev ครึ่งวัน–1 วัน';
}

// ประกอบ 8 section จาก playbook + fallback (ทุก issue ต้องครบ ไม่มีช่องว่าง)
function playbookFor(c, ex, affected) {
  const pb = PLAYBOOK[c.id] || {};
  return {
    business: pb.business || esc(ex.why) || 'กระทบคุณภาพ SEO โดยรวมและความน่าเชื่อถือของเว็บต่อผู้ใช้',
    seo: pb.seo || esc(ex.what) || esc(c.detail) || '-',
    ai: pb.ai || CAT_AI_IMPACT[c.category] || 'กระทบทางอ้อมต่อความพร้อมด้าน AI (คุณภาพ/โครงสร้างเว็บโดยรวม)',
    devAction: pb.devAction || (c.recommendation ? `ดำเนินการตามนี้: ${esc(c.recommendation)} (ดูโค้ดประกอบด้านบนถ้ามี) แล้วรัน audit ซ้ำให้ข้อนี้เป็น PASS` : 'ดูโค้ด/แนวทางด้านบน แล้วรัน audit ซ้ำให้ข้อนี้เป็น PASS'),
    effort: pb.effort || effortOf(c, affected),
  };
}

// อ่าน routing config (domain → listId/team) — ไม่มีก็ใช้ค่า default จาก env
export function resolveRouting(audit, dir) {
  const host = hostOf(audit.url);
  let cfg = {};
  try { cfg = JSON.parse(readFileSync(new URL('../data/clickup-routing.json', import.meta.url))); }
  catch { try { cfg = JSON.parse(readFileSync(dir + '/data/clickup-routing.json', 'utf8')); } catch {} }
  const key = Object.keys(cfg).find(k => k !== '_default' && host.includes(k));
  const route = (key && cfg[key]) || cfg._default || {};
  return {
    listId: route.listId || process.env.CLICKUP_DEFAULT_LIST || '',
    team: route.team || '',
    assignee: route.defaultAssignee || process.env.CLICKUP_DEFAULT_ASSIGNEE || '',
    matched: !!key,
  };
}

// ── แปลง audit → แผนงาน (parent + subtasks) — ฟังก์ชันบริสุทธิ์ ทดสอบ offline ได้ ──
export function buildPlan(audit, opts = {}) {
  const host = hostOf(audit.url);
  const s = audit.score || {};
  const a = audit.analysis || {};
  const reportUrl = `${REPORT_BASE}/report-sale/${audit.id}`;
  const topIds = new Set((a.topPriorities || []).map(p => p.checkId || p.id).filter(Boolean));

  // ปัญหา = check ที่ fail/warn เท่านั้น
  const sevRank = { high: 0, med: 1, low: 2 };
  const issues = (audit.checks || [])
    .filter(c => c.status === 'fail' || c.status === 'warn')
    .sort((x, y) => {
      const tx = topIds.has(x.id) ? 0 : 1, ty = topIds.has(y.id) ? 0 : 1;
      if (tx !== ty) return tx - ty;
      if (x.status !== y.status) return x.status === 'fail' ? -1 : 1;
      return (sevRank[x.severity] ?? 3) - (sevRank[y.severity] ?? 3);
    });

  const titles = pageTitleMap(audit); // URL → ชื่อหน้า สำหรับโชว์เป็นลิงก์ที่อ่านรู้เรื่อง

  const subtasks = issues.map(c => {
    const g = groupOf(c.category);
    let pr = priorityOf(c.severity, c.status);
    const isTop = topIds.has(c.id);
    if (isTop && pr.priority > 1) pr = { ...pr, priority: pr.priority - 1, label: pr.label + '↑' };
    const pages = (c.pages || []).slice(0, 10);
    const morePages = (c.affectedCount || (c.pages || []).length) - pages.length;
    const ex = explainOf(c); // { what, why } ภาษาคนอ่านเข้าใจ
    const affected = c.affectedCount || (c.pages || []).length;
    const pb = playbookFor(c, ex, affected);
    const fix = fixBlock(audit, c);
    const pageLines = pages.map(u => { const t = titleFor(titles, u); return t ? `- [${t}](${u})` : `- ${u}`; }).join('\n');
    // โครงสร้างระดับ consultant report — ส่งให้ dev ทำต่อใน ClickUp ได้ทันที ไม่ต้องตีความเพิ่ม
    const desc = [
      `**1) Problem Summary — สรุปปัญหา**\n${esc(c.detail) || '-'}${ex.what ? `\n\n${esc(ex.what)}` : ''}`,
      `**2) Business Impact — ผลกระทบต่อธุรกิจ**\n${pb.business}`,
      `**3) SEO Impact**\n${pb.seo}`,
      `**4) AI Readiness Impact (GEO)**\n${pb.ai}`,
      `**5) Recommended Fix — วิธีแก้ (พร้อมโค้ด)**${c.recommendation ? `\n${esc(c.recommendation)}` : ''}${fix ? `\n\n${fix}` : ''}`,
      `**6) Developer Action Item**\n${pb.devAction}`,
      `**7) Priority:** ${pr.label.replace('↑', '')}${isTop ? ' (อันดับต้นของเว็บนี้)' : ''}    |    **8) Estimated Effort:** ${pb.effort}`,
      pages.length ? `**หน้าที่ได้รับผลกระทบ (${affected} หน้า)**\n${pageLines}${morePages > 0 ? `\n- และอีก ${morePages} หน้า (โค้ดแก้ครบทุกหน้าอยู่ในข้อ 5)` : ''}` : '',
      `**ทีมรับผิดชอบ:** ${g.team}  ·  **หมวด:** ${g.group}  ·  **รายงานฉบับเต็ม:** ${reportUrl}`,
      `---\nissue-key: ${audit.id}:${c.id}`,
    ].filter(Boolean).join('\n\n');

    return {
      name: esc(c.title),
      priority: pr.priority,
      priorityLabel: pr.label,
      dueDays: pr.dueDays,
      tags: [g.group],
      group: g.group,
      team: g.team,
      issueKey: `${audit.id}:${c.id}`,
      isTopPriority: isTop,
      markdown_description: desc,
    };
  });

  const counts = s.counts || {};
  const parentDesc = [
    `**เว็บไซต์:** ${audit.url}`,
    `**คะแนนรวม:** ${s.overall ?? '-'}/100 (เกรด ${s.grade ?? '-'})    **GEO:** ${s.categoryScores?.geo ?? '-'}/100`,
    `**สรุปปัญหา:** ต้องแก้ ${counts.fail ?? 0} รายการ · ควรปรับปรุง ${counts.warn ?? 0} รายการ · ตรวจ ${audit.pagesAnalyzed ?? '?'} หน้า`,
    a.executiveSummary ? esc(a.executiveSummary) : '',
    `**รายงานฉบับเต็ม:** ${reportUrl}`,
    `จัดทำอัตโนมัติโดย AI SEO Audit Pro · ${new Date(audit.createdAt).toLocaleString('th-TH')}`,
  ].filter(Boolean).join('\n\n');

  return {
    parent: {
      name: `[SEO] ${host} — ${s.overall ?? '–'}/100 (${s.grade ?? '–'})`,
      markdown_description: parentDesc,
    },
    subtasks,
    meta: { host, total: subtasks.length, fail: counts.fail ?? 0, warn: counts.warn ?? 0 },
  };
}

// ── ยิง ClickUp API จริง ──
async function cuFetch(path, token, init = {}) {
  const res = await fetch(API + path, {
    ...init,
    headers: { Authorization: token, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`ClickUp ${res.status}: ${body.err || body.ECODE || JSON.stringify(body).slice(0, 160)}`);
  return body;
}

export async function pushToClickUp(audit, { token, listId, assignee, limit, namePrefix } = {}) {
  if (!token) throw new Error('ยังไม่ได้ตั้ง CLICKUP_API_TOKEN ใน .env');
  if (!listId) throw new Error('ยังไม่ได้ระบุ ClickUp List ปลายทาง (ตั้ง CLICKUP_DEFAULT_LIST หรือ routing)');
  const plan = buildPlan(audit);
  const subtaskList = limit ? plan.subtasks.slice(0, limit) : plan.subtasks; // limit = โหมดทดสอบ
  const now = Date.now();
  const assignees = assignee ? [Number(assignee)].filter(Boolean) : undefined;

  // 1) parent task = เว็บไซต์
  const parent = await cuFetch(`/list/${listId}/task`, token, {
    method: 'POST',
    body: JSON.stringify({ name: (namePrefix || '') + plan.parent.name, markdown_description: plan.parent.markdown_description, ...(assignees ? { assignees } : {}) }),
  });

  // 2) subtasks = แต่ละปัญหา
  const created = [], errors = [];
  for (const st of subtaskList) {
    try {
      const t = await cuFetch(`/list/${listId}/task`, token, {
        method: 'POST',
        body: JSON.stringify({
          name: st.name, parent: parent.id, priority: st.priority, tags: st.tags,
          markdown_description: st.markdown_description,
          due_date: now + st.dueDays * 86400000, due_date_time: false,
          ...(assignees ? { assignees } : {}),
        }),
      });
      created.push({ id: t.id, name: st.name, priority: st.priorityLabel });
    } catch (e) {
      // ถ้า tags ใช้ไม่ได้ (บางแผน) ลองสร้างซ้ำแบบไม่มี tags
      try {
        const t = await cuFetch(`/list/${listId}/task`, token, {
          method: 'POST',
          body: JSON.stringify({ name: st.name, parent: parent.id, priority: st.priority, markdown_description: st.markdown_description, due_date: now + st.dueDays * 86400000 }),
        });
        created.push({ id: t.id, name: st.name, priority: st.priorityLabel, note: 'no-tags' });
      } catch (e2) { errors.push({ name: st.name, error: String(e2.message || e2) }); }
    }
  }
  return { ok: true, parentId: parent.id, parentUrl: parent.url, created: created.length, total: subtaskList.length, errors, meta: plan.meta };
}
