// AI SEO Audit Pro — API server + job runner
import express from 'express';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { crawlSite, normalizeUrl } from './lib/crawler.js';
import { runChecks } from './lib/checks.js';
import { runGeoChecks } from './lib/geo.js';
import { fetchCWV, buildPsiChecks } from './lib/psi.js';
import { discoverCompetitors } from './lib/discover.js';
import { fixLivePage, fixPagesBatch } from './lib/pagefix.js';
import { execFile } from 'node:child_process';
import { renderReport } from './lib/report.js';
import { renderSalesReport } from './lib/report-sales.js';
import { renderPresentation } from './lib/present.js';
import { scoreAudit, CAT_LABELS } from './lib/scorer.js';
import { aiAnalyze, aiCompare, aiGrowthPlan, aiAvailable, drainAiCost } from './lib/ai.js';
import { generateFixes } from './lib/autofix.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// โหลด .env แบบง่าย (ไม่พึ่ง dotenv)
const envPath = join(__dirname, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const PORT = +(process.env.PORT || 3000);
const MAX_PAGES_DEFAULT = +(process.env.MAX_PAGES_DEFAULT || 30);
const MAX_PAGES_LIMIT = +(process.env.MAX_PAGES_LIMIT || 100);
const DATA_DIR = join(__dirname, 'data', 'audits');
mkdirSync(DATA_DIR, { recursive: true });

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(join(__dirname, 'public')));
app.use('/demo', express.static(join(__dirname, 'demo-site'), { extensions: ['html'] }));

// in-memory job state (ผลถาวรเก็บเป็นไฟล์ JSON)
const jobs = new Map(); // id → {id, status, progress[], result?}

function saveAudit(audit) {
  writeFileSync(join(DATA_DIR, `${audit.id}.json`), JSON.stringify(audit));
}
function loadAudit(id) {
  const f = join(DATA_DIR, `${id.replace(/[^a-z0-9-]/gi, '')}.json`);
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
}
const normUrl = (u) => { try { const x = new URL(u); return (x.hostname.replace(/^www\./, '') + x.pathname).replace(/\/$/, ''); } catch { return u; } };

// หา audit ครั้งก่อนหน้าของ URL เดียวกัน (ไว้เทียบก่อน/หลังแก้)
function findPreviousAudit(url, beforeIso) {
  let best = null;
  for (const f of readdirSync(DATA_DIR).filter(f => f.endsWith('.json'))) {
    try {
      const a = JSON.parse(readFileSync(join(DATA_DIR, f), 'utf8'));
      if (normUrl(a.url) !== normUrl(url)) continue;
      if (beforeIso && a.createdAt >= beforeIso) continue;
      if (!best || a.createdAt > best.createdAt) best = a;
    } catch {}
  }
  return best;
}

// Delta Engine — เทียบผลตรวจสองครั้ง: อะไรแก้แล้ว อะไรแย่ลง อะไรโผล่ใหม่
function diffAudits(prev, curr) {
  const prevMap = new Map(prev.checks.map(c => [c.id, c]));
  const isBad = (st) => st === 'fail' || st === 'warn';
  const fixed = [], regressed = [], newIssues = [];
  for (const c of curr.checks) {
    const p = prevMap.get(c.id);
    if (!p) { if (isBad(c.status)) newIssues.push({ id: c.id, title: c.title, status: c.status }); continue; }
    if (isBad(p.status) && !isBad(c.status)) fixed.push({ id: c.id, title: c.title, from: p.status });
    else if (!isBad(p.status) && isBad(c.status)) regressed.push({ id: c.id, title: c.title, to: c.status });
    else if (isBad(p.status) && isBad(c.status) && p.status === 'warn' && c.status === 'fail') regressed.push({ id: c.id, title: c.title, to: c.status });
  }
  const catDeltas = {};
  for (const k of new Set([...Object.keys(curr.score.categoryScores), ...Object.keys(prev.score.categoryScores)]))
    catDeltas[k] = (curr.score.categoryScores[k] ?? 0) - (prev.score.categoryScores[k] ?? 0);
  return {
    prevId: prev.id, prevDate: prev.createdAt, prevScore: prev.score.overall,
    currScore: curr.score.overall, scoreDelta: curr.score.overall - prev.score.overall,
    fixed, regressed, newIssues, categoryDeltas: catDeltas,
  };
}

// วิเคราะห์ internal link health จากข้อมูลที่ crawl แล้ว (ก่อน strip)
function computeLinkHealth(site) {
  const origin = site.origin;
  const originHost = (() => { try { return new URL(origin).hostname.replace(/^www\./, ''); } catch { return ''; } })();
  const pages = site.pages.filter(p => p.status === 200);
  const inboundCount = new Map(); // url → inbound link count
  const anchorCount = new Map(); // anchor text → count
  let totalInternal = 0, nofollowCount = 0, externalCount = 0;

  for (const p of pages) {
    if (!p.links?.length) continue;
    for (const l of p.links) {
      const abs = normalizeUrl(l.href, p.finalUrl || p.url);
      if (!abs) continue;
      try {
        const isSame = new URL(abs).hostname.replace(/^www\./, '') === originHost;
        if (isSame) {
          totalInternal++;
          if (/nofollow/.test(l.rel || '')) nofollowCount++;
          inboundCount.set(abs, (inboundCount.get(abs) || 0) + 1);
          const anchor = (l.text || '').trim().toLowerCase().slice(0, 120);
          if (anchor.length > 1) anchorCount.set(anchor, (anchorCount.get(anchor) || 0) + 1);
        } else {
          externalCount++;
        }
      } catch {}
    }
  }

  const topAnchors = [...anchorCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([text, count]) => ({ text, count }));
  const orphans = pages.filter(p => {
    try { return new URL(p.url).pathname !== '/' && !inboundCount.has(p.url); } catch { return false; }
  }).map(p => p.url).slice(0, 8);
  const uniqueAnchors = anchorCount.size;
  const diversity = totalInternal > 0 ? Math.min(100, Math.round((uniqueAnchors / Math.max(1, totalInternal)) * 150)) : 0;
  const overOptimized = topAnchors.filter(a => totalInternal > 5 && a.count / totalInternal > 0.4);

  return {
    totalInternal, nofollowCount,
    nofollowPct: totalInternal > 0 ? Math.round((nofollowCount / totalInternal) * 100) : 0,
    externalLinksFound: externalCount,
    uniqueAnchors, diversity,
    topAnchors, orphans, overOptimized,
    apiNote: 'External backlinks, referring domains, toxic anchors ต้องการ DataForSEO หรือ Ahrefs API',
  };
}

// สกัด "โปรไฟล์" ของเว็บจากผลตรวจ — ใช้เปรียบเทียบกับคู่แข่ง
function buildProfile(url, score, checks, pagesAnalyzed) {
  const st = (id) => checks.find(c => c.id === id)?.status || null;
  return {
    url, overall: score.overall, grade: score.grade, counts: score.counts,
    categoryScores: score.categoryScores, pagesAnalyzed,
    flags: {
      ssr: st('spa-shell'), jsonld: st('jsonld-missing'), orgSchema: st('schema-org'),
      faq: st('geo-faq-schema'), aiBots: st('geo-bot-access'), llms: st('geo-llms-txt'),
      canonical: st('canonical-missing'), sitemap: st('sitemap-exists'), h1: st('h1-missing'),
      desc: st('desc-missing'), og: st('og-tags'), trust: st('geo-trust-pages'),
      eeat: st('geo-eeat'), cwv: st('cwv-score') || st('cwv-field'),
    },
  };
}

async function runAudit(job, url, maxPages, competitorUrl) {
  const push = (msg) => { job.progress.push({ t: Date.now(), msg }); };
  try {
    job.status = 'crawling';
    push(`เริ่มตรวจ ${url} (สูงสุด ${maxPages} หน้า)`);
    const psiPromise = fetchCWV(url); // ยิง Google PageSpeed คู่ขนานไปกับ crawl (ใช้เวลา ~30-60s)
    push('ส่งคำขอ Core Web Vitals ไปที่ Google PageSpeed (รันคู่ขนาน)...');

    // crawl เว็บเรา + เว็บคู่แข่ง คู่ขนานกัน
    const compPromise = competitorUrl
      ? crawlSite(competitorUrl, { maxPages: Math.min(15, maxPages), onProgress: (m) => push(`[คู่แข่ง] ${m}`) }).catch(e => { push(`[คู่แข่ง] crawl ไม่สำเร็จ: ${e.message}`); return null; })
      : Promise.resolve(null);
    const [site, compSite] = await Promise.all([
      crawlSite(url, { maxPages, onProgress: push }),
      compPromise,
    ]);

    job.status = 'analyzing';
    push('Crawl เสร็จ — กำลังรัน rule engine 200+ จุดตรวจ...');
    const tech = runChecks(site);
    const geo = runGeoChecks(site);
    push('กำลังรอผล Core Web Vitals จาก Google...');
    const psi = await psiPromise;
    const psiChecks = buildPsiChecks(psi);
    const allChecks = [...tech.checks, ...geo.checks, ...psiChecks];
    const score = scoreAudit(allChecks);

    const audit = {
      id: job.id, url, createdAt: new Date().toISOString(),
      pagesAnalyzed: tech.pagesAnalyzed,
      pagesCrawled: site.pages.length,
      sitemapUrls: site.sitemapUrls.length,
      brokenLinks: site.brokenLinks,
      renderedAvailable: !!site.rendered?.available,
      score, checks: allChecks, categories: CAT_LABELS,
      aiAvailable: aiAvailable(),
    };

    // เข้าเว็บไม่ได้เลย — แยกออกจาก "เว็บ SEO แย่" ชัดเจน
    // (เว็บ throttle/flap/WAF บล็อก → crawl ไม่ติด ไม่ใช่ความผิดของ SEO เว็บ ไม่ควรโชว์ 0/F หลอกตา)
    if (tech.pagesAnalyzed === 0) {
      const errStatuses = [...new Set(site.fetchErrors.map(e => e.status).filter(Boolean))];
      const errReasons = [...new Set(site.fetchErrors.map(e => e.error).filter(Boolean))].slice(0, 3);
      // ตรวจจับ geo-block: domain .th + network error (ไม่มี HTTP status) + ยังไม่ได้ตั้ง CRAWL_PROXY
      let hostname = ''; try { hostname = new URL(url).hostname; } catch {}
      const isThai = /\.th$/.test(hostname);
      const isNetErr = errStatuses.length === 0 && errReasons.some(r => /fetch.failed|timeout|ECON|ETIMED/i.test(r));
      const proxySet = !!(process.env.CRAWL_PROXY || process.env.PROXY_URL);
      const geoBlock = isThai && isNetErr && !proxySet;
      audit.unreachable = true;
      audit.unreachableInfo = {
        crawled: site.pages.length,
        errors: site.fetchErrors.length,
        statuses: errStatuses,
        reasons: errReasons,
        robotsStatus: site.robotsStatus,
        geoBlock,
        message: geoBlock
          ? 'เชื่อมต่อไม่ได้ — น่าจะเป็นการบล็อก IP ต่างประเทศ (geo-block) ซึ่งพบบ่อยในเว็บ .th'
          : errStatuses.length
            ? `เซิร์ฟเวอร์ตอบกลับด้วยสถานะ ${errStatuses.join(', ')} — เว็บอาจกำลังจำกัดการเข้าถึง (rate limit/WAF) หรือล่มชั่วคราว`
            : `เชื่อมต่อเว็บไม่สำเร็จ (${errReasons.join(', ') || 'ไม่ทราบสาเหตุ'}) — เว็บอาจล่มหรือบล็อกการตรวจชั่วคราว`,
      };
      job.status = 'done';
      push(`เข้าเว็บไม่ได้ — crawl 0 หน้า (${audit.unreachableInfo.message}). ข้ามการวิเคราะห์ ลองตรวจใหม่อีกครั้ง`);
      job.result = audit;
      saveAudit(audit);
      return;
    }

    // เปรียบเทียบคู่แข่ง
    if (compSite) {
      push('กำลังวิเคราะห์เว็บคู่แข่งด้วยชุดตรวจเดียวกัน...');
      const compTech = runChecks(compSite);
      if (compTech.pagesAnalyzed === 0) {
        // crawl คู่แข่งล้มเหลว (โดน WAF บล็อก/เว็บล่ม) — แจ้งชัดดีกว่าโชว์ 0 คะแนนหลอกตา
        push('เข้าเว็บคู่แข่งไม่สำเร็จ — ข้ามการเปรียบเทียบ');
        audit.competitor = { error: `เข้าเว็บคู่แข่ง ${competitorUrl} ไม่สำเร็จ (อาจถูก WAF บล็อกหรือเว็บล่มชั่วคราว) — ลองตรวจใหม่อีกครั้ง`, theirsUrl: competitorUrl };
      } else {
        const compGeo = runGeoChecks(compSite);
        const compChecks = [...compTech.checks, ...compGeo.checks];
        const compScore = scoreAudit(compChecks);
        const ours = buildProfile(url, score, allChecks, tech.pagesAnalyzed);
        const theirs = buildProfile(competitorUrl, compScore, compChecks, compTech.pagesAnalyzed);
        push('กำลังสรุปแผนแซงคู่แข่ง...');
        const commentary = await aiCompare(ours, theirs);
        audit.competitor = { ours, theirs, commentary };
      }
    }

    job.status = 'ai';
    drainAiCost(); // เคลียร์ cost ค้างจาก audit ก่อนหน้า (กรณี error กลางคัน)
    push(aiAvailable() ? 'กำลังให้ AI วิเคราะห์และจัดลำดับความสำคัญ...' : 'สรุปผลแบบ template (ยังไม่ได้ใส่ AI API key)...');
    audit.analysis = await aiAnalyze(audit);
    {
      const g = audit.analysis?._guardrail;
      const n = g ? g.droppedHallucinated.length + g.droppedNonIssue.length : 0;
      if (n > 0) push(`Guardrail: ตัดข้อที่ AI อ้างผิด ${n} ข้อ (กุขึ้นมา ${g.droppedHallucinated.length}, ชี้ check ที่ผ่านแล้ว ${g.droppedNonIssue.length})`);
    }

    push('กำลังวางแผนเติบโต (keyword เป้าหมาย + ประมาณการ 3/6/12 เดือน)...');
    audit.growth = await aiGrowthPlan(audit);

    push('กำลังสร้างไฟล์แก้อัตโนมัติ (Auto-Fix)...');
    const { fixes } = await generateFixes(audit, site);
    audit.fixes = fixes;

    // รวมค่าใช้จ่าย AI ทั้งหมดในการตรวจครั้งนี้
    const costLines = drainAiCost();
    audit.aiCost = costLines.reduce((acc, c) => {
      acc.calls++;
      acc.inputTokens += c.inputTokens;
      acc.outputTokens += c.outputTokens;
      acc.usd = +(acc.usd + c.usd).toFixed(6);
      return acc;
    }, { calls: 0, inputTokens: 0, outputTokens: 0, usd: 0 });

    // Link health — วิเคราะห์ก่อน strip เพราะ site.pages ยังมี links ครบ
    audit.linkHealth = computeLinkHealth(site);

    // เก็บข้อมูลหน้าแบบย่อสำหรับแท็บรายหน้า
    audit.pages = site.pages
      .filter(p => p.title !== undefined && !p.nonHtml && !p.blocked)
      .map(p => ({
        url: p.url, status: p.status, title: p.title || '',
        titleLength: (p.title || '').length,
        description: p.metas?.['description'] || '',
        h1: p.headings?.filter(h => h.tag === 'h1').map(h => h.text) || [],
        canonical: p.canonical || '', noindex: /noindex/i.test(p.metas?.['robots'] || ''),
        wordCount: p.wordCount || 0, images: p.images?.length || 0,
        imagesNoAlt: p.images?.filter(i => i.src && !i.alt).length || 0,
        jsonLdCount: p.jsonLd?.length || 0, emptyRoot: !!p.emptyRoot,
        elapsed: p.elapsed || 0, htmlKb: Math.round((p.htmlBytes || 0) / 1024),
      }));

    // เทียบกับการตรวจครั้งก่อนของ URL เดียวกัน (ก่อน/หลังแก้)
    const prevAudit = findPreviousAudit(url, audit.createdAt);
    if (prevAudit) {
      audit.delta = diffAudits(prevAudit, audit);
      push(`เทียบกับครั้งก่อน: ${audit.delta.prevScore} → ${score.overall} (${audit.delta.scoreDelta >= 0 ? '+' : ''}${audit.delta.scoreDelta}) | แก้แล้ว ${audit.delta.fixed.length} ข้อ`);
    }

    job.status = 'done';
    push(`เสร็จสิ้น — คะแนน ${score.overall}/100 (เกรด ${score.grade}) | ปัญหาร้ายแรง ${score.counts.fail} ข้อ`);
    job.result = audit;
    saveAudit(audit);
    notifyWatch(url, audit); // แจ้งเตือนถ้าเว็บนี้อยู่ใน watchlist
  } catch (e) {
    job.status = 'error';
    job.error = String(e?.message || e);
    push(`เกิดข้อผิดพลาด: ${job.error}`);
  }
}

// ── API ──
app.post('/api/audit', (req, res) => {
  let { url, maxPages, competitorUrl } = req.body || {};
  if (!url) return res.status(400).json({ error: 'ต้องระบุ url' });
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  try { new URL(url); } catch { return res.status(400).json({ error: 'URL ไม่ถูกต้อง' }); }
  if (competitorUrl) {
    if (!/^https?:\/\//i.test(competitorUrl)) competitorUrl = 'https://' + competitorUrl;
    try { new URL(competitorUrl); } catch { competitorUrl = null; }
  }
  maxPages = Math.min(Math.max(+(maxPages || MAX_PAGES_DEFAULT), 1), MAX_PAGES_LIMIT);

  const id = crypto.randomBytes(6).toString('hex');
  const job = { id, url, status: 'queued', progress: [], startedAt: Date.now() };
  jobs.set(id, job);
  runAudit(job, url, maxPages, competitorUrl || null); // ไม่ await — ทำงานเบื้องหลัง
  res.json({ id });
});

app.get('/api/audit/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (job) {
    const { result, ...meta } = job;
    return res.json({ ...meta, result: job.status === 'done' ? result : undefined });
  }
  const saved = loadAudit(req.params.id);
  if (saved) return res.json({ id: saved.id, status: 'done', progress: [], result: saved });
  res.status(404).json({ error: 'ไม่พบ audit นี้' });
});

app.get('/api/audits', (_req, res) => {
  const list = readdirSync(DATA_DIR).filter(f => f.endsWith('.json')).map(f => {
    try {
      const a = JSON.parse(readFileSync(join(DATA_DIR, f), 'utf8'));
      return { id: a.id, url: a.url, createdAt: a.createdAt, overall: a.score?.overall, grade: a.score?.grade, fails: a.score?.counts?.fail, pages: a.pagesAnalyzed, aiCost: a.aiCost || null };
    } catch { return null; }
  }).filter(Boolean).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  res.json(list);
});

// ค้นหาคู่แข่งอุตสาหกรรมเดียวกันอัตโนมัติ
const discoverJobs = new Map();
app.post('/api/discover', (req, res) => {
  let { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'ต้องระบุ url' });
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  try { new URL(url); } catch { return res.status(400).json({ error: 'URL ไม่ถูกต้อง' }); }
  const id = crypto.randomBytes(5).toString('hex');
  const job = { id, status: 'running', progress: [] };
  discoverJobs.set(id, job);
  discoverCompetitors(url, (msg) => job.progress.push(msg))
    .then(result => { job.status = 'done'; job.result = result; })
    .catch(e => { job.status = 'error'; job.error = String(e.message || e); });
  res.json({ id });
});
app.get('/api/discover/:id', (req, res) => {
  const job = discoverJobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'ไม่พบงานค้นหา' });
  res.json(job);
});

// AI แก้หน้าเว็บแบบพิสูจน์ได้ — แก้ → ตรวจซ้ำ → แก้รอบสองถ้ายังไม่ผ่าน
const fixJobs = new Map();
app.post('/api/fixpage', (req, res) => {
  if (!aiAvailable()) return res.status(400).json({ error: 'ฟีเจอร์นี้ต้องใส่ AI API key ใน .env ก่อน' });
  let { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'ต้องระบุ url' });
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  try { new URL(url); } catch { return res.status(400).json({ error: 'URL ไม่ถูกต้อง' }); }
  const id = crypto.randomBytes(5).toString('hex');
  const job = { id, url, status: 'running', progress: [] };
  fixJobs.set(id, job);
  fixLivePage(url, (msg) => job.progress.push(msg))
    .then(result => { job.status = 'done'; job.result = result; })
    .catch(e => { job.status = 'error'; job.error = String(e.message || e); });
  res.json({ id });
});
app.get('/api/fixpage/:id', (req, res) => {
  const job = fixJobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'ไม่พบงานแก้หน้า' });
  res.json(job);
});

// AI แก้ทุกหน้าตามหลัก SEO (batch) — ผลรวมเป็น ZIP
const BUNDLE_DIR = join(__dirname, 'data', 'fixbundles');
app.post('/api/fixpages', (req, res) => {
  if (!aiAvailable()) return res.status(400).json({ error: 'ฟีเจอร์นี้ต้องใส่ AI API key ใน .env ก่อน' });
  const { auditId } = req.body || {};
  const audit = jobs.get(auditId)?.result || loadAudit(auditId || '');
  if (!audit) return res.status(404).json({ error: 'ไม่พบ audit นี้' });
  const urls = (audit.pages || []).filter(p => p.status === 200).map(p => p.url).slice(0, 8);
  if (!urls.length) return res.status(400).json({ error: 'ไม่มีหน้าที่แก้ได้' });

  const id = crypto.randomBytes(5).toString('hex');
  const dir = join(BUNDLE_DIR, id);
  mkdirSync(dir, { recursive: true });
  const job = { id, status: 'running', progress: [], results: [], total: urls.length };
  fixJobs.set(id, job);

  const slug = (u) => { try { const p = new URL(u).pathname.replace(/\.html?$/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, ''); return p || 'index'; } catch { return 'page'; } };
  fixPagesBatch(urls, (m) => job.progress.push(m), (r) => {
    if (r.ok) {
      const fname = slug(r.url) + '.fixed.html';
      writeFileSync(join(dir, fname), r.fixedHtml);
      job.results.push({ url: r.url, ok: true, file: fname, before: r.before.count, beforeHigh: r.before.high, after: r.after.count, afterHigh: r.after.high, passes: r.passes, verified: r.verified });
    } else job.results.push({ url: r.url, ok: false, error: r.error });
  }).then(() => {
    // อัด ZIP ด้วย zip CLI ของระบบ
    execFile('zip', ['-r', '-q', join(dir, 'fixed-pages.zip'), '.', '-x', 'fixed-pages.zip'], { cwd: dir }, (err) => {
      job.zipReady = !err;
      job.status = 'done';
    });
  }).catch(e => { job.status = 'error'; job.error = String(e.message || e); });

  res.json({ id });
});
app.get('/api/fixpages/:id', (req, res) => {
  const job = fixJobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'ไม่พบงาน' });
  res.json(job);
});
app.get('/api/fixpages/:id/zip', (req, res) => {
  const f = join(BUNDLE_DIR, req.params.id.replace(/[^a-z0-9]/gi, ''), 'fixed-pages.zip');
  if (!existsSync(f)) return res.status(404).send('ยังไม่มีไฟล์');
  res.download(f, 'fixed-pages.zip');
});

// รายงานฉบับลูกค้า (Deck) — เปิดในแท็บใหม่ พิมพ์เป็น PDF ได้เลย (รองรับ white-label ผ่าน query)
app.get('/report/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  const audit = job?.result || loadAudit(req.params.id);
  if (!audit) return res.status(404).send('ไม่พบรายงานนี้');
  const brand = {
    name: String(req.query.bn || '').slice(0, 60),
    logo: /^https?:\/\//.test(String(req.query.bl || '')) ? String(req.query.bl).slice(0, 300) : '',
    color: /^#[0-9a-fA-F]{6}$/.test(String(req.query.bc || '')) ? String(req.query.bc) : '',
  };
  res.type('html').send(renderReport(audit, brand));
});

// รายงานฉบับ "เซลส์/ลูกค้าอ่านเข้าใจ" — ข้อความเต็มไม่ตัด + อธิบายทุกศัพท์เป็นภาษาคน (รองรับ white-label)
app.get('/report-sale/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  const audit = job?.result || loadAudit(req.params.id);
  if (!audit) return res.status(404).send('ไม่พบรายงานนี้');
  const brand = {
    name: String(req.query.bn || '').slice(0, 60),
    logo: /^https?:\/\//.test(String(req.query.bl || '')) ? String(req.query.bl).slice(0, 300) : '',
    color: /^#[0-9a-fA-F]{6}$/.test(String(req.query.bc || '')) ? String(req.query.bc) : '',
  };
  res.type('html').send(renderSalesReport(audit, brand));
});

// รายงานรูปแบบ Presentation (สไลด์ 16:9 เลื่อนทีละหน้า เต็มจอได้)
app.get('/present/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  const audit = job?.result || loadAudit(req.params.id);
  if (!audit) return res.status(404).send('ไม่พบรายงานนี้');
  const brand = {
    name: String(req.query.bn || '').slice(0, 60),
    logo: /^https?:\/\//.test(String(req.query.bl || '')) ? String(req.query.bl).slice(0, 300) : '',
    color: /^#[0-9a-fA-F]{6}$/.test(String(req.query.bc || '')) ? String(req.query.bc) : '',
  };
  res.type('html').send(renderPresentation(audit, brand));
});

// ═══ Watchlist — เฝ้าระวังอัตโนมัติ + แจ้งเตือน LINE ═══
const WATCH_FILE = join(__dirname, 'data', 'watchlist.json');
const loadWatch = () => { try { return JSON.parse(readFileSync(WATCH_FILE, 'utf8')); } catch { return []; } };
const saveWatch = (list) => writeFileSync(WATCH_FILE, JSON.stringify(list, null, 1));

async function linePush(text) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN, to = process.env.LINE_USER_ID;
  if (!token || !to) return false;
  try {
    await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'content-type': 'application/json' },
      body: JSON.stringify({ to, messages: [{ type: 'text', text: text.slice(0, 4900) }] }),
    });
    return true;
  } catch { return false; }
}

// เรียกหลังทุก audit เสร็จ — อัปเดต watchlist + แจ้งเตือนเมื่อคะแนนตกหรือมีปัญหาใหม่
function notifyWatch(url, audit) {
  const list = loadWatch();
  const item = list.find(w => normUrl(w.url) === normUrl(url));
  if (!item) return;
  const prevScore = item.lastScore;
  item.lastRun = new Date().toISOString();
  item.lastScore = audit.score.overall;
  item.lastId = audit.id;
  saveWatch(list);
  const d = audit.delta;
  if (prevScore != null && (audit.score.overall < prevScore - 3 || (d && (d.regressed.length || d.newIssues.length)))) {
    linePush(`[SEO Audit] ${normUrl(url)}\nคะแนน ${prevScore} → ${audit.score.overall}${d ? `\nแย่ลง ${d.regressed.length} ข้อ / ปัญหาใหม่ ${d.newIssues.length} ข้อ` : ''}\nดูรายงาน: http://localhost:${PORT}/report/${audit.id}`);
  }
}

app.get('/api/watchlist', (_req, res) => res.json({ list: loadWatch(), lineReady: !!(process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_USER_ID) }));
app.post('/api/watchlist', (req, res) => {
  let { url, intervalDays = 7, remove = false } = req.body || {};
  if (!url) return res.status(400).json({ error: 'ต้องระบุ url' });
  let list = loadWatch();
  if (remove) list = list.filter(w => normUrl(w.url) !== normUrl(url));
  else if (!list.some(w => normUrl(w.url) === normUrl(url)))
    list.push({ url, intervalDays: Math.min(Math.max(+intervalDays, 1), 30), addedAt: new Date().toISOString(), lastRun: null, lastScore: null, lastId: null });
  saveWatch(list);
  res.json({ list });
});

// ตัวจับเวลา: เช็คทุกชั่วโมงว่ามีเว็บไหนถึงรอบตรวจ
function watchTick() {
  const list = loadWatch();
  const now = Date.now();
  for (const w of list) {
    const due = !w.lastRun || (now - new Date(w.lastRun).getTime()) > w.intervalDays * 86400_000;
    const alreadyRunning = [...jobs.values()].some(j => normUrl(j.url) === normUrl(w.url) && j.status !== 'done' && j.status !== 'error');
    if (due && !alreadyRunning) {
      const id = crypto.randomBytes(6).toString('hex');
      const job = { id, url: w.url, status: 'queued', progress: [], startedAt: Date.now() };
      jobs.set(id, job);
      runAudit(job, w.url, 30, null);
    }
  }
}
setInterval(watchTick, 60 * 60 * 1000);
setTimeout(watchTick, 30_000); // เช็ครอบแรกหลังบูต 30 วิ

app.get('/api/health', (_req, res) => res.json({ ok: true, aiAvailable: aiAvailable() }));

app.listen(PORT, () => {
  console.log(`\nAI SEO Audit Pro พร้อมใช้งาน → http://localhost:${PORT}`);
  const _provider = process.env.OPENROUTER_API_KEY ? 'OpenRouter' : process.env.ANTHROPIC_API_KEY ? 'Claude' : 'OpenAI';
  console.log(`   AI layer: ${aiAvailable() ? 'พร้อม (' + _provider + ')' : 'ยังไม่ได้ใส่ API key — ใช้สรุปแบบ template'}`);
  console.log(`   Demo site สำหรับทดสอบ: http://localhost:${PORT}/demo/\n`);
});
