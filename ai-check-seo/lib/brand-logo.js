// แบรนด์ผู้จัดทำ (ShareInvestor Thailand) — โลโก้ watermark จางๆ หลังเนื้อหา + ลิขสิทธิ์ใน footer
// อ่านโลโก้เป็น base64 data URI ครั้งเดียว (inline) เพื่อให้แสดงครบตอน print เป็น PDF
import { readFileSync } from 'fs';

const toDataUri = (rel) => { try { return 'data:image/png;base64,' + readFileSync(new URL(rel, import.meta.url)).toString('base64'); } catch { return ''; } };
// MAKER_LOGO = โลโก้เต็ม (มี tagline) ใช้เป็น watermark กลางหน้าแบบมาตรฐาน
const MAKER_LOGO = toDataUri('../data/Logo.png');
// CORNER_LOGO = โลโก้กระชับ (บูล+SHAREINVESTOR) ใช้เป็น watermark มุมขวาบนแบบพรีเมียม
const CORNER_LOGO = toDataUri('../data/image.png');
// HERO_LOGO = โลโก้พื้นโปร่งใส + ข้อความสว่าง (สำหรับวางบนพื้นเข้ม เช่นปกพรีเมียม)
const HERO_LOGO = toDataUri('../data/logo-dark.png');
export { MAKER_LOGO, CORNER_LOGO, HERO_LOGO };

// ข้อความลิขสิทธิ์ใน footer (ส่วนชื่อแบรนด์เน้นสีทอง)
export const COPYRIGHT_HTML = 'Copyright © 2026 <span class="cr-brand">ShareInvestor Thailand</span>';

// CSS: watermark + footer + ลิขสิทธิ์ (ชื่อ export = MAKER_CSS คงเดิมเพื่อไม่ต้องแก้จุดแทรก)
// .wm = ลายน้ำกลางหน้าใหญ่ (ซ่อนในธีมพรีเมียม) · .wm-corner = โลโก้แบรนด์มุมขวาบน โชว์ทุกธีมทุกสไลด์เนื้อหา
export const MAKER_CSS = `
.slide > *{position:relative;z-index:1}
/* ลายน้ำกลางหน้า — วางทับ "อยู่หน้า" ข้อความ (z-index สูงกว่าเนื้อหา) แต่จางมากจึงยังอ่านข้อความได้ */
.wm{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:96%;max-width:1200px;height:auto;opacity:.14;z-index:2;pointer-events:none;user-select:none}
/* โลโก้แบรนด์มุมขวาบน — โชว์ทุกสไลด์เนื้อหา ทุกธีม (เหมือนหัวกระดาษรายงาน) อยู่บนสุด */
.wm-corner{position:absolute;top:30px;right:48px;width:190px;height:auto;opacity:1;z-index:3;pointer-events:none;user-select:none}
body.theme-premium .wm{display:none}
footer{align-items:center}
.cr-brand{color:var(--goldtx);font-weight:700}
@media print{.wm,.wm-corner{-webkit-print-color-adjust:exact;print-color-adjust:exact}}`;

// สคริปต์ฝัง watermark ลงทุกสไลด์ "พื้นขาว" (ข้ามสไลด์เข้ม/ปก) — รันตอนโหลด
// ฝังทั้ง .wm (กลาง) และ .wm-corner (มุม) ไว้ทุกสไลด์ แล้วโชว์ตาม theme ด้วย CSS → ติดตอน print เป็น PDF
export const watermarkScript = () => MAKER_LOGO
  ? `<script>(function(){var M=${JSON.stringify(MAKER_LOGO)},C=${JSON.stringify(CORNER_LOGO)};document.querySelectorAll('.slide:not(.dark):not(.cover):not(.cover-premium)').forEach(function(s){var i=document.createElement('img');i.className='wm';i.src=M;i.alt='';s.insertBefore(i,s.firstChild);if(C){var j=document.createElement('img');j.className='wm-corner';j.src=C;j.alt='';s.insertBefore(j,s.firstChild);}});})();</script>`
  : '';
