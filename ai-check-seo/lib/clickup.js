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

// ประกอบกล่องโค้ดมาตรฐาน (wrap fence, ตัดความยาว, ใส่หมายเหตุ)
const PAGE_CAP = 10;
function codeBox(label, howTo, language, content, morePages = 0) {
  let truncated = false;
  if (content.length > 3500) { content = content.slice(0, 3500).replace(/\n[^\n]*$/, ''); truncated = true; }
  const header = `**โค้ด/ไฟล์สำหรับแก้ (พร้อมใช้ — ${label})**`;
  const body = content.includes('```') ? content : '```' + (language === 'text' ? '' : language) + '\n' + content + '\n```'; // เลี่ยง fence ซ้อน
  const notes = [];
  if (morePages > 0) notes.push(`_(แสดง ${PAGE_CAP} หน้าแรก — อีก ${morePages} หน้าใช้รูปแบบเดียวกัน)_`);
  if (truncated) notes.push('_(แสดงบางส่วน — ดูฉบับเต็มในรายงาน เมนู Auto-Fix)_');
  return [header, esc(howTo), body, ...notes].filter(Boolean).join('\n');
}

// ── "โค้ด/ไฟล์สำหรับแก้ (พร้อมใช้)" — ครอบคลุมทุกหน้าที่กระทบ ──
function fixBlock(audit, c) {
  const all = c.pages || [];
  const pages = all.slice(0, PAGE_CAP);
  const morePages = all.length - pages.length;

  // A) โค้ดรายหน้า — แต่ละหน้าต้องไม่เหมือนกัน (canonical / title / description)
  if (c.id === 'canonical-missing' && pages.length) {
    const code = pages.map(u => `<!-- ${u} -->\n<link rel="canonical" href="${esc(u).replace(/\?.*$/, '')}">`).join('\n\n');
    return codeBox('canonical-tags.html', 'วางแต่ละบรรทัดใน <head> ของหน้านั้นๆ (แต่ละหน้าชี้ canonical ของตัวเอง)', 'html', code, morePages);
  }
  if (['title-missing', 'desc-missing', 'title-length', 'title-duplicate'].includes(c.id) && pages.length) {
    const bm = metaBlockMap(audit);
    const code = pages.map(u => bm.get(normUrl(u))
      || `<!-- ${u} -->\n<title>TODO: เขียน title เฉพาะหน้านี้ 30-60 ตัวอักษร (ห้ามซ้ำหน้าอื่น)</title>\n<meta name="description" content="TODO: คำโปรย 80-160 ตัวอักษร">`
    ).join('\n\n');
    return codeBox('meta-tags.html', 'วางแทน title/description เดิมในแต่ละหน้า — แต่ละหน้าต้องไม่ซ้ำกัน หน้าที่ขึ้น TODO ให้เขียนเพิ่ม', 'html', code, morePages);
  }

  // B) snippet เหมือนกันทุกหน้า — ใส่โค้ดเดียวกันในทุกหน้าที่ระบุ (เช่น viewport)
  if (SNIPPET[c.id]) {
    const s = SNIPPET[c.id];
    const how = pages.length > 1 ? `${s.howTo} — โค้ดเดียวกันนี้ใส่ในทุกหน้าที่ระบุด้านล่าง` : s.howTo;
    return codeBox(s.label, how, s.language, s.code);
  }

  // C) fix ระดับเว็บ/ไฟล์เดียว — จาก audit.fixes (robots, sitemap, schema, headers, ssr, llms ...)
  const fixId = FIX_FOR_CHECK[c.id];
  const fx = fixId && (audit.fixes || []).find(f => f.id === fixId && f.content);
  if (fx) return codeBox(fx.filename || fixId, fx.howTo || '', fx.language || 'text', String(fx.content));

  return '';
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
    const pageLines = pages.map(u => { const t = titleFor(titles, u); return t ? `- [${t}](${u})` : `- ${u}`; }).join('\n');
    const desc = [
      `**ปัญหาที่ตรวจพบ**\n${esc(c.detail) || '-'}`,
      ex.what ? `**อธิบายแบบเข้าใจง่าย**\n${esc(ex.what)}${ex.why ? `\n\n_ทำไมต้องแก้:_ ${esc(ex.why)}` : ''}` : '',
      c.recommendation ? `**แนวทางแก้ไข**\n${esc(c.recommendation)}` : '',
      fixBlock(audit, c), // โค้ด/ไฟล์พร้อมใช้ (ถ้ามี)
      pages.length ? `**หน้าที่ได้รับผลกระทบ (${c.affectedCount || pages.length} หน้า)**\n${pageLines}${morePages > 0 ? `\n- และอีก ${morePages} หน้า` : ''}` : '',
      `**หมวดหมู่:** ${g.group}    **ทีมรับผิดชอบ:** ${g.team}    **ความสำคัญ:** ${pr.label.replace('↑', '')}${isTop ? ' (ปัญหาสำคัญอันดับต้น)' : ''}`,
      `**รายงานฉบับเต็ม:** ${reportUrl}`,
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
