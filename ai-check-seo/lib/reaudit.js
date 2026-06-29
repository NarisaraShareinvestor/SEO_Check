// reaudit.js — วงปิด (closed loop): รอคนแก้ task ใน ClickUp ครบ → ตรวจทั้งเว็บใหม่ → ส่งผลกลับ
// แนวคิด: เก็บ "link" (parentTask ↔ audit/url) ตอน push, แล้ว cron วน poll ว่า subtask Done ครบยัง
//          ครบ → runAudit ใหม่ (delta คำนวณเทียบ audit เดิมให้เอง) → คอมเมนต์ที่ parent + เปิด task ที่ยังพัง
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPlan } from './clickup.js';

const API = 'https://api.clickup.com/api/v2';
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const LINKS_DIR = join(__dirname, '..', 'data', 'reaudit');

// ชื่อ status ตอนเปิด task กลับ — ปกติดึงจาก List จริงอัตโนมัติ (ตัวที่ type:'open')
// ตั้ง CLICKUP_REOPEN_STATUS ใน .env ได้ถ้าต้องการบังคับชื่อเอง (override)
const REOPEN_OVERRIDE = process.env.CLICKUP_REOPEN_STATUS || '';

// ── link store: 1 ไฟล์ = 1 parent task ที่กำลังติดตาม ──
function linkPath(parentId) { return join(LINKS_DIR, `${String(parentId).replace(/[^\w-]/g, '')}.json`); }

export function saveLink(link) {
  if (!existsSync(LINKS_DIR)) mkdirSync(LINKS_DIR, { recursive: true });
  writeFileSync(linkPath(link.parentId), JSON.stringify(link, null, 2));
  return link;
}

export function loadLinks() {
  if (!existsSync(LINKS_DIR)) return [];
  return readdirSync(LINKS_DIR).filter(f => f.endsWith('.json')).map(f => {
    try { return JSON.parse(readFileSync(join(LINKS_DIR, f), 'utf8')); } catch { return null; }
  }).filter(Boolean).sort((a, b) => (b.pushedAt || 0) - (a.pushedAt || 0));
}

// สร้าง link record ตอน push เข้า ClickUp สำเร็จ (เรียกจาก server หลัง pushToClickUp)
export function recordPush(audit, pushResult, listId) {
  return saveLink({
    parentId: pushResult.parentId,
    parentUrl: pushResult.parentUrl,
    auditId: audit.id,
    url: audit.url,
    listId,
    pushedAt: Date.now(),
    status: 'awaiting_fixes',          // awaiting_fixes → reauditing → passed | needs_more_work
    baseScore: audit.score?.overall ?? null,
    subtasks: (pushResult.created || []).map(s => ({ id: s.id, name: s.name, checkId: s.checkId || null })),
    progress: { done: 0, total: pushResult.created?.length || 0 },
    history: [],                        // บันทึกแต่ละรอบ re-audit
  });
}

// ── ClickUp API ──
async function cu(path, token, init = {}) {
  const res = await fetch(API + path, { ...init, headers: { Authorization: token, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`ClickUp ${res.status}: ${body.err || JSON.stringify(body).slice(0, 160)}`);
  return body;
}

const isDone = (st) => ['done', 'closed'].includes(st?.type);

// ดึง subtask ทั้งหมดใต้ parent + นับว่าปิดไปกี่อัน
async function fetchSubtaskStatus(parentId, token) {
  const t = await cu(`/task/${parentId}?include_subtasks=true`, token);
  const subs = t.subtasks || [];
  const done = subs.filter(s => isDone(s.status)).length;
  return { total: subs.length, done, subs };
}

async function postComment(taskId, text, token) {
  return cu(`/task/${taskId}/comment`, token, { method: 'POST', body: JSON.stringify({ comment_text: text, notify_all: false }) });
}
async function setStatus(taskId, status, token) {
  return cu(`/task/${taskId}`, token, { method: 'PUT', body: JSON.stringify({ status }) });
}

// หา status ที่ใช้ "เปิด task กลับ" จาก List จริง — เลือกตัวแรกที่ type:'open' (เช่น "to do"/"open"/"backlog")
// แต่ละ List ตั้งชื่อ status ไม่เหมือนกัน → ดึงจริงปลอดภัยกว่า hardcode. cache ไว้ต่อ List
const _openStatusCache = new Map();
async function resolveOpenStatus(listId, token) {
  if (REOPEN_OVERRIDE) return REOPEN_OVERRIDE;
  if (_openStatusCache.has(listId)) return _openStatusCache.get(listId);
  let name = 'to do';
  try {
    const list = await cu(`/list/${listId}`, token);
    const statuses = list.statuses || [];
    const open = statuses.find(s => s.type === 'open') || statuses[0];
    if (open?.status) name = open.status;
  } catch { /* ใช้ค่า default ถ้าดึงไม่ได้ */ }
  _openStatusCache.set(listId, name);
  return name;
}

// ── หัวใจ: วน 1 รอบ ตรวจทุก link ที่รอแก้อยู่ ──
// deps.runAudit(url) → ต้อง return audit object ที่เซฟแล้ว (มี .delta เทียบ audit เดิมให้)
export async function runReauditCycle({ token, runAudit, onLog = () => {} }) {
  if (!token) throw new Error('ยังไม่ได้ตั้ง CLICKUP_API_TOKEN');
  const links = loadLinks().filter(l => l.status === 'awaiting_fixes' || l.status === 'needs_more_work');
  const summary = [];

  for (const link of links) {
    try {
      const { total, done, subs } = await fetchSubtaskStatus(link.parentId, token);
      link.progress = { done, total };

      if (total === 0 || done < total) {
        link.status = link.status === 'needs_more_work' ? 'needs_more_work' : 'awaiting_fixes';
        saveLink(link);
        onLog(`[${link.url}] ยังแก้ไม่ครบ ${done}/${total} — ข้าม`);
        summary.push({ url: link.url, action: 'waiting', done, total });
        continue;
      }

      // ครบทุก task → ตรวจทั้งเว็บใหม่
      onLog(`[${link.url}] แก้ครบ ${done}/${total} → re-audit`);
      link.status = 'reauditing'; saveLink(link);

      const fresh = await runAudit(link.url);            // .delta เทียบ audit ก่อนหน้าให้แล้ว
      const delta = fresh.delta || {};

      // หา task ที่ยังพัง:
      //  - ทางหลัก: match ด้วย checkId ตรงๆ (สถานะ check ใน audit ใหม่ยัง fail/warn ไหม) — แม่นสุด
      //  - fallback: link เก่าที่ยังไม่มี checkId → เทียบชื่อ subtask กับแผนใหม่
      const statusById = new Map((fresh.checks || []).map(c => [c.id, c.status]));
      const isBad = (s) => s === 'fail' || s === 'warn';
      const stillBadNames = new Set(buildPlan(fresh).subtasks.map(s => s.name)); // ใช้เป็น fallback
      const openStatus = await resolveOpenStatus(link.listId, token);
      const reopened = [];
      for (const st of link.subtasks) {
        const stillBad = st.checkId
          ? isBad(statusById.get(st.checkId))      // checkId หาย = check นั้นไม่ fail แล้ว = ผ่าน
          : stillBadNames.has(st.name);            // fallback สำหรับ link เก่า
        if (stillBad) {
          try { await setStatus(st.id, openStatus, token); reopened.push(st.name); }
          catch (e) { onLog(`เปิด task กลับไม่ได้: ${st.name} (${e.message})`); }
        }
      }

      const passed = reopened.length === 0;
      const before = link.baseScore ?? delta.prevScore;
      const after = fresh.score?.overall;
      const comment = [
        passed ? '✅ ตรวจซ้ำแล้ว — ผ่านครบทุกข้อ' : `⚠️ ตรวจซ้ำแล้ว — ยังเหลือ ${reopened.length} ข้อ`,
        `คะแนนรวม: ${before ?? '–'} → ${after ?? '–'}${delta.scoreDelta != null ? ` (${delta.scoreDelta >= 0 ? '+' : ''}${delta.scoreDelta})` : ''}`,
        `แก้สำเร็จ: ${delta.fixed?.length ?? 0} ข้อ` + (delta.regressed?.length ? ` · แย่ลง: ${delta.regressed.length} ข้อ` : ''),
        reopened.length ? `เปิดงานกลับ:\n` + reopened.map(n => `• ${n}`).join('\n') : '',
        `รายงานฉบับใหม่: ${fresh.id}`,
      ].filter(Boolean).join('\n');
      try { await postComment(link.parentId, comment, token); } catch (e) { onLog(`คอมเมนต์ไม่ได้: ${e.message}`); }

      link.status = passed ? 'passed' : 'needs_more_work';
      link.newAuditId = fresh.id;
      link.history.push({ at: Date.now(), before, after, fixed: delta.fixed?.length ?? 0, reopened: reopened.length, passed });
      saveLink(link);
      summary.push({ url: link.url, action: passed ? 'passed' : 'reopened', before, after, fixed: delta.fixed?.length ?? 0, reopened: reopened.length });
    } catch (e) {
      onLog(`[${link.url}] error: ${e.message}`);
      summary.push({ url: link.url, action: 'error', error: e.message });
    }
  }
  return { checked: links.length, summary };
}
