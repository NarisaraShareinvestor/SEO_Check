// Premium theme — ปกหรู (พื้นเข้ม + การ์ดสถิติไอคอน + แถบความน่าเชื่อถือ ShareInvestor) แนวนอน A4
// + watermark โลโก้มุมขวาบนแบบจาง (theme-premium) · ใช้คู่กับ report-sales.js
import { HERO_LOGO, COPYRIGHT_HTML } from './brand-logo.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ไอคอนเส้น (stroke = currentColor)
const IC = {
  trend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 16H3z"/><line x1="12" y1="10" x2="12" y2="14"/><line x1="12" y1="17" x2="12" y2="17"/></svg>',
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/></svg>',
  bulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 1 4 10.5c-.6.6-1 1.6-1 2.5H9c0-.9-.4-1.9-1-2.5A6 6 0 0 1 12 3z"/></svg>',
  bank: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V9l7-4 7 4v12M9 21v-6h6v6"/></svg>',
  medal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="5"/><path d="M9 13l-1.5 8L12 18l4.5 3L15 13"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5M16 6a3 3 0 0 1 0 6M20.5 20c0-2.2-1.2-3.8-3-4.4"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
};

// ปกพรีเมียม (แนวนอน) — รับ ctx ที่ report-sales เตรียมไว้
export function premiumCover(ctx) {
  const { host, dateTh, brandName, s, gradeWord, passesLen, pagesAnalyzed } = ctx;
  const card = (icon, num, unit, label) => `
    <div class="pc-stat">
      <div class="pc-ic">${icon}</div>
      <div class="pc-num">${num}${unit ? `<span class="pc-unit">${unit}</span>` : ''}</div>
      <div class="pc-lbl">${esc(label)}</div>
    </div>`;
  const cred = (icon, big, label, sub) => `
    <div class="pc-cred-i">
      <div class="pc-cred-ic">${icon}</div>
      <div class="pc-cred-tx"><b>${esc(big)}</b><span>${esc(label)}</span><i>${esc(sub)}</i></div>
    </div>`;

  return `
  <section class="slide cover-premium">
    ${HERO_LOGO ? `<img class="pc-hero" src="${HERO_LOGO}" alt="">` : ''}
    <div class="pc-head">
      <div class="pc-brandline">รายงานสุขภาพเว็บไซต์ ฉบับเข้าใจง่าย · โดย ${esc(brandName)}<br><span>${esc(dateTh)}</span></div>
    </div>
    <div class="pc-label"><span class="pc-bar"></span>เว็บไซต์ที่ตรวจสอบ</div>
    <h1 class="pc-url">${esc(host)}</h1>
    <div class="pc-uline"></div>
    <p class="pc-sub">เราตรวจเว็บไซต์ของคุณ ${pagesAnalyzed} หน้า แบบเดียวกับที่ Google และ AI มองเห็นจริง แล้วสรุปออกมาเป็นภาษาที่ทุกคนเข้าใจ — ปัญหาแต่ละข้อคืออะไร ทำไมถึงสำคัญต่อยอดขาย และควรแก้อะไรก่อน</p>
    <div class="pc-stats">
      ${card(IC.trend, s.overall, '<small>/100</small>', `คะแนนสุขภาพเว็บ · เกรด ${s.grade} (${gradeWord(s.grade)})`)}
      ${card(IC.warn, s.counts.fail, '', 'ปัญหาที่ต้องแก้')}
      ${card(IC.target, s.counts.warn, '', 'จุดที่ควรปรับปรุง')}
      ${card(IC.bulb, passesLen, '', 'เรื่องที่ทำได้ดีอยู่แล้ว')}
    </div>
    <div class="pc-cred">
      <div class="pc-cred-brand">
        <div class="pc-licensed">Licensed Technology by</div>
        <div class="si-mark"><b><span class="si-w">SHARE</span><span class="si-o">INVESTOR</span></b><div class="si-tag">Invest with Knowledge</div></div>
      </div>
      <div class="pc-cred-stats">
        ${cred(IC.medal, '18', 'Years of Experience', 'ประสบการณ์กว่า 18 ปี')}
        ${cred(IC.trend, 'NO.1', 'Market Share of Listed Companies', 'ส่วนแบ่งตลาดบริษัทจดทะเบียน')}
        ${cred(IC.globe, '5', 'Branches in Asia', '5 สาขาในเอเชีย')}
        ${cred(IC.shield, 'SET', 'Authorized Service Providers', 'ผู้ให้บริการที่ได้รับอนุญาตจาก SET')}
      </div>
    </div>
    <footer class="pc-foot"><span>${COPYRIGHT_HTML}</span></footer>
  </section>`;
}

// CSS ปกพรีเมียม + watermark มุมขวาบน (theme-premium)
export const PREMIUM_CSS = `
/* สลับปกตาม theme */
#cover-premium{display:none}
body.theme-premium #cover-standard{display:none}
body.theme-premium #cover-premium{display:flex}
/* ===== ปกพรีเมียม (ย่อพอดี 1 หน้า A4 + พื้นน้ำเงินเข้มสะอาด ไม่เพี้ยนตอน print) ===== */
.cover-premium{position:relative;overflow:hidden;color:#fff;padding:32px 58px 16px;
  background-color:#0e2240;background-image:linear-gradient(150deg,#16315a 0%,#0e2240 55%,#0a1a33 100%)}
.pc-hero{position:absolute;top:5%;right:1%;width:34%;max-width:430px;opacity:.55;pointer-events:none;z-index:0}
.cover-premium>*:not(.pc-hero){position:relative;z-index:1}
.pc-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px}
.pc-brandline{font-size:11px;font-weight:700;letter-spacing:.06em;color:#9fb6d6;text-transform:uppercase;line-height:1.6}
.pc-brandline span{color:#6f86a8;font-weight:600}
.pc-label{display:flex;align-items:center;gap:10px;font-size:12.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#cfe0f5;margin-bottom:8px}
.pc-bar{width:5px;height:18px;background:var(--gold);border-radius:3px;display:inline-block}
.pc-url{font-size:44px;font-weight:800;letter-spacing:-.02em;line-height:1.05;color:#fff;margin:0}
.pc-uline{width:70px;height:5px;background:var(--gold);border-radius:3px;margin:10px 0 11px}
.pc-sub{font-size:13px;color:#b9c8de;max-width:760px;line-height:1.55;margin-bottom:16px}
.pc-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:14px}
.pc-stat{background:rgba(255,255,255,.04);border:1px solid rgba(245,194,66,.45);border-radius:12px;padding:13px 16px;position:relative;overflow:hidden}
.pc-stat .pc-ic{width:28px;height:28px;color:var(--gold);border:1.5px solid rgba(245,194,66,.55);border-radius:50%;padding:5px;margin-bottom:8px}
.pc-stat .pc-ic svg{width:100%;height:100%;display:block}
.pc-num{font-size:36px;font-weight:800;color:var(--gold);line-height:1}
.pc-num .pc-unit{font-size:15px;color:#7e8da6;font-weight:700;margin-left:2px}
.pc-lbl{font-size:11.5px;color:#cdd9ea;margin-top:6px;line-height:1.35}
/* แถบความน่าเชื่อถือ */
.pc-cred{display:grid;grid-template-columns:220px 1fr;gap:22px;align-items:center;
  border-top:1px solid rgba(255,255,255,.12);padding-top:14px;margin-top:auto}
.pc-licensed{font-size:11px;color:#8fa3c2;margin-bottom:6px}
.si-mark b{font-size:25px;font-weight:800;letter-spacing:-.01em}
.si-w{color:#fff}.si-o{color:#ff7a1a}
.si-tag{font-size:11px;color:#9fb0c8;letter-spacing:.18em;margin-top:2px}
.pc-cred-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
.pc-cred-i{display:flex;gap:11px;align-items:flex-start}
.pc-cred-ic{width:30px;height:30px;color:var(--gold);flex:0 0 auto}
.pc-cred-ic svg{width:100%;height:100%;display:block}
.pc-cred-tx b{font-size:23px;font-weight:800;color:#fff;display:block;line-height:1}
.pc-cred-tx span{font-size:12px;font-weight:700;color:var(--gold);display:block;margin-top:3px}
.pc-cred-tx i{font-size:10.5px;font-style:normal;color:#9fb0c8;display:block;margin-top:2px}
/* footer ปก */
.pc-foot{display:flex;justify-content:center;align-items:center;text-align:center;margin-top:12px;padding-top:10px;
  border-top:1px solid rgba(255,255,255,.1);font-size:11px;color:#8fa3c2}
.pc-foot-l{display:inline-flex;align-items:center;gap:7px}
.pc-foot-ic{width:14px;height:14px;color:#8fa3c2}.pc-foot-ic svg{width:100%;height:100%;display:block}
.pc-foot b{color:var(--gold);font-weight:700}
@media print{.cover-premium,.pc-stat,.pc-num,.pc-hero,.si-o,.pc-foot b{-webkit-print-color-adjust:exact;print-color-adjust:exact}}`;
