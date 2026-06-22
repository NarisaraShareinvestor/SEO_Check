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
const isHomePath = (u) => { try { const p = new URL(u).pathname.replace(/\/+$/, ''); return p === '' || /^\/(en|th)$/.test(p) || /\/home$/.test(p); } catch { return false; } };
// H1 ที่เหมาะกับหน้า: ใช้ H1 จริงที่ render แล้วก่อน (เฉพาะหน้า) ไม่มีก็ derive จาก URL slug (unique+ตรงเนื้อหา) / แบรนด์ (home)
const h1For = (p, u, brand) => (p?.renderedH1 && (p.renderedH1[0] || '').trim()) || (isHomePath(u) ? brand : wordsFromPath(u));
// Title ที่เหมาะกับหน้า ≤60 ตัวอักษร: home ใช้ของจริง · sub-page ประกอบจาก slug+แบรนด์ (เลี่ยง title ซ้ำที่ SPA ตั้ง default เหมือนกันทุกหน้า)
function titleForPage(p, u, brand) {
  let t = isHomePath(u) ? ((p?.renderedTitle || '').trim() || `${brand} — IR Website / นักลงทุนสัมพันธ์`) : `${wordsFromPath(u)} | ${brand}`;
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

// ── จำแนกชนิดหน้า (เลือก schema + E-E-A-T ที่เหมาะ) จาก URL ──
function pageType(u) {
  let p; try { p = new URL(u).pathname.replace(/^\/(en|th)(?=\/|$)/, '').replace(/\/+$/, '') || '/'; } catch { return 'other'; }
  if (p === '/' || /\/home$/.test(p)) return 'home';
  if (/contact|ติดต่อ/i.test(p)) return 'contact';
  if (/faq|คำถามที่พบบ่อย/i.test(p)) return 'faq';
  if (/about|team|company|profile|เกี่ยวกับ/i.test(p)) return 'about';
  if (/\/(blogs?|news|articles?|posts?)\/.+/i.test(p)) return 'article';   // มี slug ต่อท้าย = บทความเดี่ยว
  if (/\/(blogs?|news|articles?)$/i.test(p)) return 'bloglist';
  if (/service|product-and-service|solution|บริการ/i.test(p)) return 'service';
  if (/career|job|recruit|ร่วมงาน/i.test(p)) return 'career';
  if (/privacy|cookie|term|policy|นโยบาย|sitemap/i.test(p)) return 'policy';
  return 'other';
}
const originOf = (audit) => { try { return new URL(audit.url).origin; } catch { return String(audit.url || '').replace(/\/$/, ''); } };
// ประเภทเว็บ — สำคัญ: ไม่ใช่ทุกเว็บขายของ (อย่ายัด Product schema มั่ว)
function siteKind(audit) {
  const paths = (audit.pages || []).map(p => { try { return new URL(p.url).pathname; } catch { return ''; } }).join(' ').toLowerCase();
  if (/\/(product|shop|store|cart|checkout|collection)/.test(paths)) return { id: 'ecommerce', label: 'ร้านค้าออนไลน์ (e-commerce)', org: 'OnlineStore', pageSchema: 'Product' };
  if (/service|solution|product-and-service/.test(paths)) return { id: 'service', label: 'บริษัทให้บริการ/B2B (ไม่ได้ขายสินค้า)', org: 'Organization', pageSchema: 'Service' };
  if (/(blogs?|news|article)/.test(paths)) return { id: 'content', label: 'เว็บเนื้อหา/สื่อ', org: 'Organization', pageSchema: 'Article' };
  return { id: 'corporate', label: 'เว็บองค์กร', org: 'Organization', pageSchema: 'WebPage' };
}

// BreadcrumbList จาก path จริงของหน้า (ไล่ทุก segment → ชื่ออ่านได้ + URL จริง) — ใช้ได้เลยไม่ต้องเดา
function breadcrumbJsonld(origin, url) {
  let all = []; try { all = new URL(url).pathname.split('/').filter(Boolean); } catch {}
  const items = [{ '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` }];
  let acc = '', pos = 2;
  for (const s of all) {
    acc += '/' + s;
    if (/^(en|th)$/i.test(s)) continue; // คง lang prefix ใน URL ถัดไป แต่ไม่ทำ "En/Th" เป็น crumb
    items.push({ '@type': 'ListItem', position: pos++, name: decodeURIComponent(s).replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), item: `${origin}${acc}` });
  }
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items };
}

// ── Structured Data fix — แยก Global + page-specific ตามชนิดหน้า + ตามประเภทเว็บจริง (ไม่ยัด Product มั่ว) ──
function schemaFix(audit) {
  const brand = brandOf(audit), origin = originOf(audit), kind = siteKind(audit);
  const socials = audit.socials || [], logo = audit.logo || `${origin}/logo.png`;
  const ok = (audit.pages || []).filter(p => p.status === 200);
  const byUrl = pageByUrlMap(audit);
  const home = ok.find(p => pageType(p.finalUrl || p.url) === 'home') || ok[0];
  const desc = (home?.renderedDescription || `${brand} — เว็บไซต์ทางการ`).slice(0, 200);
  const groups = {};
  for (const p of ok) { const t = pageType(p.finalUrl || p.url); (groups[t] = groups[t] || []).push(p.finalUrl || p.url); }
  const lang = /[ก-๙]/.test(brand + desc) ? 'th' : 'en';
  const J = (obj) => '```json\n' + JSON.stringify(obj, null, 2) + '\n```';
  const out = [];
  out.push(`**ประเภทเว็บที่ตรวจพบ:** ${kind.label} → ใช้ \`${kind.org}\` + \`${kind.pageSchema}\` (ไม่ใช้ Product เพราะเว็บนี้ไม่ได้ขายสินค้า)`);

  // A) GLOBAL — วางทุกหน้า (layout หลัก)
  out.push(`**A) Global Schema — วาง <script> นี้ใน <head> ของ "ทุกหน้า" (layout หลัก)**
_เหตุผล:_ บอก Google/AI ว่าแบรนด์คือใคร (entity) + เว็บนี้คืออะไร — ฐานของ Knowledge Panel และการถูก AI อ้างอิง
` + '```html\n<script type="application/ld+json">\n' + JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': kind.org, '@id': `${origin}/#org`, name: brand, url: `${origin}/`, logo, description: desc, ...(socials.length ? { sameAs: socials } : {}) },
      { '@type': 'WebSite', '@id': `${origin}/#website`, url: `${origin}/`, name: brand, publisher: { '@id': `${origin}/#org` }, inLanguage: lang },
    ],
  }, null, 2) + '\n</script>\n```\n_(domain/ชื่อ/description/logo' + (socials.length ? '/sameAs' : '') + ' ดึงจากเว็บจริงแล้ว' + (socials.length ? '' : ' · ไม่พบลิงก์โซเชียลตอน crawl — เพิ่ม sameAs เองถ้ามี') + (audit.logo ? '' : ' · ยืนยัน path โลโก้') + ' · เพิ่ม address/tel จริงจะครบขึ้น)_');

  // B) BREADCRUMB — สร้างจาก "หน้าจริง" ของเว็บนี้ (ไม่ใช่ path สมมติ) เพื่อ copy ไปใช้ได้เลย
  const deep = ok.map(p => p.finalUrl || p.url).find(u => { try { return new URL(u).pathname.replace(/^\/(en|th)(?=\/|$)/, '').split('/').filter(Boolean).length >= 2; } catch { return false; } })
    || groups.service?.[0] || groups.about?.[0] || groups.contact?.[0];
  if (deep) out.push(`**B) BreadcrumbList — ตัวอย่างจากหน้าจริง \`${deep}\` (ทำแบบเดียวกันทุกหน้าที่ลึกกว่าหน้าแรก โดยไล่ตาม path จริงของหน้านั้น)**
_เหตุผล:_ ช่วยให้ Google แสดง breadcrumb บนผลค้นหา + ช่วย AI เข้าใจโครงสร้างเว็บ
` + J(breadcrumbJsonld(origin, deep)));

  // C) PAGE-SPECIFIC ตามชนิดหน้า (เฉพาะที่มีจริงในเว็บ)
  const sec = [];
  const list = (urls, n = 6) => urls.slice(0, n).map(u => `  - ${u}`).join('\n') + (urls.length > n ? `\n  - …รวม ${urls.length} หน้า (ใช้รูปแบบเดียวกัน เปลี่ยน url/name ตามหน้า)` : '');
  if (groups.about?.length) sec.push(`• **หน้า About → AboutPage** (${groups.about.length} หน้า)\n${list(groups.about)}\n_เหตุผล:_ ระบุว่าเป็นหน้าแนะนำองค์กร — เสริม E-E-A-T (ตัวตน/ความน่าเชื่อถือ)\n` + J({ '@context': 'https://schema.org', '@type': 'AboutPage', url: groups.about[0], name: `เกี่ยวกับ ${brand}`, about: { '@id': `${origin}/#org` }, isPartOf: { '@id': `${origin}/#website` } }));
  if (groups.contact?.length) sec.push(`• **หน้า Contact → ContactPage** (${groups.contact.length} หน้า)\n${list(groups.contact)}\n_เหตุผล:_ ช่องทางติดต่อชัด = trust signal ที่ Google/AI ใช้ยืนยันธุรกิจมีตัวตน\n` + J({ '@context': 'https://schema.org', '@type': 'ContactPage', url: groups.contact[0], name: `ติดต่อ ${brand}`, about: { '@id': `${origin}/#org` } }));
  if (groups.service?.length) sec.push(`• **หน้าบริการ → Service** (${groups.service.length} หน้า — ใช้แทน Product เพราะขายบริการ ไม่ใช่สินค้า)\n${list(groups.service)}\n_เหตุผล:_ บอก AI ว่าให้บริการอะไร ใครให้บริการ — โอกาสถูกแนะนำเมื่อมีคนถาม AI หาบริการแบบนี้\n` + J({ '@context': 'https://schema.org', '@type': 'Service', name: (byUrl.get(normUrl(groups.service[0]))?.renderedH1?.[0]) || wordsFromPath(groups.service[0]), url: groups.service[0], provider: { '@id': `${origin}/#org` }, areaServed: 'TH' }));
  if (groups.article?.length) { const ap = byUrl.get(normUrl(groups.article[0])); const aAuthor = ap?.author ? { '@type': 'Person', name: ap.author } : { '@id': `${origin}/#org` };
    sec.push(`• **บทความ → Article** (${groups.article.length} บทความ — author = ${ap?.author ? 'ผู้เขียนจริงที่ crawl เจอ' : 'องค์กร (blog บริษัท)'})\n${list(groups.article)}\n_เหตุผล:_ ให้บทความมีสิทธิ์ขึ้น rich result + ให้ AI อ้างอิงเนื้อหาได้ถูกที่มา (E-E-A-T)\n` + J({ '@context': 'https://schema.org', '@type': 'Article', headline: (ap?.renderedTitle || wordsFromPath(groups.article[0])).slice(0, 110), url: groups.article[0], author: aAuthor, publisher: { '@id': `${origin}/#org` }, mainEntityOfPage: groups.article[0] })); }
  if (groups.faq?.length) sec.push(`• **หน้า FAQ → FAQPage** (${groups.faq.length} หน้า)\n${list(groups.faq)}\n_เหตุผล:_ FAQPage คืออาวุธ GEO — AI Overview/ChatGPT ดึงไปตอบตรงๆ\n_หมายเหตุ:_ คำถาม-คำตอบใน JSON-LD ต้องตรงกับที่แสดงบนหน้าจริง`);
  out.push(`**C) Page-specific Schema — วางเฉพาะหน้าตามชนิด:**\n` + (sec.length ? sec.join('\n\n') : '_(ไม่พบหน้าเฉพาะทางที่ต้องใส่ schema เพิ่ม)_'));

  return `**โค้ด/ไฟล์สำหรับแก้ (พร้อมใช้ — JSON-LD แยกตามชนิดหน้า)**\n` + out.join('\n\n');
}

// ── E-E-A-T fix — บอกว่าหน้าไหนต้องเสริมสัญญาณอะไร + โค้ดจริง ──
function eeatFix(audit) {
  const brand = brandOf(audit), origin = originOf(audit);
  const ok = (audit.pages || []).filter(p => p.status === 200);
  const byUrl = pageByUrlMap(audit);
  const socials = audit.socials || [];
  const groups = {};
  for (const p of ok) { const t = pageType(p.finalUrl || p.url); (groups[t] = groups[t] || []).push(p.finalUrl || p.url); }
  const list = (urls, n = 6) => (urls || []).slice(0, n).map(u => `  - ${u}`).join('\n') + ((urls || []).length > n ? `\n  - …รวม ${urls.length} หน้า` : '');
  const parts = [];
  parts.push(`E-E-A-T = Experience / Expertise / Authoritativeness / Trust — สัญญาณที่ Google & AI ใช้ตัดสินว่าเชื่อถือเนื้อหาได้แค่ไหน เว็บนี้ยังขาด:`);
  // Authoritativeness — Organization trust (ทุกหน้า) — ใช้ sameAs จริงที่ crawl เจอ
  parts.push(`**Authoritativeness (A) — Organization + ช่องทางยืนยันตัวตน · วางทุกหน้าใน layout**\nsameAs = โปรไฟล์ทางการของแบรนด์ — ตัวเชื่อม entity ที่หนักแน่นสุด\n` + '```json\n' + JSON.stringify({ '@context': 'https://schema.org', '@type': 'Organization', '@id': `${origin}/#org`, name: brand, url: `${origin}/`, ...(audit.logo ? { logo: audit.logo } : {}), sameAs: socials.length ? socials : ['https://www.facebook.com/<หน้าเพจจริง>', 'https://www.linkedin.com/company/<บริษัทจริง>'] }, null, 2) + '\n```\n' + (socials.length ? `_(sameAs ${socials.length} ลิงก์ดึงจากเว็บจริงตอน crawl — ตรวจว่าเป็นเพจทางการครบ)_` : '_(ไม่พบลิงก์โซเชียลตอน crawl — ใส่ URL โปรไฟล์จริงที่ทีมมี ห้ามแต่ง)_'));
  // Experience/Expertise — author บนบทความ — ใช้ชื่อผู้เขียนจริงถ้า crawl เจอ
  if (groups.article?.length) {
    const realAuthor = groups.article.map(u => byUrl.get(normUrl(u))?.author).find(Boolean) || '';
    const aName = realAuthor || '<ชื่อผู้เขียนจริง>';
    parts.push(`**Experience / Expertise (E) — ใส่ผู้เขียน (author) ในบทความ ${groups.article.length} บทความ**${realAuthor ? ` (crawl เจอผู้เขียน เช่น "${esc(realAuthor)}")` : ''}\n${list(groups.article)}\nวาง byline บนหน้า + Person schema — ให้ Google/AI รู้ว่าใครเขียน มีความเชี่ยวชาญอะไร\n` + '```html\n<!-- บนหน้าบทความ ใต้หัวข้อ -->\n<p class="byline">โดย <a href="' + origin + '/<หน้าโปรไฟล์ผู้เขียน>">' + esc(aName) + '</a> · เผยแพร่ <time datetime="<YYYY-MM-DD>"><วันที่เผยแพร่></time></p>\n\n<script type="application/ld+json">\n' + JSON.stringify({ '@context': 'https://schema.org', '@type': 'Person', name: aName, jobTitle: '<ตำแหน่งงาน>', worksFor: { '@id': `${origin}/#org` } }, null, 2) + '\n</script>\n```\n' + (realAuthor ? '_(ชื่อผู้เขียนดึงจากเว็บจริง — เหลือใส่วันที่/ตำแหน่ง)_' : '_(domain ถูกแล้ว — เหลือแทนชื่อผู้เขียน/วันที่ด้วยของจริง)_'));
  }
  else parts.push(`**Experience / Expertise (E) — ใส่ผู้เขียนในบทความ**\nรอบ crawl นี้ยังไม่พบหน้าบทความ (/blogs/*) — เมื่อมีบทความ ให้ใส่ byline ผู้เขียน + Person schema (worksFor = องค์กร) ทุกบทความ เพื่อให้ AI/Google รู้ว่าใครเขียนและเชี่ยวชาญอะไร`);
  // Trust — หน้าความน่าเชื่อถือ
  const trust = { 'About/ทีมงาน': groups.about, 'Contact (ที่อยู่/เบอร์จริง)': groups.contact, 'นโยบาย (Privacy/Terms)': groups.policy };
  const haveT = Object.entries(trust).filter(([, v]) => v?.length).map(([k]) => k);
  const missT = Object.entries(trust).filter(([, v]) => !v?.length).map(([k]) => k);
  parts.push(`**Trust (T) — หน้าความน่าเชื่อถือ**\nมีแล้ว: ${haveT.join(', ') || '-'}${missT.length ? `\nควรเพิ่ม: ${missT.join(', ')}` : ''}\nบนหน้า About ใส่: ทีมงานจริง+รูป+ตำแหน่ง, ปีก่อตั้ง, ลูกค้า/ผลงานอ้างอิงได้ · บนหน้า Contact ใส่ชื่อบริษัท+ที่อยู่+เบอร์ตรงกันทุกที่ (NAP) — ทั้งหมดคือสิ่งที่ AI ใช้ยืนยันว่าธุรกิจมีตัวตนจริง`);
  return `**โค้ด/แนวทางแก้ (พร้อมใช้ — E-E-A-T)**\n` + parts.join('\n\n');
}

// ── FAQ schema — structure พร้อม + domain/แบรนด์จริง (Q&A เป็นเนื้อหาเฉพาะธุรกิจ ใส่ของจริง) ──
function faqFix(audit) {
  const brand = brandOf(audit);
  return `**โค้ด/ไฟล์สำหรับแก้ (พร้อมใช้ — FAQPage schema)**\nวางใน <head> ของหน้าที่มี FAQ (หน้าแรก/หน้าบริการ) — **คำถาม-คำตอบใน JSON-LD ต้องตรงกับที่แสดงบนหน้าจริง** (กฎ Google) · ใส่ FAQ จริงของ ${brand}\n` + '```html\n<script type="application/ld+json">\n' + JSON.stringify({
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: '<คำถามที่ลูกค้าถามบ่อย ข้อ 1>', acceptedAnswer: { '@type': 'Answer', text: '<คำตอบจริง ตอบตรงในประโยคแรก>' } },
      { '@type': 'Question', name: '<คำถามจริง ข้อ 2>', acceptedAnswer: { '@type': 'Answer', text: '<คำตอบจริง>' } },
      { '@type': 'Question', name: '<คำถามจริง ข้อ 3>', acceptedAnswer: { '@type': 'Answer', text: '<คำตอบจริง>' } },
    ],
  }, null, 2) + '\n</script>\n```\n_เหตุผล:_ FAQPage = อาวุธ GEO — AI Overview/ChatGPT/Perplexity ดึงไปตอบตรงๆ · โครงสร้างพร้อมแล้ว เหลือใส่ Q&A จริง (ต้องตรงกับที่โชว์บนหน้า)';
}

// ── llms.txt — สร้างจากข้อมูลจริง (แบรนด์ + description + หน้าสำคัญที่ crawl เจอ) ไม่มี TODO ──
function llmsFix(audit) {
  const brand = brandOf(audit), origin = originOf(audit);
  const ok = (audit.pages || []).filter(p => p.status === 200);
  const home = ok.find(p => { try { return new URL(p.finalUrl || p.url).pathname === '/'; } catch { return false; } }) || ok[0];
  const desc = (home?.renderedDescription || '').trim() || `${brand} — ดูบริการและข้อมูลบนเว็บไซต์`;
  const important = ok.filter(p => ['home', 'about', 'service', 'contact', 'bloglist'].includes(pageType(p.finalUrl || p.url)));
  const pick = (important.length ? important : ok).slice(0, 14);
  const lines = pick.map(p => { const u = p.finalUrl || p.url; const t = (p.renderedTitle || '').split(/[|–—]/)[0].trim() || wordsFromPath(u); return `- [${t}](${u})`; }).join('\n');
  const content = `# ${brand}\n\n> ${desc}\n\n## หน้าสำคัญ\n${lines}\n\n## ติดต่อ\n- เว็บไซต์: ${origin}/`;
  return `**โค้ด/ไฟล์สำหรับแก้ (พร้อมใช้ — llms.txt)**\nวางที่ root: ${origin}/llms.txt — มาตรฐานใหม่บอก AI ว่าเว็บคือใคร หน้าไหนสำคัญ (เว็บไทยแทบไม่มีใครทำ = นำหน้าคู่แข่ง) · สร้างจากเนื้อหาจริงของเว็บแล้ว\n` + '```markdown\n' + content + '\n```';
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

  // Structured Data (JSON-LD) — แยก Global + page-specific ตามชนิดหน้า + ประเภทเว็บจริง
  if (['jsonld-missing', 'schema-org', 'schema-breadcrumb', 'geo-entity'].includes(c.id)) return schemaFix(audit);

  // E-E-A-T / trust — บอกหน้า + โค้ดเสริมสัญญาณความน่าเชื่อถือ
  if (['geo-eeat', 'geo-trust-pages'].includes(c.id)) return eeatFix(audit);

  // FAQ schema — structure พร้อม + แบรนด์จริง
  if (['geo-faq-schema', 'geo-qa-content'].includes(c.id)) return faqFix(audit);

  // llms.txt — สร้างจากข้อมูลจริง
  if (c.id === 'geo-llms-txt') return llmsFix(audit);

  // H1 รายหน้า — เสนอ H1 จริงครบทุกหน้า (ใช้ของที่ render แล้วก่อน)
  if (c.id === 'h1-missing' && all.length) {
    const code = all.map(u => `<!-- ${u} -->\n<h1>${esc(h1For(byUrl.get(normUrl(u)), u, brand))}</h1>`).join('\n\n');
    const real = all.filter(u => byUrl.get(normUrl(u))?.renderedH1?.length).length;
    return codeBox('h1-tags.html', `วาง <h1> เดียวต่อหน้า ใน HTML ดิบ — ครบ ${all.length} หน้า${real ? ` (${real} หน้าใช้ H1 จริงจากเนื้อหาที่ render แล้ว)` : ''}`, 'html', code, PER_PAGE_MAX);
  }

  // Title รายหน้า — เสนอ <title> จริงครบทุกหน้า (≤60 ตัวอักษร เหมาะ SEO) ไม่มี placeholder
  if (['title-missing', 'title-length', 'title-duplicate'].includes(c.id) && all.length) {
    const code = all.map(u => `<!-- ${u} -->\n<title>${esc(titleForPage(byUrl.get(normUrl(u)), u, brand))}</title>`).join('\n\n');
    return codeBox('title-tags.html', `วางแทน <title> เดิมในแต่ละหน้า — ครบ ${all.length} หน้า · แต่ละหน้าไม่ซ้ำกัน ≤60 ตัวอักษร (สร้างจากหัวข้อ/ชื่อหน้า + แบรนด์ · หน้าแรกใช้ title จริงของเว็บ)`, 'html', code, PER_PAGE_MAX);
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
  'schema-org': { business: 'ไม่มีข้อมูล entity ของแบรนด์ให้ Google/AI — เสียโอกาส Knowledge Panel', seo: 'ขาด Organization markup ที่ช่วย entity understanding', ai: 'AI อ่าน entity (แบรนด์คือใคร) ไม่ได้ → เดาเอง', devAction: 'วาง Organization + WebSite schema (Global) ตามโค้ดด้านบนใน layout หลัก แล้วตรวจด้วย Rich Results Test', effort: 'Dev ~2 ชม.' },
  'schema-breadcrumb': { business: 'ไม่มี breadcrumb บนผลค้นหา — ดูเป็นมือสมัครเล่นกว่าคู่แข่ง', seo: 'เสีย rich result breadcrumb + Google เข้าใจลำดับชั้นเว็บยากขึ้น', ai: 'AI เข้าใจโครงสร้าง/ลำดับหน้าได้ยากขึ้น', devAction: 'วาง BreadcrumbList schema ตามโค้ดในหน้าที่ลึกกว่าหน้าแรก (เปลี่ยน item ตาม path)', effort: 'Dev ~2-3 ชม.' },
  'geo-entity': { business: 'AI ไม่รู้จักแบรนด์ในฐานะ "นิติบุคคล" → ไม่ถูกแนะนำเมื่อมีคนถามหาบริการแบบนี้', seo: 'entity ที่ชัดช่วย Google เชื่อมโยงแบรนด์กับหมวดธุรกิจ', ai: 'หัวใจของ GEO — ไม่มี entity data (Organization JSON-LD + sameAs) AI ก็อ้างอิงแบรนด์ผิด/ไม่อ้างเลย', devAction: 'วาง Organization schema (Global) + เพิ่ม sameAs ชี้โปรไฟล์ทางการจริง ตามโค้ดด้านบน', effort: 'Dev ~2-3 ชม.' },
  'geo-eeat': {
    business: 'เนื้อหาขาดสัญญาณ "เชื่อถือได้/มืออาชีพ" (ผู้เขียน, ตัวตนองค์กร, หน้า trust) → ทั้งคน Google และ AI ลังเลที่จะเชื่อ/อ้างอิง เสียความได้เปรียบด้านความน่าเชื่อถือให้คู่แข่ง',
    seo: 'E-E-A-T เป็นเกณฑ์คุณภาพหลักของ Google (โดยเฉพาะธุรกิจการเงิน/YMYL) — ขาดทำให้อันดับถูกกดแม้เนื้อหาดี',
    ai: 'AI เลือกอ้างอิงเฉพาะแหล่งที่ดู authoritative — ไม่มี author/entity/trust signals = ถูกข้ามเมื่อ AI หาแหล่งตอบ',
    devAction: '1) เพิ่ม sameAs โปรไฟล์ทางการจริงใน Organization schema (ทุกหน้า) 2) ใส่ byline ผู้เขียน + Person schema ในบทความ 3) เสริมหน้า About (ทีม+ตำแหน่ง+ปีก่อตั้ง) และ Contact (NAP จริงตรงกันทุกที่) — ดูโค้ด/หน้าที่กระทบด้านบน',
    effort: 'Dev + Content 1-2 วัน (ต้องใช้ข้อมูลจริงจากทีม: ผู้เขียน/โซเชียล/ทีมงาน)',
  },
  'geo-trust-pages': {
    business: 'หน้าสร้างความเชื่อมั่น (About/Contact/ทีม/นโยบาย) ไม่ครบ → ลูกค้าและ AI หาข้อมูลยืนยันตัวตนธุรกิจไม่เจอ',
    seo: 'Trust pages ครบ = สัญญาณ E-E-A-T ที่ Google ใช้ประเมินความน่าเชื่อถือ',
    ai: 'AI ใช้หน้า About/Contact ยืนยันว่าธุรกิจมีตัวตนจริงก่อนอ้างอิง',
    devAction: 'สร้าง/เสริมหน้า: About (ทีมงานจริง+ตำแหน่ง+ปีก่อตั้ง), Contact (ชื่อบริษัท+ที่อยู่+เบอร์จริง NAP), นโยบายความเป็นส่วนตัว — ดูรายหน้าที่ขาดด้านบน',
    effort: 'Content 1 วัน',
  },
  'canonical-missing': {
    business: 'หลาย URL ของหน้าเดียวกัน (/, ?param) ถูกนับแยก — คะแนนกระจาย อันดับตก และอาจโชว์ URL ไม่สวยให้ลูกค้า',
    seo: 'เสี่ยง duplicate content — Google เลือกหน้าผิดมา index คะแนน link เจือจาง',
    ai: 'กระทบทางอ้อม (โครงสร้าง URL ชัดช่วยให้ครอว์เข้าใจง่ายขึ้น)',
    devAction: '1) วาง <link rel="canonical"> ตามโค้ดด้านบนใน <head> ของแต่ละหน้า (ชี้ URL หลักของตัวเอง ตัด query) 2) ตั้งใน layout/head config ให้อัตโนมัติ',
    effort: '~2-3 ชม.',
  },
};
const CAT_AI_IMPACT = { geo: 'กระทบโดยตรงต่อการถูก AI (ChatGPT/Claude/Perplexity) เข้าใจและอ้างอิงแบรนด์', rendering: 'กระทบการที่บอท/AI เข้าถึงเนื้อหา', index: 'กระทบการที่ Google/AI ค้นเจอและเก็บหน้า', schema: 'กระทบการที่ AI อ่าน entity ของแบรนด์', performance: 'กระทบทางอ้อม (ประสบการณ์ผู้ใช้/อันดับ)' };

// effort "ตามจริง" — งานเล็กให้เวลาน้อย (เดิมเหมาเป็นครึ่งวัน-1วันทำให้ favicon/lang ดูใหญ่เกิน)
const EFFORT = {
  // ~10 นาที — แก้ไฟล์/แท็กเดียว (มักมีโค้ด/ไฟล์ให้พร้อม)
  'lang-missing': '~10 นาที (ใส่ <html lang> ใน template เดียว)',
  'favicon-missing': '~10 นาที (อัปโหลด favicon + 1 บรรทัด)',
  'viewport-missing': '~10 นาที (1 meta tag ใน template)', 'viewport-noscale': '~10 นาที',
  'geo-llms-txt': '~10 นาที (ไฟล์สร้างให้แล้ว — วางที่ root)',
  'robots-missing': '~15 นาที (วางไฟล์ robots.txt ที่สร้างให้)', 'robots-blocks-section': '~15 นาที (แก้ robots.txt)', 'robots-blocks-all': '~15 นาที',
  // ~15-30 นาที — config/snippet เดียว
  'sitemap-lastmod': '~15-30 นาที', 'noscript-fallback': '~15-30 นาที',
  'security-headers': '~20-30 นาที (config + reload)', 'compression': '~20-30 นาที',
  'soft-404': '~20-30 นาที', 'sitemap-exists': '~20-30 นาที (gen + submit)', 'sitemap-coverage': '~20-30 นาที',
  'orphan-pages': '~30 นาที (ลิงก์ถึงหน้า + ใส่ sitemap)', 'internal-links-few': '~30-60 นาที (เพิ่มลิงก์ภายใน/เมนู)',
  // ~30 นาที-1 ชม — วาง schema (โค้ดให้แล้ว)
  'schema-org': '~30 นาที (วาง JSON-LD ใน layout)', 'schema-breadcrumb': '~30-45 นาที', 'geo-entity': '~30 นาที',
  'hreflang': '~30-45 นาที', 'jsonld-missing': '~1 ชม. (Global + page-type — โค้ดให้แล้ว)',
  // ต้องเขียนเนื้อหาจริง
  'geo-faq-schema': '~1 ชม. (วาง schema + ใส่ Q&A จริง)', 'geo-qa-content': '~1-2 ชม. (เขียน Q&A จริง 3-5 ข้อ)',
  'geo-citable': 'Content ~ครึ่งวัน (เพิ่มสถิติ/แหล่งอ้างอิงในเนื้อหา)',
  'geo-eeat': 'Dev ~1 ชม. (โค้ด) + Content (ใช้ข้อมูลจริง: ผู้เขียน/โซเชียล/ทีม)',
  'geo-trust-pages': 'Content ~ครึ่งวัน (เขียนหน้า About/ติดต่อจริง)',
  // architecture / performance
  'spa-shell': 'Dev 2-5 วัน (เปิด SSR/pre-render — ครั้งเดียวปลดล็อกหลายข้อ)',
  'geo-spa-risk': 'รวมกับงานเปิด SSR (ดู task SPA เปลือกเปล่า)', 'render-diff': 'รวมกับงานเปิด SSR',
  'cwv-score': 'แปรผันตามสาเหตุ (บีบรูป/แคช ~ครึ่งวัน · ปรับโครงสร้าง ~หลายวัน — ดู opportunities)',
};
function effortOf(c, affected) {
  if (EFFORT[c.id]) return EFFORT[c.id];
  // งานรายหน้าที่มีโค้ดให้ copy — ผ่าน template เร็วสุด
  if (['h1-missing', 'title-missing', 'title-duplicate', 'desc-missing', 'desc-duplicate', 'canonical-missing', 'image-alt'].includes(c.id)) {
    const n = affected || 1, mins = Math.max(15, Math.round(n * 1.5));
    const perPage = mins >= 60 ? `~${Math.ceil(mins / 30) / 2} ชม.` : `~${Math.ceil(mins / 5) * 5} นาที`;
    return `ผ่าน template/SSR ~30 นาที · หรือรายหน้า ${perPage} (${n} หน้า — โค้ดให้แล้ว copy วาง)`;
  }
  if (c.category === 'rendering') return 'Dev 1-3 วัน';
  return '~30 นาที–1 ชม.'; // default ตามจริง (เดิม "ครึ่งวัน-1 วัน" สูงไป)
}

// ประกอบ 8 section จาก playbook + fallback (ทุก issue ต้องครบ ไม่มีช่องว่าง)
function playbookFor(c, ex, affected) {
  const pb = PLAYBOOK[c.id] || {};
  return {
    business: pb.business || esc(ex.why) || 'กระทบคุณภาพ SEO โดยรวมและความน่าเชื่อถือของเว็บต่อผู้ใช้',
    seo: pb.seo || esc(ex.what) || esc(c.detail) || '-',
    ai: pb.ai || CAT_AI_IMPACT[c.category] || 'กระทบทางอ้อมต่อความพร้อมด้าน AI (คุณภาพ/โครงสร้างเว็บโดยรวม)',
    devAction: pb.devAction || (c.recommendation ? `ดำเนินการตามนี้: ${esc(c.recommendation)} (ดูโค้ดประกอบด้านบนถ้ามี) แล้วรัน audit ซ้ำให้ข้อนี้เป็น PASS` : 'ดูโค้ด/แนวทางด้านบน แล้วรัน audit ซ้ำให้ข้อนี้เป็น PASS'),
    effort: effortOf(c, affected), // แหล่งเดียว — ตามจริงตามชนิดงาน (งานเล็ก = เวลาน้อย)
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
    const LINK_CAP = 200; // แสดง URL ให้ครบ (เดิม cap 10) — ดึง list เต็มจาก recompute ก่อน
    const allAffected = affectedPages(audit, c) || (c.pages || []);
    const pages = allAffected.slice(0, LINK_CAP);
    const morePages = Math.max(0, (c.affectedCount || allAffected.length) - pages.length);
    const ex = explainOf(c); // { what, why } ภาษาคนอ่านเข้าใจ
    const affected = c.affectedCount || allAffected.length;
    const pb = playbookFor(c, ex, affected);
    const fix = fixBlock(audit, c);
    const pageLines = pages.map(u => { const t = titleFor(titles, u); return t ? `- [${t}](${u})` : `- ${u}`; }).join('\n');
    // แตกขั้นตอน "1) ... 2) ... 3)" ที่อยู่บรรทัดเดียว → list จริงคนละบรรทัด (กัน ClickUp render เพี้ยน)
    const devMd = /\s\d\)\s/.test(' ' + pb.devAction)
      ? pb.devAction.split(/\s+(?=\d\)\s)/).map((s, i) => `${i + 1}. ${s.replace(/^\d\)\s*/, '')}`).join('\n')
      : pb.devAction;
    // โครงสร้างระดับ consultant report — ส่งให้ dev ทำต่อใน ClickUp ได้ทันที ไม่ต้องตีความเพิ่ม
    const desc = [
      `**1) Problem Summary — สรุปปัญหา**\n${esc(c.detail) || '-'}${ex.what ? `\n\n${esc(ex.what)}` : ''}`,
      `**2) Business Impact — ผลกระทบต่อธุรกิจ**\n${pb.business}`,
      `**3) SEO Impact**\n${pb.seo}`,
      `**4) AI Readiness Impact (GEO)**\n${pb.ai}`,
      `**5) Recommended Fix — วิธีแก้ (พร้อมโค้ด)**${c.recommendation ? `\n${esc(c.recommendation)}` : ''}${fix ? `\n\n${fix}` : ''}`,
      `**6) Developer Action Item**\n${devMd}`,
      `**7) Priority:** ${pr.label.replace('↑', '')}${isTop ? ' (อันดับต้นของเว็บนี้)' : ''}    |    **8) Estimated Effort:** ${pb.effort}`,
      pages.length ? `**หน้าที่ได้รับผลกระทบ (${affected} หน้า)**\n${pageLines}${morePages > 0 ? `\n- และอีก ${morePages} หน้า (โค้ดแก้ครบทุกหน้าอยู่ในข้อ 5)` : ''}` : '',
      `**ทีมรับผิดชอบ:** ${g.team}  ·  **หมวด:** ${g.group}  ·  **รายงานฉบับเต็ม:** ${reportUrl}`,
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
