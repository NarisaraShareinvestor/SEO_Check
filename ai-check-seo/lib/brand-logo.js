// แบรนด์ผู้จัดทำ (ShareInvestor Thailand) — โลโก้ watermark จางๆ หลังเนื้อหา + ลิขสิทธิ์ใน footer
// อ่านโลโก้เป็น base64 data URI ครั้งเดียว (inline) เพื่อให้แสดงครบทั้งตอน print เป็น PDF และ html2canvas → PowerPoint
import { readFileSync } from 'fs';

// แหล่งโลโก้ watermark — Logo.png (มี tagline "Invest with Knowledge") · สลับเป็น ../data/image.png ได้ถ้าต้องการแบบกระชับ
const WM_SRC = '../data/Logo.png';
let MAKER_LOGO = '';
try { MAKER_LOGO = 'data:image/png;base64,' + readFileSync(new URL(WM_SRC, import.meta.url)).toString('base64'); } catch { MAKER_LOGO = ''; }
export { MAKER_LOGO };

// ข้อความลิขสิทธิ์ใน footer (ส่วนชื่อแบรนด์เน้นสีทอง)
export const COPYRIGHT_HTML = 'Copyright © 2026 <span class="cr-brand">ShareInvestor Thailand</span>';

// CSS: watermark (เฉพาะสไลด์พื้นขาว) + footer + ลิขสิทธิ์ (ชื่อ export = MAKER_CSS คงเดิมเพื่อไม่ต้องแก้จุดแทรก)
export const MAKER_CSS = `
.slide > *{position:relative;z-index:1}
.wm{position:absolute;left:50%;top:68%;transform:translate(-50%,-50%);width:96%;max-width:1200px;height:auto;opacity:.18;z-index:0;pointer-events:none;user-select:none}
footer{align-items:center}
.cr-brand{color:var(--goldtx);font-weight:700}
@media print{.wm{-webkit-print-color-adjust:exact;print-color-adjust:exact}}`;

// สคริปต์ฝัง watermark ลงทุกสไลด์ "พื้นขาว" (ข้ามสไลด์เข้ม .dark) — รันบนเบราว์เซอร์ตอนโหลด
// ทำให้ติดทั้งตอน print (DOM พร้อมก่อนพิมพ์) และ html2canvas → PowerPoint (ถ่ายหลังโหลด)
export const watermarkScript = () => MAKER_LOGO
  ? `<script>(function(){var M=${JSON.stringify(MAKER_LOGO)};document.querySelectorAll('.slide:not(.dark):not(.cover)').forEach(function(s){var i=document.createElement('img');i.className='wm';i.src=M;i.alt='';s.insertBefore(i,s.firstChild);});})();</script>`
  : '';
