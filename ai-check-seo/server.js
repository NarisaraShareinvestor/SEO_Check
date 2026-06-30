// AI SEO Audit Pro — API server + job runner
import express from 'express';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { crawlSite, normalizeUrl } from './lib/crawler.js';
import { runChecks, ENGINE_VERSION } from './lib/checks.js';
import { runGeoChecks } from './lib/geo.js';
import { fetchCWV, buildPsiChecks } from './lib/psi.js';
import { fetchLighthouse, crossCheck, annotateChecks, accuracyFromCrossChecks, explainMismatch } from './lib/verify.js';
import { discoverCompetitors } from './lib/discover.js';
import { fixLivePage, fixPagesBatch } from './lib/pagefix.js';
import { execFile } from 'node:child_process';
import { renderReport } from './lib/report.js';
import { renderSalesReport } from './lib/report-sales.js';
import { buildPlan, pushToClickUp, resolveRouting } from './lib/clickup.js';
import { recordPush, loadLinks, runReauditCycle } from './lib/reaudit.js';
import { renderExecReport } from './lib/report-exec.js';
import { renderSalesQA } from './lib/sales-qa.js';
import { renderPresentation } from './lib/present.js';
import { scoreAudit, CAT_LABELS } from './lib/scorer.js';
import { referenceFor } from './lib/references.js';
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
const MAX_PAGES_LIMIT = +(process.env.MAX_PAGES_LIMIT || 500); // full-site audit สูงสุด 500 หน้า
const DATA_DIR = join(__dirname, 'data', 'audits');
mkdirSync(DATA_DIR, { recursive: true });

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(join(__dirname, 'public')));
app.use('/demo', express.static(join(__dirname, 'demo-site'), { extensions: ['html'] }));
app.get('/methodology', (_req, res) => res.sendFile(join(__dirname, 'public', 'methodology.html')));
app.get('/architecture', (_req, res) => res.sendFile(join(__dirname, 'public', 'architecture.html')));
app.get('/knowledge-graph', (_req, res) => res.sendFile(join(__dirname, 'public', 'knowledge-graph.html')));
app.get('/reaudit', (_req, res) => res.sendFile(join(__dirname, 'public', 'reaudit.html')));

// in-memory job state (ผลถาวรเก็บเป็นไฟล์ JSON)
const jobs = new Map(); // id → {id, status, progress[], result?}

// SSE — push run-tracker updates ให้ dashboard แบบ real-time (ไม่ต้อง poll) · fallback เป็น polling ฝั่ง client
const sseClients = new Map(); // jobId → Set<res>
function emitJob(job) {
  const subs = sseClients.get(job.id);
  if (!subs || !subs.size) return;
  const payload = JSON.stringify({ status: job.status, steps: job.steps || [], progress: (job.progress || []).slice(-3), error: job.error });
  for (const res of subs) { try { res.write(`data: ${payload}\n\n`); } catch {} }
}

// Evidence snapshot — เซฟ raw/rendered HTML ต่อหน้าลง data/evidence/{auditId}/ (พิสูจน์ "หน้านี้เห็นแบบนี้จริง")
const EVIDENCE_DIR = join(DATA_DIR, '..', 'evidence');
// สกัด "ข้อมูลที่ตรวจเจอ" (signals) ต่อหน้า จาก page object ที่ engine ดึงมาแล้ว — ใช้แสดงใน Evidence View
function pageSignals(p) {
  const heads = p.headings || [];
  const h1 = heads.filter(h => h.tag === 'h1').map(h => h.text).filter(Boolean);
  const headingCounts = {};
  heads.forEach(h => { headingCounts[h.tag] = (headingCounts[h.tag] || 0) + 1; });
  const imgs = (p.images || []).filter(i => i.src);
  const ldTypes = new Set();
  (p.jsonLd || []).forEach(j => {
    if (!j.ok) return;
    const c = d => { if (Array.isArray(d)) return d.forEach(c); if (d && typeof d === 'object') { if (d['@type']) [].concat(d['@type']).forEach(t => ldTypes.add(t)); if (d['@graph']) c(d['@graph']); } };
    c(j.data);
  });
  return {
    title: p.title || '', titleH1Sim: (typeof p.titleH1Sim === 'number' ? p.titleH1Sim : null),
    h1, headingCounts,
    metaDescription: (p.metas && p.metas.description) || '',
    canonical: p.canonical || '', robots: (p.metas && p.metas.robots) || '',
    lang: p.lang || '', charset: p.charset || '',
    images: { total: imgs.length, missingAlt: imgs.filter(i => i.alt == null).length, emptyAlt: imgs.filter(i => i.alt === '').length },
    jsonLdTypes: [...ldTypes], wordCount: p.wordCount || 0, links: (p.links || []).length,
  };
}

function writeEvidence(auditId, pages) {
  try {
    const dir = join(EVIDENCE_DIR, auditId);
    mkdirSync(dir, { recursive: true });
    const index = []; let i = 0;
    for (const p of pages) {
      if (!p.rawSnapshot && !p.renderedSnapshot) continue;
      const slug = ((p.url || '').replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'page') + '_' + (i++);
      const entry = { url: p.url, status: p.status, signals: pageSignals(p) };
      if (p.rawSnapshot) { writeFileSync(join(dir, slug + '.raw.html'), p.rawSnapshot); entry.raw = slug + '.raw.html'; }
      if (p.renderedSnapshot) { writeFileSync(join(dir, slug + '.rendered.html'), p.renderedSnapshot); entry.rendered = slug + '.rendered.html'; }
      index.push(entry);
    }
    writeFileSync(join(dir, 'index.json'), JSON.stringify({ auditId, capturedAt: new Date().toISOString(), pages: index }, null, 2));
    return index.length;
  } catch { return 0; }
}

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

// check ที่ "ผลแกว่งได้เองโดยเว็บไม่เปลี่ยน" — ค่าวัดภายนอก (CWV จาก CrUX) หรือ probe ครั้งเดียวที่ timeout ได้
// → ถ้าผลพลิกในกลุ่มนี้ ไม่นับเป็น "แก้/แย่จริง" แต่โยนเข้ากล่อง explained ให้คนยืนยันเอง
const UNSTABLE_CHECKS = new Set([
  'cwv-score', 'host-variants', 'compression', 'sitemap-exists', 'robots-sitemap',
  'ssl-chain-incomplete', 'favicon-file', 'security-headers', 'robots-missing',
]);

// Delta Engine — เทียบผลตรวจสองครั้ง โดย "รู้ตัวว่าเทียบกันได้จริงไหม"
// แยก: (1) แก้/แย่จริง  (2) explained = เปลี่ยนเพราะตรวจไม่เท่ากัน/ระบบอัปเกรด/ค่าผันผวน ไม่ใช่การแก้เว็บ
function diffAudits(prev, curr) {
  const prevMap = new Map(prev.checks.map(c => [c.id, c]));
  const isBad = (st) => st === 'fail' || st === 'warn';
  const fixed = [], regressed = [], newIssues = [], explained = [];
  const prevPages = prev.pagesAnalyzed || 0, currPages = curr.pagesAnalyzed || 0;
  // ตรวจหน้าไม่เท่ากันอย่างมีนัย → ผลรายหน้าเทียบกันไม่ได้ (ทั้ง 2 ทาง): มากขึ้น=เจอปัญหาเดิมที่เพิ่งตรวจถึง · น้อยลง=ตรวจไม่ครบ
  const scopeThresh = Math.max(4, prevPages * 0.2);
  const scopeChanged = Math.abs(currPages - prevPages) > scopeThresh;
  const scopeGrew = scopeChanged && currPages > prevPages;
  const scopeShrank = scopeChanged && currPages < prevPages;
  // หน้าหายเกินครึ่ง หรือ SPA ที่ render ไม่สำเร็จ = crawl degraded (ได้แค่ shell เปล่า) → ผลไม่สมบูรณ์ เตือนดังๆ
  const degraded = (prevPages >= 8 && currPages < prevPages * 0.5) || !!curr.renderFailedSpa;
  const engineChanged = (prev.engineVersion || 0) !== (curr.engineVersion || 0);
  const exp = (c, from, to, reason) => explained.push({ id: c.id, title: c.title, from, to, reason });

  for (const c of curr.checks) {
    const p = prevMap.get(c.id);
    if (!p) { // ── check ใหม่ (ไม่มีใน prev) ──
      if (!isBad(c.status)) continue;
      if (UNSTABLE_CHECKS.has(c.id)) exp(c, '—', c.status, 'unstable');
      else if (scopeChanged) exp(c, '—', c.status, 'scope');   // เพิ่งตรวจถึง/ตรวจไม่ครบ ไม่ใช่ปัญหาใหม่จริง
      else if (engineChanged) exp(c, '—', c.status, 'engine');
      else newIssues.push({ id: c.id, title: c.title, from: '—', to: c.status });
      continue;
    }
    if (p.status === c.status) continue;
    const wasBad = isBad(p.status), nowBad = isBad(c.status);
    const improved = (wasBad && !nowBad) || (p.status === 'fail' && c.status === 'warn');
    const worsened = (!wasBad && nowBad) || (p.status === 'warn' && c.status === 'fail');
    if (!improved && !worsened) continue;
    if (UNSTABLE_CHECKS.has(c.id)) { exp(c, p.status, c.status, 'unstable'); continue; }
    // ตรวจหน้าไม่เท่ากัน → การเปลี่ยนรายหน้าเชื่อไม่ได้ (ทั้งดีขึ้น/แย่ลง) → เข้า explained ไม่นับเป็นจริง
    if (scopeChanged) { exp(c, p.status, c.status, 'scope'); continue; }
    if (improved) fixed.push({ id: c.id, title: c.title, from: p.status, to: c.status });
    else regressed.push({ id: c.id, title: c.title, from: p.status, to: c.status });
  }
  const catDeltas = {};
  for (const k of new Set([...Object.keys(curr.score.categoryScores), ...Object.keys(prev.score.categoryScores)]))
    catDeltas[k] = (curr.score.categoryScores[k] ?? 0) - (prev.score.categoryScores[k] ?? 0);
  return {
    prevId: prev.id, prevDate: prev.createdAt, prevScore: prev.score.overall,
    currScore: curr.score.overall, scoreDelta: curr.score.overall - prev.score.overall,
    fixed, regressed, newIssues, explained, categoryDeltas: catDeltas,
    scope: { prevPages, currPages, grew: scopeGrew, shrank: scopeShrank, degraded }, engineChanged,
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
  const push = (msg) => { job.progress.push({ t: Date.now(), msg }); emitJob(job); };
  // Run tracker — บันทึก step แบบมีโครงสร้าง (agent/status/เวลา/evidence) เพื่อให้ dashboard ติดตาม real-time ได้ ไม่ใช่กล่องดำ
  job.steps = [];
  const stepRec = (key, name) => { const s = { key, name, status: 'run', startedAt: Date.now() }; job.steps.push(s); emitJob(job); return s; };
  const stepEnd = (s, out, evidence) => { if (!s) return; s.status = 'done'; s.ms = Date.now() - s.startedAt; if (out) s.out = out; if (evidence) s.evidence = evidence; emitJob(job); };
  let sData, sCheck, sAudit, sResult;
  try {
    job.status = 'crawling';
    push(`เริ่มตรวจ ${url} (สูงสุด ${maxPages} หน้า)`);
    sData = stepRec('data', 'Data · ดึง raw + rendered + screenshot');
    const psiPromise = fetchCWV(url); // ยิง Google PageSpeed คู่ขนานไปกับ crawl (ใช้เวลา ~30-60s)
    // ตาข่ายกันตรวจผิด: ดึง Lighthouse SEO ของ Google มาเทียบผลเรา (คู่ขนาน) — ห้ามใช้ engine ตัดสิน engine
    const lhPromise = fetchLighthouse(url, process.env.PAGESPEED_API_KEY).catch(() => null);
    push('ส่งคำขอ Core Web Vitals ไปที่ Google PageSpeed (รันคู่ขนาน)...');

    // crawl เว็บเรา + เว็บคู่แข่ง คู่ขนานกัน
    const compPromise = competitorUrl
      ? crawlSite(competitorUrl, { maxPages: Math.min(15, maxPages), onProgress: (m) => push(`[คู่แข่ง] ${m}`) }).catch(e => { push(`[คู่แข่ง] crawl ไม่สำเร็จ: ${e.message}`); return null; })
      : Promise.resolve(null);
    const [site, compSite] = await Promise.all([
      crawlSite(url, { maxPages, onProgress: push }),
      compPromise,
    ]);
    const evCount = writeEvidence(job.id, site.pages); // เซฟ raw/rendered snapshot ต่อหน้า → /api/evidence
    stepEnd(sData, `ดึง ${site.pages.length} หน้า${site.renderedCrawl ? ' · SPA rendered (chromium)' : ''}${evCount ? ` · เก็บ snapshot ${evCount}` : ''}`, `/api/evidence/${job.id}`);

    job.status = 'analyzing';
    push('Crawl เสร็จ — กำลังรัน rule engine 200+ จุดตรวจ...');
    sCheck = stepRec('check', 'SEO Check · รัน 87 checks (raw + rendered)');
    const tech = runChecks(site);
    const geo = runGeoChecks(site);
    push('กำลังรอผล Core Web Vitals จาก Google...');
    const psi = await psiPromise;
    const psiChecks = buildPsiChecks(psi);
    const allChecks = [...tech.checks, ...geo.checks, ...psiChecks];
    // Reference Authority: ติดแหล่งอ้างอิง + tier + confidence ให้ทุก check → ตอบลูกค้า "อ้างจากอะไร"
    for (const c of allChecks) { const r = referenceFor(c.id); if (r) c.reference = r; }
    const score = scoreAudit(allChecks);
    stepEnd(sCheck, `พบ ${score.counts.fail} fail · ${score.counts.warn} warn จาก ${allChecks.length} checks`, `/report/${job.id}`);
    sAudit = stepRec('audit', 'Audit · severity + priority + AI + verify');

    const audit = {
      id: job.id, url, createdAt: new Date().toISOString(),
      engineVersion: ENGINE_VERSION,
      pagesAnalyzed: tech.pagesAnalyzed,
      pagesCrawled: site.pages.length,
      dedupedByFinalUrl: site.dedupedByFinalUrl || 0, // จำนวนหน้าที่ยุบเพราะ redirect ไป Final URL เดียวกัน
      sitemapUrls: site.sitemapUrls.length,
      brokenLinks: site.brokenLinks,
      renderedAvailable: !!site.rendered?.available,
      renderFailedSpa: !!site.renderFailedSpa, // SPA แต่ render ไม่สำเร็จ → ได้แค่ shell เปล่า ผลไม่สมบูรณ์
      isSpa: !!site.renderedCrawl || !!site.renderFailedSpa,
      socials: site.socials || [], logo: site.logo || '', // sameAs/logo จริงสำหรับ schema/E-E-A-T
      score, checks: allChecks, categories: CAT_LABELS,
      aiAvailable: aiAvailable(),
    };

    // เข้าเว็บไม่ได้เลย — แยกออกจาก "เว็บ SEO แย่" ชัดเจน
    // (เว็บ throttle/flap/WAF บล็อก → crawl ไม่ติด ไม่ใช่ความผิดของ SEO เว็บ ไม่ควรโชว์ 0/F หลอกตา)
    if (tech.pagesAnalyzed === 0) {
      // รวมสถานะจาก "ทั้งสองที่": network error (fetchErrors) + หน้าที่ตอบกลับแต่ไม่ใช่ 200 (site.pages)
      // — เว็บที่โดน WAF/rate-limit จะตอบ 403/429/503 พร้อม body HTML → ถูกเก็บใน site.pages ไม่ใช่ fetchErrors
      //   ถ้าดูแค่ fetchErrors จะได้ statuses ว่าง → ฟ้อง "ไม่ทราบสาเหตุ" ทั้งที่จริงโดนบล็อก (bug เดิม)
      const errStatuses = [...new Set(site.fetchErrors.map(e => e.status).filter(Boolean))];
      const errReasons = [...new Set(site.fetchErrors.map(e => e.error).filter(Boolean))].slice(0, 3);
      const pageStatuses = [...new Set(site.pages.map(p => p.status).filter(s => typeof s === 'number' && s !== 200))];
      const allStatuses = [...new Set([...errStatuses, ...pageStatuses])].sort((a, b) => a - b);
      const blockedByRobots = site.pages.filter(p => p.blocked).length;
      // "พยายามเชื่อมต่อ" จริง = network error + หน้าที่ตอบ non-200 (เคยนับแค่ fetchErrors → โชว์ 0 ครั้งหลอกตา)
      const attempts = site.fetchErrors.length + site.pages.filter(p => typeof p.status === 'number' && p.status !== 200).length;
      // ตรวจจับ geo-block: domain .th + network error (ไม่มี HTTP status) + ยังไม่ได้ตั้ง CRAWL_PROXY
      let hostname = ''; try { hostname = new URL(url).hostname; } catch {}
      const isThai = /\.th$/.test(hostname);
      const isNetErr = allStatuses.length === 0 && errReasons.some(r => /fetch.failed|timeout|ECON|ETIMED/i.test(r));
      const proxySet = !!(process.env.CRAWL_PROXY || process.env.PROXY_URL);
      const geoBlock = isThai && isNetErr && !proxySet;
      const wafStatus = allStatuses.find(s => s === 403 || s === 429 || s === 503 || s === 401);
      audit.unreachable = true;
      audit.unreachableInfo = {
        crawled: site.pages.length,
        errors: attempts,
        statuses: allStatuses,
        reasons: errReasons,
        robotsStatus: site.robotsStatus,
        blockedByRobots,
        geoBlock,
        message: geoBlock
          ? 'เชื่อมต่อไม่ได้ — น่าจะเป็นการบล็อก IP ต่างประเทศ (geo-block) ซึ่งพบบ่อยในเว็บ .th'
          : blockedByRobots && !allStatuses.length && !errReasons.length
            ? 'robots.txt ของเว็บบล็อกการ crawl ทุกหน้า — ไม่สามารถตรวจได้ (ต้องอนุญาตใน robots.txt ก่อน)'
            : wafStatus
              ? `เซิร์ฟเวอร์ตอบกลับด้วยสถานะ ${allStatuses.join(', ')} — IP ของเซิร์ฟเวอร์ตรวจน่าจะโดน WAF/firewall บล็อกหรือ rate-limit (เว็บออนไลน์ปกติแต่กันการเข้าถึงจาก IP นี้)${proxySet ? ' — proxy/relay ที่ตั้งไว้อาจโดนบล็อกด้วย' : ' — ลองตั้ง CRAWL_PROXY เป็น relay'}`
              : allStatuses.length
                ? `เซิร์ฟเวอร์ตอบกลับด้วยสถานะ ${allStatuses.join(', ')} — เว็บอาจกำลังจำกัดการเข้าถึง (rate limit/WAF) หรือล่มชั่วคราว`
                : `เชื่อมต่อเว็บไม่สำเร็จ (${errReasons.join(', ') || 'ไม่ทราบสาเหตุ'}) — เว็บอาจล่มหรือบล็อกการตรวจชั่วคราว`,
      };
      job.status = 'done';
      push(`เข้าเว็บไม่ได้ — crawl 0 หน้า (${audit.unreachableInfo.message}). ข้ามการวิเคราะห์ ลองตรวจใหม่อีกครั้ง`);
      (job.steps || []).forEach(s => { if (s.status === 'run') { s.status = 'error'; s.ms = Date.now() - s.startedAt; } });
      audit.run = job.steps;
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
        // ขาด alt = รูปที่ "มองเห็นจริง" + ไม่มี alt attribute (ใช้ rendered DOM ถ้ามี → ตรง Lighthouse) · alt=""/aria-label/role=presentation/รูปซ่อน ไม่นับ
        imagesNoAlt: Array.isArray(p.imageVis) && p.imageVis.length
          ? p.imageVis.filter(i => i.visible && !i.ariaHidden && !i.labeled && i.alt == null).length
          : (p.images?.filter(i => i.src && (i.labeled != null ? !i.labeled : i.alt == null)).length || 0),
        jsonLdCount: p.jsonLd?.length || 0, emptyRoot: !!p.emptyRoot,
        elapsed: p.elapsed || 0, htmlKb: Math.round((p.htmlBytes || 0) / 1024),
        // เนื้อหาฉบับ render แล้ว (เฉพาะเว็บ SPA ที่ rendered crawl เก็บมา) — ใช้เสนอ H1/title จริงในรายงาน
        ...(p.renderedH1?.length ? { renderedH1: p.renderedH1 } : {}),
        ...(p.renderedTitle ? { renderedTitle: p.renderedTitle } : {}),
        ...(p.renderedDescription ? { renderedDescription: p.renderedDescription } : {}),
        ...(p.author ? { author: p.author } : {}),
      }));

    // ตาข่ายกันตรวจผิด: เทียบ "ข้อเท็จจริง" ของเรากับ Lighthouse ของ Google → เก็บใน audit.verify
    try {
      const lh = await lhPromise;
      if (lh && !lh.error) {
        audit.verify = crossCheck(audit, lh);
        if (audit.verify.flag) push(`⚠️ verify: ผลต่างจาก Google ${audit.verify.factMismatches.length} จุด (${audit.verify.factMismatches.join(', ')}) — ควรรีวิวก่อนส่งลูกค้า`);
        else push(`verify: ตรงกับ Google Lighthouse ${audit.verify.factAgree}/${audit.verify.factComparable} จุดหลัก ✓`);
      }
    } catch {}
    // ติดป้าย type/confidence/needsVerify ให้ทุก check (อิงผล cross-check) — รากฐานของ Quality Center
    try { audit.verifyMeta = annotateChecks(audit); if (audit.verifyMeta.needsVerify) push(`ต้องรีวิว ${audit.verifyMeta.needsVerify} check ก่อนส่งลูกค้า`); } catch {}
    stepEnd(sAudit, `จัดลำดับ + ${audit.verify ? (audit.verify.flag ? '⚠️ ต่าง Google บางจุด' : '✓ ตรง Google') : 'verify'}`, `/report/${job.id}`);

    // เทียบกับการตรวจครั้งก่อนของ URL เดียวกัน (ก่อน/หลังแก้)
    const prevAudit = findPreviousAudit(url, audit.createdAt);
    if (prevAudit) {
      audit.delta = diffAudits(prevAudit, audit);
      push(`เทียบกับครั้งก่อน: ${audit.delta.prevScore} → ${score.overall} (${audit.delta.scoreDelta >= 0 ? '+' : ''}${audit.delta.scoreDelta}) | แก้แล้ว ${audit.delta.fixed.length} ข้อ`);
    }

    sResult = stepRec('result', 'Result · สรุป + เก็บผล + report');
    job.status = 'done';
    push(`เสร็จสิ้น — คะแนน ${score.overall}/100 (เกรด ${score.grade}) | ปัญหาร้ายแรง ${score.counts.fail} ข้อ`);
    job.result = audit;
    stepEnd(sResult, `คะแนน ${score.overall}/100 (เกรด ${score.grade})`, `/report-sale/${job.id}`);
    audit.run = job.steps; // เก็บ run trace ลง audit → ทบทวนย้อนหลังได้
    saveAudit(audit);
    notifyWatch(url, audit); // แจ้งเตือนถ้าเว็บนี้อยู่ใน watchlist
  } catch (e) {
    job.status = 'error';
    job.error = String(e?.message || e);
    const running = (job.steps || []).find(s => s.status === 'run');
    if (running) { running.status = 'error'; running.ms = Date.now() - running.startedAt; }
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

// SSE stream — push run-tracker updates real-time (dashboard ใช้ EventSource · ถ้าเปิดไม่ได้ client fallback ไป poll /api/audit/:id)
app.get('/api/audit/:id/stream', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders?.();
  const job = jobs.get(req.params.id);
  if (!job) { res.write(`data: ${JSON.stringify({ status: 'notfound' })}\n\n`); return res.end(); }
  let subs = sseClients.get(job.id);
  if (!subs) { subs = new Set(); sseClients.set(job.id, subs); }
  subs.add(res);
  // ส่งสถานะปัจจุบันทันทีตอนเชื่อมต่อ
  res.write(`data: ${JSON.stringify({ status: job.status, steps: job.steps || [], progress: (job.progress || []).slice(-3), error: job.error })}\n\n`);
  req.on('close', () => { subs.delete(res); if (!subs.size) sseClients.delete(job.id); });
});

// Audit Quality — รวม verify จากทุก audit → precision/recall/FP/FN + เว็บที่ต้องรีวิว + check ที่พลาดบ่อย
app.get('/api/quality', (_req, res) => {
  // เอา audit "ล่าสุดต่อ 1 เว็บ" เท่านั้น — กันเว็บเดียวที่ scan ซ้ำหลายครั้งโผล่/ถูกนับซ้ำ
  // normalize URL: ตัด trailing slash + www + lowercase host → "x.com" กับ "x.com/" กับ "www.x.com" = เว็บเดียวกัน
  // (ถ้าไม่ทำ: re-scan เว็บเดิมด้วย URL ต่างนิดเดียว → audit เก่าที่ flag ค้างอยู่ไม่ถูกแทน)
  const siteKey = (u) => { try { const x = new URL(u); return x.hostname.replace(/^www\./, '').toLowerCase() + x.pathname.replace(/\/+$/, '') + (x.search || ''); } catch { return u; } };
  const latest = new Map(); let total = 0;
  for (const f of readdirSync(DATA_DIR).filter(f => f.endsWith('.json'))) {
    try {
      const a = JSON.parse(readFileSync(join(DATA_DIR, f), 'utf8'));
      total++;
      const k = siteKey(a.url);
      const prev = latest.get(k);
      if (!prev || (a.createdAt || '') > (prev.createdAt || '')) latest.set(k, a);
    } catch {}
  }
  const ccs = [], flagged = [], needsCount = {}, perSite = [];
  let withVerify = 0;
  for (const a of latest.values()) {
    if (a.verify?.rows) {
      withVerify++;
      ccs.push({ rows: a.verify.rows });
      // metric ราย "เว็บ" (เพราะจะตรวจหลายเว็บ) — confusion จาก verify ของเว็บนั้นเอง
      const o = accuracyFromCrossChecks([{ rows: a.verify.rows }]).overall;
      perSite.push({ id: a.id, url: a.url, createdAt: a.createdAt, score: a.score?.overall, grade: a.score?.grade,
        precision: o.precision, recall: o.recall, fpr: o.fpr, fnr: o.fnr, tp: o.tp, fp: o.fp, fn: o.fn, tn: o.tn,
        flag: !!a.verify.flag, mismatches: a.verify.factMismatches || [], explained: (a.verify.factMismatches || []).map(explainMismatch), seoScore: a.verify.seoScore });
      if (a.verify.flag) flagged.push({ id: a.id, url: a.url, createdAt: a.createdAt, mismatches: a.verify.factMismatches || [], explained: (a.verify.factMismatches || []).map(explainMismatch) });
    }
    for (const c of (a.checks || [])) if (c._needsVerify) needsCount[c.id] = (needsCount[c.id] || 0) + 1;
  }
  flagged.sort((x, y) => (y.createdAt || '').localeCompare(x.createdAt || ''));
  perSite.sort((x, y) => (y.flag - x.flag) || (x.fp + x.fn) - (y.fp + y.fn) || (y.createdAt || '').localeCompare(x.createdAt || ''));
  const topNeeds = Object.entries(needsCount).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => ({ id, n }));
  res.json({ total, sites: latest.size, withVerify, flaggedCount: flagged.length, accuracy: accuracyFromCrossChecks(ccs), perSite, flagged: flagged.slice(0, 25), topNeeds });
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

// ดาวน์โหลด PDF ฝั่งเซิร์ฟเวอร์ (headless Chrome + preferCSSPageSize) → ได้ A4 แนวนอนทุกครั้ง ไม่พึ่ง browser print ที่ Safari ไม่ flip orientation ให้
app.get('/report/:id/pdf', async (req, res) => {
  const audit = jobs.get(req.params.id)?.result || loadAudit(req.params.id);
  if (!audit) return res.status(404).send('ไม่พบรายงานนี้');
  let pw;
  try { pw = await import('playwright'); } catch { return res.status(503).send('PDF export ยังไม่พร้อม (ไม่มี Chromium บนเซิร์ฟเวอร์)'); }
  let browser;
  try {
    browser = await pw.chromium.launch({ headless: true });
    const page = await (await browser.newContext()).newPage();
    const qs = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : ''; // ส่ง brand query ต่อ
    await page.goto(`http://127.0.0.1:${PORT}/report/${encodeURIComponent(req.params.id)}${qs}`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
    const host = (audit.url || 'report').replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/[^a-z0-9.-]/gi, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${host}-dev.pdf"`);
    res.send(pdf);
  } catch (e) {
    res.status(500).send('สร้าง PDF ไม่สำเร็จ: ' + String(e.message || e));
  } finally { try { await browser?.close(); } catch {} }
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

// helper: render รายงาน HTML → PDF แนวนอนฝั่งเซิร์ฟเวอร์ (preferCSSPageSize ใช้ @page ของรายงาน → แนวนอนทุกครั้ง)
async function streamReportPdf(req, res, basePath, suffix) {
  const audit = jobs.get(req.params.id)?.result || loadAudit(req.params.id);
  if (!audit) return res.status(404).send('ไม่พบรายงานนี้');
  let pw;
  try { pw = await import('playwright'); } catch { return res.status(503).send('PDF export ยังไม่พร้อม (ไม่มี Chromium บนเซิร์ฟเวอร์)'); }
  let browser;
  try {
    browser = await pw.chromium.launch({ headless: true });
    const page = await (await browser.newContext()).newPage();
    const qs = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : ''; // ส่ง brand query ต่อ
    await page.goto(`http://127.0.0.1:${PORT}/${basePath}/${encodeURIComponent(req.params.id)}${qs}`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
    const host = (audit.url || 'report').replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/[^a-z0-9.-]/gi, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${host}-${suffix}.pdf"`);
    res.send(pdf);
  } catch (e) {
    res.status(500).send('สร้าง PDF ไม่สำเร็จ: ' + String(e.message || e));
  } finally { try { await browser?.close(); } catch {} }
}

// PDF แนวนอนของรายงานเซลส์ (เหมือน Deck/exec — สร้างฝั่งเซิร์ฟเวอร์ ไม่พึ่ง browser print ที่อาจได้แนวตั้ง)
app.get('/report-sale/:id/pdf', (req, res) => streamReportPdf(req, res, 'report-sale', 'sale'));

// ส่ง Action Items เข้า ClickUp (เฟส 1 — กดเองจากแดชบอร์ด) · ?dryRun=1 = ดูแผนงานก่อนไม่ยิงจริง
app.post('/api/clickup/:id', async (req, res) => {
  const audit = jobs.get(req.params.id)?.result || loadAudit(req.params.id);
  if (!audit) return res.status(404).json({ error: 'ไม่พบรายงานนี้' });
  const route = resolveRouting(audit, __dirname);
  if (req.query.dryRun === '1' || !process.env.CLICKUP_API_TOKEN) {
    const plan = buildPlan(audit);
    return res.json({
      dryRun: true,
      configured: !!process.env.CLICKUP_API_TOKEN,
      listId: route.listId || null,
      parent: plan.parent.name,
      subtasks: plan.subtasks.length,
      preview: plan.subtasks.slice(0, 8).map(s => ({ name: s.name, priority: s.priorityLabel, group: s.group, team: s.team })),
      note: process.env.CLICKUP_API_TOKEN ? 'ตัวอย่างแผนงาน (ยังไม่ยิงจริง)' : 'ยังไม่ได้ตั้ง CLICKUP_API_TOKEN — แสดงตัวอย่างแผนงานเท่านั้น',
    });
  }
  try {
    const result = await pushToClickUp(audit, { token: process.env.CLICKUP_API_TOKEN, listId: route.listId, assignee: route.assignee });
    try { recordPush(audit, result, route.listId); } catch (e) { console.error('recordPush:', e.message); } // เริ่มติดตามวงปิด
    res.json(result);
  } catch (e) { res.status(502).json({ error: String(e.message || e) }); }
});

// ── วงปิด (re-audit loop) ──
// รัน audit 1 ครั้งแล้วคืน audit object ที่เซฟแล้ว (ใช้โดย cycle — มี .delta เทียบ audit เดิมให้)
async function runAuditOnce(url) {
  const id = crypto.randomBytes(6).toString('hex');
  const job = { id, url, status: 'queued', progress: [], startedAt: Date.now() };
  jobs.set(id, job);
  await runAudit(job, url, MAX_PAGES_DEFAULT, null);
  if (job.status === 'error') throw new Error(job.error || 'audit failed');
  return job.result;
}

// trigger รอบตรวจซ้ำ — เรียกจาก cron บน VPS (curl) หรือกดจาก dashboard
app.post('/api/reaudit/run', async (_req, res) => {
  if (!process.env.CLICKUP_API_TOKEN) return res.status(400).json({ error: 'ยังไม่ได้ตั้ง CLICKUP_API_TOKEN' });
  try {
    const out = await runReauditCycle({ token: process.env.CLICKUP_API_TOKEN, runAudit: runAuditOnce, onLog: (m) => console.log('[reaudit]', m) });
    res.json(out);
  } catch (e) { res.status(502).json({ error: String(e.message || e) }); }
});

// state สำหรับ dashboard — เว็บที่กำลังติดตามวงปิด + ความคืบหน้า + before→after
app.get('/api/reaudit/state', (_req, res) => {
  res.json({ links: loadLinks(), intervalMin: +(process.env.REAUDIT_INTERVAL_MIN || 0) });
});

// ตัวจับเวลาในตัว (ทางเลือกแทน cron นอก) — ตั้ง REAUDIT_INTERVAL_MIN ใน .env (0 = ปิด)
const REAUDIT_INTERVAL_MIN = +(process.env.REAUDIT_INTERVAL_MIN || 0);
if (REAUDIT_INTERVAL_MIN > 0 && process.env.CLICKUP_API_TOKEN) {
  let running = false;
  setInterval(async () => {
    if (running) return; running = true; // กันรอบทับกัน
    try { const o = await runReauditCycle({ token: process.env.CLICKUP_API_TOKEN, runAudit: runAuditOnce, onLog: (m) => console.log('[reaudit]', m) }); if (o.checked) console.log(`[reaudit] รอบนี้ตรวจ ${o.checked} เว็บ`); }
    catch (e) { console.error('[reaudit] cycle error:', e.message); }
    finally { running = false; }
  }, REAUDIT_INTERVAL_MIN * 60_000);
  console.log(`[reaudit] scheduler เปิด — ทุก ${REAUDIT_INTERVAL_MIN} นาที`);
}

// รายงานสำหรับผู้บริหาร — ภาษาทางการ โครงสร้าง สิ่งที่ตรวจพบ/ผลกระทบ/ระดับความสำคัญ/คำแนะนำ
app.get('/report-exec/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  const audit = job?.result || loadAudit(req.params.id);
  if (!audit) return res.status(404).send('ไม่พบรายงานนี้');
  const brand = {
    name: String(req.query.bn || '').slice(0, 60),
    logo: /^https?:\/\//.test(String(req.query.bl || '')) ? String(req.query.bl).slice(0, 300) : '',
    color: /^#[0-9a-fA-F]{6}$/.test(String(req.query.bc || '')) ? String(req.query.bc) : '',
  };
  res.type('html').send(renderExecReport(audit, brand));
});

// ดาวน์โหลด PDF ฝั่งเซิร์ฟเวอร์ (headless Chrome render หน้าเดียวกัน → ได้ครบทุกครั้ง ไม่พึ่ง browser print ที่อาจได้หน้าว่าง)
app.get('/report-exec/:id/pdf', async (req, res) => {
  const audit = jobs.get(req.params.id)?.result || loadAudit(req.params.id);
  if (!audit) return res.status(404).send('ไม่พบรายงานนี้');
  let pw;
  try { pw = await import('playwright'); } catch { return res.status(503).send('PDF export ยังไม่พร้อม (ไม่มี Chromium บนเซิร์ฟเวอร์)'); }
  let browser;
  try {
    browser = await pw.chromium.launch({ headless: true });
    const page = await (await browser.newContext()).newPage();
    const qs = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : ''; // ส่ง brand query ต่อ
    await page.goto(`http://127.0.0.1:${PORT}/report-exec/${encodeURIComponent(req.params.id)}${qs}`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
    const host = (audit.url || 'report').replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/[^a-z0-9.-]/gi, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${host}-ceo.pdf"`);
    res.send(pdf);
  } catch (e) {
    res.status(500).send('สร้าง PDF ไม่สำเร็จ: ' + String(e.message || e));
  } finally { try { await browser?.close(); } catch {} }
});

// คู่มือ "เตรียมตอบคำถาม (Q&A)" สำหรับเซลส์ — คำถามที่ลูกค้าจะถามตอนนำเสนอ + คำตอบแนะนำ
app.get('/report-qa/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  const audit = job?.result || loadAudit(req.params.id);
  if (!audit) return res.status(404).send('ไม่พบรายงานนี้');
  const brand = {
    name: String(req.query.bn || '').slice(0, 60),
    logo: /^https?:\/\//.test(String(req.query.bl || '')) ? String(req.query.bl).slice(0, 300) : '',
    color: /^#[0-9a-fA-F]{6}$/.test(String(req.query.bc || '')) ? String(req.query.bc) : '',
  };
  res.type('html').send(renderSalesQA(audit, brand));
});

// PDF แนวนอนของคู่มือ Q&A (สร้างฝั่งเซิร์ฟเวอร์ → แนวนอนทุกครั้ง)
app.get('/report-qa/:id/pdf', (req, res) => streamReportPdf(req, res, 'report-qa', 'qa'));

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

// ผล link health-check ล่าสุด (รันด้วย cron: npm run check-refs) — กันลิงก์อ้างอิงตาย/ย้าย
app.get('/api/reference-health', (_req, res) => {
  try { res.json(JSON.parse(readFileSync(join(DATA_DIR, '..', 'reference-health.json'), 'utf8'))); }
  catch { res.json({ checkedAt: null, note: 'ยังไม่เคยรัน — npm run check-refs' }); }
});

// Evidence snapshot — รายการ + เสิร์ฟไฟล์ HTML ที่เก็บไว้ (raw/rendered ต่อหน้า)
app.get('/api/evidence/:auditId', (req, res) => {
  if (!/^[a-f0-9]+$/i.test(req.params.auditId)) return res.status(400).json({ error: 'bad id' });
  try { res.json(JSON.parse(readFileSync(join(EVIDENCE_DIR, req.params.auditId, 'index.json'), 'utf8'))); }
  catch { res.status(404).json({ error: 'ไม่มี evidence สำหรับ audit นี้' }); }
});
app.get('/api/evidence/:auditId/:file', (req, res) => {
  if (!/^[a-f0-9]+$/i.test(req.params.auditId) || !/^[a-zA-Z0-9._-]+\.html$/.test(req.params.file)) return res.status(400).end();
  try { res.type('html').send(readFileSync(join(EVIDENCE_DIR, req.params.auditId, req.params.file), 'utf8')); }
  catch { res.status(404).end(); }
});

// Evidence View — แสดง "ข้อมูลที่ตรวจเจอ" ต่อหน้า (signals ที่ engine ดึงมา + highlight จุดปัญหา) ไม่ใช่ HTML ดิบ
app.get('/evidence/:auditId', (req, res) => {
  if (!/^[a-f0-9]+$/i.test(req.params.auditId)) return res.status(400).send('bad id');
  const id = req.params.auditId;
  let idx;
  try { idx = JSON.parse(readFileSync(join(EVIDENCE_DIR, id, 'index.json'), 'utf8')); }
  catch { return res.status(404).send('ไม่มี evidence สำหรับ audit นี้'); }
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rawLinks = (p) => {
    const a = [];
    if (p.raw) a.push(`<a href="/api/evidence/${id}/${esc(p.raw)}" target="_blank" rel="noopener">📄 HTML ดิบ (raw)</a>`);
    if (p.rendered) a.push(`<a href="/api/evidence/${id}/${esc(p.rendered)}" target="_blank" rel="noopener">🖥️ HTML หลัง render</a>`);
    return a.length ? `<div class="raw">ดูต้นฉบับ: ${a.join(' · ')}</div>` : '';
  };
  // focus = แสดงเฉพาะ field ที่เกี่ยวกับ finding ที่กดมา (เช่น title-duplicate → focus=title) · ไม่ส่ง = หลักฐานรวมทุก field
  const focus = String(req.query.focus || '').toLowerCase();
  const FOCUS_ROWS = { title: ['title'], h1: ['h1'], titleh1: ['title', 'h1', 'titleh1'], desc: ['desc'], canonical: ['canonical'], robots: ['robots'], images: ['images'], schema: ['schema'], content: ['wordcount'], lang: ['lang'], headings: ['headings'] };
  const keep = (focus && FOCUS_ROWS[focus]) ? new Set(FOCUS_ROWS[focus]) : null;
  // p = index หน้าที่เกี่ยวกับ finding ที่กดมา (เช่น title ซ้ำเฉพาะ 2 หน้า) — ไม่ส่ง = ทุกหน้า
  const onlyP = new Set(String(req.query.p || '').split(',').map(x => parseInt(x, 10)).filter(n => !isNaN(n)));
  const cards = (idx.pages || []).map((p, i) => {
    if (onlyP.size && !onlyP.has(i)) return '';
    const s = p.signals;
    if (!s) return `<div class="card" id="p${i}"><h2>${esc(p.url)}</h2><p class="note bad">audit นี้เก็บก่อนมี Evidence View — re-run audit เพื่อดูข้อมูลที่ตรวจเจอ</p>${rawLinks(p)}</div>`;
    const rows = [
      ['title', 'Title', s.title ? esc(s.title) : '<b class="bad">— ไม่มี title</b>'],
      ['h1', 'H1', s.h1.length ? s.h1.map(esc).join(' · ') + (s.h1.length > 1 ? ` <b class="bad">(${s.h1.length} ตัว)</b>` : '') : '<b class="bad">— ไม่มี H1</b>'],
      ['titleh1', 'title ↔ H1', s.titleH1Sim == null ? '—' : (s.titleH1Sim < 0.1 ? `<b class="bad">${s.titleH1Sim} — คนละเรื่อง</b>` : `${s.titleH1Sim} (สอดคล้อง)`)],
      ['desc', 'Meta description', s.metaDescription ? esc(s.metaDescription) : '<b class="bad">— ไม่มี</b>'],
      ['canonical', 'Canonical', s.canonical ? esc(s.canonical) : '<b class="warn">— ไม่มี</b>'],
      ['robots', 'Robots', esc(s.robots || '(default index,follow)') + (/noindex/i.test(s.robots) ? ' <b class="bad">noindex!</b>' : '')],
      ['lang', 'Lang / charset', esc(s.lang || '—') + ' / ' + esc(s.charset || '—')],
      ['headings', 'Headings', Object.entries(s.headingCounts).map(([k, v]) => `${k}:${v}`).join('  ') || '—'],
      ['images', 'Images', `${s.images.total} รูป` + (s.images.missingAlt ? ` · <b class="bad">${s.images.missingAlt} ไม่มี alt</b>` : '') + (s.images.emptyAlt ? ` · ${s.images.emptyAlt} ใช้ alt=""` : '')],
      ['schema', 'Structured data (JSON-LD)', s.jsonLdTypes.length ? s.jsonLdTypes.map(esc).join(', ') : '<b class="warn">— ไม่มี</b>'],
      ['wordcount', 'Word count', s.wordCount + (s.wordCount < 150 ? ' <b class="bad">(บางเกินไป)</b>' : '')],
      ['links', 'Links', String(s.links)],
    ];
    const shown = keep ? rows.filter(r => keep.has(r[0])) : rows;
    return `<div class="card" id="p${i}">
      <h2>${esc(p.url)} <span class="st">HTTP ${esc(p.status)}</span></h2>
      <table>${shown.map(([k, label, v]) => `<tr><th>${label}</th><td>${v}</td></tr>`).join('')}</table>
      ${rawLinks(p)}
    </div>`;
  }).join('');
  const focusBanner = (keep || onlyP.size) ? `<div class="focusbar">แสดงเฉพาะ${onlyP.size ? 'หน้าที่' : 'ข้อมูลที่'}เกี่ยวกับ finding นี้ · <a href="/evidence/${esc(id)}">ดูข้อมูลทั้งหมดของทุกหน้า (หลักฐานรวม) →</a></div>` : '';
  res.type('html').send(`<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ข้อมูลที่ตรวจเจอ — ${esc(id)}</title><style>
:root{--ln:#e2e8f0;--mut:#64748b}*{box-sizing:border-box}body{font-family:-apple-system,'Segoe UI',sans-serif;max-width:920px;margin:0 auto;padding:24px 18px;color:#1e293b;background:#f8fafc;line-height:1.6}
h1{font-size:22px;margin:0 0 4px}.sub{color:var(--mut);font-size:13px;margin:0 0 20px}
.card{background:#fff;border:1px solid var(--ln);border-radius:12px;padding:16px 18px;margin-bottom:16px}
.card h2{font-size:14px;margin:0 0 12px;word-break:break-all;font-weight:600}.st{font-size:11px;color:#15803d;background:#e6f4ea;padding:1px 7px;border-radius:6px;margin-left:6px}
table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;color:var(--mut);font-weight:500;width:160px;vertical-align:top;padding:5px 10px 5px 0;white-space:nowrap}
td{padding:5px 0;vertical-align:top;word-break:break-word}tr+tr th,tr+tr td{border-top:1px solid #f1f5f9}
.bad{color:#c0392b}.warn{color:#b26b00}.note{font-size:13px}
.raw{margin-top:12px;padding-top:10px;border-top:1px dashed var(--ln);font-size:12px;color:var(--mut)}.raw a{color:#0369a1;text-decoration:none}.raw a:hover{text-decoration:underline}
.focusbar{background:#eef6ff;border:1px solid #bfdbfe;color:#1e40af;border-radius:8px;padding:9px 12px;font-size:12.5px;margin-bottom:16px}.focusbar a{color:#0369a1;font-weight:600;text-decoration:none}.focusbar a:hover{text-decoration:underline}
</style></head><body>
<h1>🔎 ข้อมูลที่ตรวจเจอ (Evidence)</h1>
<p class="sub">audit ${esc(id)} · เก็บเมื่อ ${esc(idx.capturedAt || '')} · ${(idx.pages || []).length} หน้า — นี่คือสิ่งที่ระบบดึงได้จากแต่ละหน้าจริง และใช้เป็นฐานในการตัดสิน (สีแดง = จุดที่เป็นปัญหา)</p>
${focusBanner}
${cards}</body></html>`);
});

app.listen(PORT, () => {
  console.log(`\nAI SEO Audit Pro พร้อมใช้งาน → http://localhost:${PORT}`);
  const _provider = process.env.OPENROUTER_API_KEY ? 'OpenRouter' : process.env.ANTHROPIC_API_KEY ? 'Claude' : 'OpenAI';
  console.log(`   AI layer: ${aiAvailable() ? 'พร้อม (' + _provider + ')' : 'ยังไม่ได้ใส่ API key — ใช้สรุปแบบ template'}`);
  console.log(`   Demo site สำหรับทดสอบ: http://localhost:${PORT}/demo/\n`);
});
