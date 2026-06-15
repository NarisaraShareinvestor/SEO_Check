# ⚡ AI SEO Audit Pro

ตรวจ SEO + GEO (AI Search) ลึกระดับเอเจนซี่ใน 5 นาที พร้อม **AI Auto-Fix** — สร้างไฟล์แก้ให้เสร็จ ไม่ใช่แค่รายงานปัญหา

> แผนธุรกิจ/โปรดักต์ฉบับเต็ม: เปิด [PLAN.html](PLAN.html) ในเบราว์เซอร์

## เริ่มใช้งาน

```bash
npm install
npm start
# เปิด http://localhost:3000
```

ทดสอบกับ demo site ที่ฝังปัญหา SEO ไว้: ใส่ URL `http://localhost:3000/demo/index.html`

## เปิดใช้ AI วิเคราะห์เชิงลึก (แนะนำ)

```bash
cp .env.example .env
# ใส่ ANTHROPIC_API_KEY หรือ OPENAI_API_KEY อย่างใดอย่างหนึ่ง
```

ไม่มี key ระบบยังทำงานครบ แต่บทสรุปผู้บริหารและ meta ที่เขียนใหม่จะเป็นแบบ template แทนที่ AI จะเขียนรายเคส

## Rendered Crawl (ติดตั้งมาแล้ว)

Playwright + Chromium อยู่ใน dependencies แล้ว — ระบบ render หน้าจริงด้วย headless Chrome แล้วเทียบกับ raw HTML อัตโนมัติ เพื่อพิสูจน์ว่าเนื้อหาส่วนไหน "มองไม่เห็น" โดย Googlebot รอบแรก / AI bots
(เครื่องใหม่ให้รัน `npx playwright install chromium` หนึ่งครั้ง)

## Core Web Vitals จริงจาก Google

ทุก audit ของเว็บสาธารณะจะยิง Google PageSpeed API คู่ขนานกับ crawl — ได้คะแนน Lighthouse Performance, LCP/INP/CLS จากผู้ใช้จริง (CrUX 28 วัน) และรายการ opportunity ที่ลดเวลาได้มากสุด (ฟรี ไม่ต้องมี key — ใส่ `PAGESPEED_API_KEY` เพื่อเพิ่ม quota)

## สิ่งที่ระบบตรวจ (9 หมวด)

| หมวด | ตัวอย่างจุดตรวจ |
|---|---|
| Meta & เนื้อหา | title/description (ขาด, ยาว, ซ้ำ), H1 + H1 ซ้ำข้ามหน้า, heading order/ว่าง, thin content, lang, viewport, doctype, deprecated tags, copyright เก่า, URL hygiene |
| Indexability | robots.txt (บล็อกทั้งเว็บ/section), sitemap + coverage + lastmod, canonical (ขาด/ซ้ำ/relative), noindex, redirect chains, meta refresh, 4xx/5xx, soft-404, hreflang, trailing-slash duplicates, **near-duplicate content (Jaccard)**, **www/https variants** |
| Structured Data | JSON-LD (ขาด/พัง), Organization, BreadcrumbList, Open Graph (+absolute og:image), Twitter Card |
| ลิงก์ | broken links, empty/generic anchor, internal links บาง, **orphan pages** |
| รูปภาพ | alt text, lazy loading, width/height (CLS) |
| ความเร็ว | **Lighthouse + CWV จริงจาก Google (LCP/INP/CLS lab+field)**, HTML size, render-blocking head scripts, third-party scripts, compression, TTFB, text-to-HTML ratio |
| ความปลอดภัย | HTTPS, HSTS, security headers, mixed content |
| JS Rendering | **SPA shell detection**, **raw vs rendered diff ด้วย headless Chrome จริง** |
| **GEO (AI Search)** | AI bot access 14 ตัว (GPTBot/ClaudeBot/Perplexity/Applebot/Meta/Amazonbot...), llms.txt, FAQ schema, Q&A content, E-E-A-T, **trust pages**, entity data |

## AI Auto-Fix สร้างอะไรให้บ้าง

- `robots.txt` ฉบับแก้ (เปิด AI bots + sitemap)
- `sitemap.xml` จากหน้าที่ crawl เจอจริง
- Organization + WebSite JSON-LD
- FAQ section + FAQPage schema
- `llms.txt` (มาตรฐานใหม่สำหรับ LLM)
- Canonical tags รายหน้า
- hreflang tags
- Security headers config (nginx/Apache)
- Meta title/description เขียนใหม่รายหน้า (AI เขียนจากเนื้อหาจริง)
- คู่มือเปิด SSR ตาม framework ที่ตรวจพบ

## สถาปัตยกรรม

```
server.js            Express API + job runner (in-memory jobs, ผลเก็บเป็น JSON ใน data/audits/)
lib/crawler.js       Crawl raw HTML (+ rendered ผ่าน Playwright ถ้ามี), robots, sitemap, broken links
lib/checks.js        Rule engine — deterministic ไม่ใช้ AI → ผลนิ่ง เร็ว ต้นทุนศูนย์
lib/geo.js           GEO readiness checks
lib/scorer.js        คะแนน 0–100 รายหมวด ถ่วงน้ำหนักตาม severity
lib/ai.js            AI layer (Claude/OpenAI) — สรุปผู้บริหาร, จัดลำดับ, เขียน meta
lib/autofix.js       สร้างไฟล์แก้จากปัญหาที่พบจริง
public/              Dashboard ภาษาไทย (gauge, AI analysis, checks, รายหน้า, Auto-Fix, ประวัติ, Export PDF)
demo-site/           เว็บตัวอย่างที่ฝังปัญหา SEO สำหรับเดโม่/ทดสอบ
```

หลักคิด: **rule engine ตรวจ / AI ตีความและแก้** — ผลตรวจเชื่อถือได้ 100% และต้นทุน AI ต่อ audit ต่ำมาก

## ผลทดสอบกับเว็บจริง

รันกับ `shareinvestorthailand.com` แล้วระบบจับปัญหาได้ตรงกับ audit ที่เอเจนซี่คิดเงินหลักหมื่น–แสน:
Nuxt SPA เปลือกเปล่า, ไม่มี H1/title ใน raw HTML, robots.txt บล็อก section, ไม่มี JSON-LD, ไม่มี canonical, GEO fail ทุกข้อ — ครบใน ~30 วินาที

## Roadmap ถัดไป (ดู PLAN.html)

- Phase 2: Keyword & competitor intel (DataForSEO), backlink health, PDF deck template แบบเอเจนซี่
- Phase 3: Auto-Fix apply ตรงเข้า CMS/GitHub PR + re-scan อัตโนมัติ
- Phase 4: ระบบสมาชิก, white-label, monitoring รายสัปดาห์ + แจ้งเตือน LINE
