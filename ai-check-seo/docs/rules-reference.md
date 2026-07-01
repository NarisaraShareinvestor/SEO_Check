# AI SEO Audit Pro — คู่มือกฎทั้งหมด (Rule Reference)

> เอกสารนี้ generate จาก `public/skill-graph.json` (แหล่งข้อมูลเดียวกับกราฟในแอป) — แต่ละกฎมี What / Why / How / Decision Rule / Dependencies / References / Confidence เหมือน panel ที่คลิกในกราฟ

สรุป: **91 กฎ** · 31 entity · 8 หมวด · กฎที่ยืนยันความถูกต้องแล้ว **5** ตัว

---

## 🔷 Dependencies — ข้อมูลตั้งต้น (input ของกฎ)

ไม่ใช่กฎ (ไม่ให้ผล pass/fail เอง) แต่เป็นสัญญาณที่คำนวณครั้งเดียวแล้วหลายกฎดึงไปใช้ร่วมกัน — หน้าที่หลักคือ **กรอง "ซ้ำปลอม" ออกก่อนกฎตัดสิน**

### ◻︎ Final URL
หา URL ปลายทางจริงก่อนวิเคราะห์ — dependency กลางของ duplicate/canonical/per-page

**ทำงานยังไง:** GET → Follow 301/302 จนสุด → ได้ Final URL + status + redirect chain → ยุบ http→https · www→non-www · trailing slash · / → /en/home ที่ไปที่เดียวกัน

**ป้อนให้กฎ:** `นับหน้าจาก Final URL` · `หลาย URL → Final URL เดียวกัน = หน้าเดียว (dedupe)`

**กฎที่พึ่ง:** `<title> ซ้ำ` · `description ซ้ำ` · `ไม่มี <h1>` · `<h1> หลายตัว` · `<h1> ซ้ำหน้าอื่น` · `<h1> ถูกซ่อน` · `ไม่มี canonical` · `หน้าซ้ำใกล้เคียง`

อ้างอิง: [Google: Redirects](https://developers.google.com/search/docs/crawling-indexing/301-redirects) · [RFC 9110 §15.4](https://www.rfc-editor.org/rfc/rfc9110#name-redirection-3xx)

### ◻︎ Canonical

**กฎที่พึ่ง:** `<title> ซ้ำ` · `description ซ้ำ` · `<h1> ซ้ำหน้าอื่น` · `หน้าซ้ำใกล้เคียง`

### ◻︎ Language

**กฎที่พึ่ง:** `<title> ซ้ำ` · `description ซ้ำ` · `<h1> ซ้ำหน้าอื่น`

### ◻︎ Page Type

**กฎที่พึ่ง:** `<title> ซ้ำ` · `description ซ้ำ` · `<h1> ซ้ำหน้าอื่น`

---

## 📋 กฎทั้งหมด (จัดกลุ่ม หมวด → Entity → กฎ)

# On-Page

## Title

### ไม่มี <title>

`On-Page` · ความเชื่อมั่น 100% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 103-115)**

1. หา <title> แท็ก ใน HTML ดิบ — *Google อ่านจาก HTML ดิบก่อน render JS*
2. ถ้าไม่มี ให้หา title ที่ render ด้วย JS — *SPA อาจสร้าง title ด้วย JavaScript*
3. ถ้ามี title ใน HTML ดิบ ให้ผ่าน — *เป็นสถานะที่ดี*

เกณฑ์ตัดสิน:
- ไม่มี raw และ render → ผิด | มี render แต่ไม่มี raw → ควรแก้ | มี raw → ผ่าน

**WHAT — ตรวจอะไร**

Title คือชื่อหน้าเว็บ — เป็นบรรทัดสีน้ำเงินตัวใหญ่ที่คนเห็นเป็นอันดับแรกบนหน้าผลการค้นหา Google และเป็นชื่อที่โชว์บนแท็บเบราว์เซอร์ ถ้าหน้าไหนไม่ใส่ Google จะเดาชื่อให้เอง ซึ่งมักออกมาไม่ตรงกับที่เราอยากสื่อ

**WHY — ทำไมต้องตรวจ**

นี่คือ "พาดหัวร้าน" บนหน้า Google — เป็นตัวตัดสินว่าคนจะคลิกเข้าเว็บเราหรือคลิกคู่แข่ง ถ้าปล่อยให้ Google เดาเอง พาดหัวอาจกลายเป็นข้อความมั่วๆ ที่ไม่มีใครอยากกด เท่ากับเสียลูกค้าตั้งแต่ยังไม่เข้าเว็บ

**อ้างอิง:** [Google: Influencing title links](https://developers.google.com/search/docs/appearance/title-link) · [HTML Standard: the title element](https://html.spec.whatwg.org/multipage/semantics.html#the-title-element)


### <title> สั้น/ยาว

`On-Page` · ความเชื่อมั่น 75% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 117-123)**

1. วัดความยาว <title> ที่มีอยู่ — *เพื่อให้ title แสดงครบในผลค้นหา Google*
2. ตรวจว่าติดช่วง 15-60 ตัวอักษร — *เกิน 60 ตัด ต่ำกว่า 15 อ่านไม่ชัด*

เกณฑ์ตัดสิน:
- ยาวเกิน 60 หรือสั้นเกิน 15 → ควรแก้

**WHAT — ตรวจอะไร**

ความยาวของชื่อหน้า (Title) ที่เหมาะสมคือประมาณ 30–60 ตัวอักษร ถ้ายาวเกินไป Google จะตัดท้ายทิ้งแล้วต่อด้วย "…" ถ้าสั้นเกินไปก็ดูไม่น่าสนใจ

**WHY — ทำไมต้องตรวจ**

ชื่อที่โดนตัดกลางคันทำให้ข้อความขายที่สำคัญหายไปจากสายตาลูกค้าบนหน้า Google ลดโอกาสที่คนจะกดเข้ามา

**อ้างอิง:** [Google: Influencing title links](https://developers.google.com/search/docs/appearance/title-link) · [Moz: Title tag](https://moz.com/learn/seo/title-tag)


### <title> ซ้ำ  ✅ ยืนยันแล้ว

`On-Page` · ความเชื่อมั่น 85% · Tier 2
> verify (เคส vgi) + backport exclusions/normalize เท่า h1 + unit test 130/130

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 125-133)**

1. เก็บเฉพาะหน้า indexable (ไม่มี noindex/canonical ชี้ออก) — *หน้า noindex ไม่ควรส่ง ranking signal*
2. ปรับ title ให้เปรียบเทียบกันได้ — *Test กับ test ไม่ควรนับว่าต่างกัน*
3. ตัด localization variants ออก — *เว็บหลายภาษา แต่แต่ละหน้า native ควรมี title เฉพาะ*

เกณฑ์ตัดสิน:
- พบ title ซ้ำข้าม 2 หน้า → ควรแก้

**WHAT — ตรวจอะไร**

มีหลายหน้าใช้ชื่อหน้า (Title) เหมือนกันเป๊ะ เหมือนร้านในห้างที่แขวนป้ายชื่อร้านเดียวกัน 3-4 ป้าย ทั้งที่ขายของคนละอย่าง ทำให้ทั้งคนและ Google งงว่าหน้าไหนคือหน้าอะไร

**WHY — ทำไมต้องตรวจ**

เมื่อหลายหน้าชื่อซ้ำกัน Google ไม่รู้ว่าจะดันหน้าไหนขึ้นอันดับ เลยกระจายคะแนนหรือเลือกหน้าผิดมาแสดง ทำให้หน้าที่เราอยากให้ลูกค้าเจอจริงๆ ถูกกลบ อันดับโดยรวมตก

**HOW — ตรวจอย่างไร**

1. dupEligible (Final URL + ตัด noindex/canonical-away)
2. ตัด pagination/search/filter + localization (/th vs /en)
3. normalize NFC + zero-width + lowercase
4. group by title (finalUrl)

**DECISION RULE — เกณฑ์ตัดสิน**

- Final URL ต่าง + canonical ต่าง + ไม่ใช่ pagination/ภาษา + title ตรง (normalize) → fail/high  →  🔴 High

**DEPENDENCIES (ต้องผ่านก่อน):** `Final URL` · `Canonical` · `Language` · `Page Type`

**อ้างอิง:** [Google: Influencing title links](https://developers.google.com/search/docs/appearance/title-link) · [Moz: Title tag](https://moz.com/learn/seo/title-tag)


## Meta Description

### ไม่มี meta description

`On-Page` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 135-144)**

1. หา meta name description ใน HTML ดิบ — *Google ใช้ description ในผล SERP*
2. ถ้าไม่มี ให้หา description ที่ render ด้วย JS — *เช่นเดียวกับ title SPA อาจสร้าง*

เกณฑ์ตัดสิน:
- ไม่มีเลย → ผิด | มี render แต่ไม่มี raw → ควรแก้

**WHAT — ตรวจอะไร**

Meta description คือข้อความสรุป 1-2 บรรทัดสีเทาที่อยู่ใต้ชื่อหน้าในผลการค้นหา Google เป็นเหมือน "คำโปรย" ที่ชวนคนกด ถ้าไม่ใส่ Google จะดึงข้อความท่อนไหนก็ได้จากหน้ามาแสดงแทน

**WHY — ทำไมต้องตรวจ**

นี่คือพื้นที่โฆษณาฟรีบนหน้า Google ที่เราเขียนเองได้ ถ้าปล่อยว่าง Google อาจหยิบข้อความที่ไม่เกี่ยวหรือไม่น่าสนใจมาโชว์ เท่ากับเสียโอกาสปิดการขายตั้งแต่หน้าค้นหา

**อ้างอิง:** [Google: Control your snippets](https://developers.google.com/search/docs/appearance/snippet) · [Moz: Meta description](https://moz.com/learn/seo/meta-description)


### description สั้น/ยาว

`On-Page` · ความเชื่อมั่น 75% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 146-147)**

1. วัดความยาว meta description — *description แสดงในผลค้นหา*
2. ตรวจว่าอยู่ในช่วง 80-160 ตัวอักษร — *เกิน 160 ตัดใน SERP ต่ำกว่า 50 ดูแรง*

เกณฑ์ตัดสิน:
- > 170 หรือ < 50 → ควรแก้

**WHAT — ตรวจอะไร**

คำโปรยใต้ชื่อหน้า (Meta description) ที่ดีควรยาวราว 80–160 ตัวอักษร สั้นไปก็ไม่พอเล่ารายละเอียด ยาวไปก็โดน Google ตัดท้าย

**WHY — ทำไมต้องตรวจ**

ความยาวพอดีทำให้คำโปรยเล่าจุดขายได้ครบและไม่โดนตัด เพิ่มโอกาสที่คนอ่านแล้วอยากกดเข้ามา

**อ้างอิง:** [Google: Control your snippets](https://developers.google.com/search/docs/appearance/snippet) · [Moz: Meta description](https://moz.com/learn/seo/meta-description)


### description ซ้ำ

`On-Page` · ความเชื่อมั่น 75% · Tier 3
> logic+exclusions เท่า h1-duplicate + unit test แล้ว · รอ verify เว็บจริง

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 149-154)**

1. หา description ซ้ำๆ เหมือน title-duplicate — *หน้าต่างเรื่องควรมี description ต่างกัน*
2. ใช้ dupGroups helper เดียวกัน — *ความสม่ำเสมอ*

เกณฑ์ตัดสิน:
- พบซ้ำ → ควรแก้

**WHAT — ตรวจอะไร**

มีหลายหน้าใช้คำโปรย (Meta description) ข้อความเดียวกัน ทั้งที่เนื้อหาแต่ละหน้าต่างกัน

**WHY — ทำไมต้องตรวจ**

คำโปรยที่ซ้ำกันทำให้ทุกหน้าดูเหมือนกันไปหมดบน Google ลูกค้าแยกไม่ออกว่าหน้าไหนตอบโจทย์ตัวเอง และ Google มองว่าเนื้อหาไม่มีเอกลักษณ์

**HOW — ตรวจอย่างไร**

1. dupEligible (Final URL + ตัด noindex/canonical-away)
2. ตัด pagination/search/filter + localization (/th vs /en)
3. normalize NFC + zero-width + lowercase
4. group by description (finalUrl)

**DECISION RULE — เกณฑ์ตัดสิน**

- Final URL ต่าง + canonical ต่าง + ไม่ใช่ pagination/ภาษา + description ตรง (normalize) → warn/med  →  🟠 Medium

**DEPENDENCIES (ต้องผ่านก่อน):** `Final URL` · `Canonical` · `Language` · `Page Type`

**อ้างอิง:** [Google: Control your snippets](https://developers.google.com/search/docs/appearance/snippet) · [Moz: Duplicate content](https://moz.com/learn/seo/duplicate-content)


## H1

### ไม่มี <h1>  ✅ ยืนยันแล้ว

`On-Page` · ความเชื่อมั่น 95% · Tier 1
> verify: รวม Empty H1 = High

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 156-168)**

1. หา h1 ใน HTML ดิบ ที่มีข้อความจริง — *H1 บอก Google ว่าหน้านี้เกี่ยวกับเรื่องไหน*
2. ถ้าไม่มี ให้หา H1 ที่ render ด้วย JS — *จำแนก AI bot ไม่สามารถเห็น JS-generated H1*
3. H1 ว่างเปล่า = ไม่มี — *ไม่มีข้อมูล*

เกณฑ์ตัดสิน:
- ไม่มี raw และ render → ผิด | มี render แต่ไม่มี raw → ควรแก้

**WHAT — ตรวจอะไร**

H1 คือพาดหัวใหญ่สุดบนหน้าเว็บ (เหมือนหัวข้อข่าวตัวโตบนหน้าหนึ่งหนังสือพิมพ์) หน้านี้ไม่มีพาดหัวหลัก

**WHY — ทำไมต้องตรวจ**

พาดหัวหลักบอกทั้งคนและ Google ว่าหน้านี้เกี่ยวกับอะไร ถ้าไม่มี Google จับใจความหน้าได้ยากขึ้น และคนเข้ามาก็ไม่รู้ทันทีว่ามาถูกที่ไหม

**HOW — ตรวจอย่างไร**

1. หา <h1> ที่มีข้อความจริง (H1 ว่าง=ไม่มี)
2. ผ่าน pageEligible (Final URL + ตัด noindex/canonical)
3. ไม่มีใน raw แต่พบหลัง render = SPA

**DECISION RULE — เกณฑ์ตัดสิน**

- ไม่มี H1 ที่มีข้อความ ทั้ง raw+render → High  →  🔴 High
- พบเฉพาะหลัง render → Warn  →  🟡 Low/Warn

**DEPENDENCIES (ต้องผ่านก่อน):** `Final URL`

**อ้างอิง:** [HTML Standard: headings & outlines](https://html.spec.whatwg.org/multipage/sections.html#headings-and-outlines) · [Google: SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)


### <h1> หลายตัว  ✅ ยืนยันแล้ว

`On-Page` · ความเชื่อมั่น 75% · Tier 3
> verify: Info (เดิม fail)

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 178-189)**

1. นับจำนวน h1 ในหน้า — *HTML5 อนุญาต multi-H1*
2. เช็คว่ามี section/article คั่น — *Multi-H1 ใช้ได้เมื่ออยู่ใน article/section เอง*

เกณฑ์ตัดสิน:
- มากกว่า 1 แต่เป็นเนื้อหาถูกต้อง → แจ้งเพื่อทราบ

**WHAT — ตรวจอะไร**

หน้าเดียวมีพาดหัวใหญ่สุด (H1) หลายอัน เหมือนหน้าหนังสือพิมพ์ที่มีหัวข้อข่าวตัวโตเท่ากัน 5 ข่าวในหน้าเดียว ไม่รู้อันไหนคือข่าวเด่น

**WHY — ทำไมต้องตรวจ**

ทำให้ Google สับสนว่าประเด็นหลักของหน้าคืออะไร ลดความชัดเจนของหน้าในสายตา Google และอาจกระทบอันดับ

**HOW — ตรวจอย่างไร**

1. นับ H1 ต่อหน้า (pageEligible)

**DECISION RULE — เกณฑ์ตัดสิน**

- หลาย H1 = Info เสมอ — HTML5 อนุญาต Google ไม่ถือว่าผิด  →  ⚪ Info

**DEPENDENCIES (ต้องผ่านก่อน):** `Final URL`

**อ้างอิง:** [HTML Standard: headings & outlines](https://html.spec.whatwg.org/multipage/sections.html#headings-and-outlines) · [Ahrefs: The H1 tag](https://ahrefs.com/blog/h1-tag/)


### <h1> ซ้ำหน้าอื่น  ✅ ยืนยันแล้ว

`On-Page` · ความเชื่อมั่น 70% · Tier 3
> verify: + normalization + exclusions

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 671-677)**

1. หา H1 ซ้ำข้าม dupEligible — *เหมือน title-duplicate*
2. ใช้ dupGroups helper — *ความสม่ำเสมอ*

เกณฑ์ตัดสิน:
- H1 ซ้ำ → ควรแก้

**WHAT — ตรวจอะไร**

หลายหน้าใช้พาดหัวหลัก (H1) ข้อความเดียวกัน

**WHY — ทำไมต้องตรวจ**

ทำให้แต่ละหน้าดูไม่มีเอกลักษณ์ Google แยกประเด็นของแต่ละหน้าได้ยาก

**HOW — ตรวจอย่างไร**

1. pageEligible (Final URL + noindex/canonical)
2. ตัด pagination/search/filter + localization (/th vs /en)
3. normalize NFC + zero-width + lowercase
4. Group ตาม H1

**DECISION RULE — เกณฑ์ตัดสิน**

- Final URL ต่าง + canonical ต่าง + ไม่ใช่ pagination/ภาษา + H1 ตรง 100% → Medium  →  🟠 Medium

**DEPENDENCIES (ต้องผ่านก่อน):** `Final URL` · `Canonical` · `Language` · `Page Type`

**อ้างอิง:** [HTML Standard: headings & outlines](https://html.spec.whatwg.org/multipage/sections.html#headings-and-outlines) · [Ahrefs: The H1 tag](https://ahrefs.com/blog/h1-tag/)


### <h1> ถูกซ่อน  ✅ ยืนยันแล้ว

`On-Page` · ความเชื่อมั่น 80% · Tier 2
> verify: Medium

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 170-176)**

1. ตรวจว่า H1 มี CSS ซ่อน (display:none / visibility:hidden) — *Google ตัดสิน hidden text = manipulation*

เกณฑ์ตัดสิน:
- พบ H1 ซ่อน → ควรแก้

**WHAT — ตรวจอะไร**

หน้ามีพาดหัวหลัก (H1) แต่ถูกซ่อนไว้ไม่ให้คนเห็น (เช่น ตั้งค่าให้มองไม่เห็นด้วยตา)

**WHY — ทำไมต้องตรวจ**

Google อาจมองว่าเป็นการพยายามหลอกระบบ และพาดหัวที่ซ่อนไว้ก็ไม่ช่วยลูกค้าเข้าใจหน้าอยู่ดี

**HOW — ตรวจอย่างไร**

1. inline + computed style
2. display:none/visibility:hidden/opacity:0/font-size:0

**DECISION RULE — เกณฑ์ตัดสิน**

- H1 มีแต่มองไม่เห็น → Medium  →  🟠 Medium

**DEPENDENCIES (ต้องผ่านก่อน):** `Final URL`

**อ้างอิง:** [Google: SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) · [WCAG 2.1: Headings and Labels (2.4.6)](https://www.w3.org/WAI/WCAG21/Understanding/headings-and-labels.html)


## Headings

### ลำดับ heading ข้ามระดับ

`On-Page` · ความเชื่อมั่น 90% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 194-199)**

1. ตรวจลำดับ heading: H1→H2→H3 — *Screen reader และ AI อ่านโครงสร้างจากนี้*

เกณฑ์ตัดสิน:
- ข้ามระดับ → ควรแก้

**WHAT — ตรวจอะไร**

ลำดับหัวข้อในหน้าไม่เรียงตามขั้น เหมือนสารบัญที่กระโดดจากบทที่ 1 ไปหัวข้อย่อย 3.2 เลยโดยไม่มีบทที่ 2

**WHY — ทำไมต้องตรวจ**

โครงสร้างหัวข้อที่เป็นระเบียบช่วยให้ Google และโปรแกรมอ่านหน้าจอ (สำหรับผู้พิการ) เข้าใจลำดับเนื้อหา ทำให้หน้าอ่านง่ายและจัดอันดับดีขึ้น

**อ้างอิง:** [HTML Standard: headings & outlines](https://html.spec.whatwg.org/multipage/sections.html#headings-and-outlines) · [WCAG 2.1: Headings and Labels (2.4.6)](https://www.w3.org/WAI/WCAG21/Understanding/headings-and-labels.html)


### heading ว่างเปล่า

`On-Page` · ความเชื่อมั่น 90% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 680-681)**

1. ตรวจ h1-h6 tag ว่างเปล่า — *ไม่มีข้อมูล*

เกณฑ์ตัดสิน:
- มี heading ว่าง → ควรแก้

**WHAT — ตรวจอะไร**

มีช่องหัวข้อในหน้าที่ว่างเปล่า ไม่มีข้อความ เหมือนป้ายหัวข้อที่แขวนไว้แต่ไม่ได้เขียนอะไร

**WHY — ทำไมต้องตรวจ**

หัวข้อว่างทำให้โครงสร้างหน้าดูรกและสับสน ไม่ช่วยทั้งคนอ่านและ Google

**อ้างอิง:** [HTML Standard: headings & outlines](https://html.spec.whatwg.org/multipage/sections.html#headings-and-outlines) · [WCAG 2.1: Headings and Labels (2.4.6)](https://www.w3.org/WAI/WCAG21/Understanding/headings-and-labels.html)


## Content

### เนื้อหาบาง (thin)

`On-Page` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 201-202)**

1. นับจำนวนคำทั้งหมดในหน้า — *เนื้อหาหนา = ลุ้นลงชัดกว่า*
2. ตรวจว่าต่ำกว่า 150 คำ — *หน้า 100-150 คำถูกถือว่าบาง*

เกณฑ์ตัดสิน:
- < 150 คำ → ควรแก้

**WHAT — ตรวจอะไร**

หน้าที่มีเนื้อหาน้อยเกินไป (เนื้อความสั้นมาก เช่นไม่ถึง 150 คำ) เปรียบเหมือนโบรชัวร์ที่มีแต่หัวข้อ ไม่มีรายละเอียดให้อ่าน

**WHY — ทำไมต้องตรวจ**

Google ชอบหน้าที่ให้ข้อมูลครบและเป็นประโยชน์ หน้าที่เนื้อหาบางจะสู้คู่แข่งที่เขียนละเอียดกว่าไม่ได้ ทำให้ติดอันดับยาก และลูกค้าที่เข้ามาก็ได้ข้อมูลไม่พอจะตัดสินใจซื้อ

**อ้างอิง:** [Google: Creating helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)


### ปี copyright เก่า

`On-Page` · ความเชื่อมั่น 60% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 719-721)**

1. หาปี copyright ล่าสุด — *ปีเก่า = สัญญาณ เว็บร้าง*
2. หากปี < ปัจจุบัน - 1 = stale — *พอ 1 ปี OK*

เกณฑ์ตัดสิน:
- ปี < ปัจจุบัน - 1 → ควรแก้

**WHAT — ตรวจอะไร**

ปีลิขสิทธิ์ที่ท้ายเว็บ (เช่น © 2020) ยังเป็นปีเก่า ไม่อัปเดตเป็นปีปัจจุบัน

**WHY — ทำไมต้องตรวจ**

ลูกค้าที่เห็นปีเก่าๆ อาจคิดว่าเว็บนี้ถูกทิ้งร้างหรือบริษัทเลิกทำแล้ว ทำให้ขาดความน่าเชื่อถือ เป็นจุดเล็กๆ ที่ทำลายความมั่นใจในการซื้อ

**อ้างอิง:** [Google: Creating helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)


## HTML Document

### ไม่มี lang ใน <html>

`On-Page` · ความเชื่อมั่น 95% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 204-207)**

1. หา attribute lang ใน html — *Google และ accessibility ใช้ระบุภาษา*

เกณฑ์ตัดสิน:
- ไม่มี lang → ควรแก้

**WHAT — ตรวจอะไร**

หน้าเว็บไม่ได้ระบุว่าเป็นภาษาอะไร (ไทยหรืออังกฤษ) ในโค้ด เหมือนหนังสือที่ไม่บอกว่าเขียนภาษาอะไรบนปก

**WHY — ทำไมต้องตรวจ**

Google และเบราว์เซอร์ใช้ข้อมูลนี้แสดงผลและแปลภาษาให้ถูกต้อง ถ้าไม่ระบุ อาจแสดงผลเพี้ยนหรือถูกเสนอให้คนผิดกลุ่มภาษา

**อ้างอิง:** [HTML Standard: the lang attribute](https://html.spec.whatwg.org/multipage/dom.html#the-lang-and-xml:lang-attributes) · [WCAG 2.1: Language of Page (3.1.1)](https://www.w3.org/WAI/WCAG21/Understanding/language-of-page.html)


### ไม่มี viewport

`On-Page` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 209-212)**

1. หา meta name viewport — *Google ใช้ mobile-first indexing*

เกณฑ์ตัดสิน:
- ไม่มี → ผิดร้ายแรง

**WHAT — ตรวจอะไร**

หน้าไม่ได้ตั้งค่าให้ปรับขนาดตามจอมือถือ (viewport) ทำให้เปิดบนมือถือแล้วหน้าเล็กจิ๋วต้องซูมเอง

**WHY — ทำไมต้องตรวจ**

ลูกค้าส่วนใหญ่เข้าเว็บผ่านมือถือ ถ้าหน้าไม่ปรับให้พอดีจอจะใช้งานยากมากและกดออกเร็ว ทั้ง Google ก็ลงโทษเว็บที่ไม่รองรับมือถือ

**อ้างอิง:** [Google: Mobile-first indexing](https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing) · [MDN: Viewport meta tag](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport)


### viewport ห้ามซูม

`On-Page` · ความเชื่อมั่น 90% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 214-215)**

1. ตรวจค่า viewport มี maximum-scale=1 หรือ user-scalable=no — *ค่าเหล่านี้ห้ามผู้ใช้ซูม = เสีย accessibility*

เกณฑ์ตัดสิน:
- มี restriction → ควรแก้

**WHAT — ตรวจอะไร**

หน้าตั้งค่าห้ามผู้ใช้ซูมเข้า-ออกบนมือถือ

**WHY — ทำไมต้องตรวจ**

ผู้สูงอายุหรือคนสายตาไม่ดีจะซูมอ่านไม่ได้ เป็นอุปสรรคการเข้าถึงและทำให้เสียลูกค้ากลุ่มนี้

**อ้างอิง:** [WCAG 2.1: Resize Text (1.4.4)](https://www.w3.org/WAI/WCAG21/Understanding/resize-text.html) · [MDN: Viewport meta tag](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport)


### ไม่มี favicon

`On-Page` · ความเชื่อมั่น 75% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 217)**

1. หา link rel="icon" ที่ homepage — *Favicon แสดงใน SERP มือถือ*

เกณฑ์ตัดสิน:
- ไม่มี → ควรแก้

**WHAT — ตรวจอะไร**

Favicon คือไอคอนเล็กๆ ของเว็บที่โชว์บนแท็บเบราว์เซอร์และตอนบุ๊กมาร์ก เว็บนี้ยังไม่มี

**WHY — ทำไมต้องตรวจ**

เป็นรายละเอียดเล็กๆ ที่ทำให้แบรนด์ดูเป็นมืออาชีพและจำง่าย เวลาลูกค้าเปิดหลายแท็บจะหาเว็บเราเจอง่ายขึ้น

**อ้างอิง:** [Google: Define a favicon](https://developers.google.com/search/docs/appearance/favicon-in-search)


### favicon ไฟล์ผิด

`On-Page` · ความเชื่อมั่น 70% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 775)**

1. ตรวจ /favicon.ico ตอบ status — *crawler บางตัว request favicon*

เกณฑ์ตัดสิน:
- >= 400 → ควรแก้

**WHAT — ตรวจอะไร**

มีการอ้างถึงไอคอนเว็บ (favicon) แต่ไฟล์จริงหาไม่เจอหรือเปิดไม่ได้

**WHY — ทำไมต้องตรวจ**

ทำให้แท็บเบราว์เซอร์ขึ้นไอคอนว่างหรือแตก ดูไม่เรียบร้อย ควรอัปโหลดไฟล์ให้ถูกต้อง

**อ้างอิง:** [Google: Define a favicon](https://developers.google.com/search/docs/appearance/favicon-in-search)


### ไม่มี doctype

`On-Page` · ความเชื่อมั่น 100% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 653-654)**

1. ตรวจ DOCTYPE html บรรทัดแรก — *ไม่มี = quirks mode ผล render เพี้ยน*

เกณฑ์ตัดสิน:
- ไม่มี doctype → ควรแก้

**WHAT — ตรวจอะไร**

หน้าเว็บไม่ได้ประกาศชนิดเอกสารมาตรฐาน (DOCTYPE) ที่บรรทัดแรกของโค้ด

**WHY — ทำไมต้องตรวจ**

อาจทำให้เบราว์เซอร์แสดงผลในโหมดเก่าที่เพี้ยน หน้าตาเว็บอาจผิดเพี้ยนในบางเครื่อง

**อ้างอิง:** [HTML Standard: the DOCTYPE](https://html.spec.whatwg.org/multipage/syntax.html#the-doctype)


### charset ไม่ใช่ UTF-8

`On-Page` · ความเชื่อมั่น 95% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 642-649)**

1. ตรวจ charset ที่ detect — *Google แนะนำ UTF-8*

เกณฑ์ตัดสิน:
- ไม่ใช่ UTF-8 → ควรแก้

**WHAT — ตรวจอะไร**

หน้าไม่ได้ตั้งค่าระบบตัวอักษรเป็นมาตรฐานสากล (UTF-8) ทำให้ภาษาไทยเสี่ยงแสดงเป็นตัวอักษรเพี้ยนมั่วๆ

**WHY — ทำไมต้องตรวจ**

ถ้าภาษาไทยกลายเป็นตัวประหลาดอ่านไม่ออก ลูกค้าจะกดออกทันทีและ Google ก็อ่านเนื้อหาเราไม่รู้เรื่อง

**อ้างอิง:** [WHATWG: Encoding Standard](https://encoding.spec.whatwg.org/) · [HTML Standard: charset declaration](https://html.spec.whatwg.org/multipage/semantics.html#charset)


## Markup/Meta

### meta keywords (ล้าสมัย)

`On-Page` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 724-725)**

1. หา meta name keywords — *Google เลิกใช้ตั้งแต่ 2009*

เกณฑ์ตัดสิน:
- มี meta keywords → แจ้งเพื่อทราบ

**WHAT — ตรวจอะไร**

แท็ก meta keywords คือการใส่คีย์เวิร์ดซ่อนไว้ในโค้ด เป็นเทคนิคยุคเก่าที่ Google เลิกใช้ไปนานแล้ว

**WHY — ทำไมต้องตรวจ**

ไม่ได้ช่วยอันดับเลย แถมบางทีไปบอกใบ้คู่แข่งว่าเราเล็งคำไหนอยู่ ควรเอาออกเพื่อความสะอาดของหน้า

**อ้างอิง:** [Google: We don't use the keywords meta tag](https://developers.google.com/search/blog/2009/09/google-does-not-use-keywords-meta-tag)


### แท็กเลิกใช้แล้ว

`On-Page` · ความเชื่อมั่น 90% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 657-658)**

1. ตรวจ font, center, marquee — *สัญญาณเว็บเก่า*

เกณฑ์ตัดสิน:
- พบ deprecated tag → ควรแก้

**WHAT — ตรวจอะไร**

หน้าเว็บยังใช้โค้ดรูปแบบเก่าที่เลิกใช้แล้วตามมาตรฐานปัจจุบัน

**WHY — ทำไมต้องตรวจ**

โค้ดเก่าอาจแสดงผลเพี้ยนในเบราว์เซอร์รุ่นใหม่และดูแลยาก ควรปรับให้เป็นมาตรฐานปัจจุบัน

**อ้างอิง:** [HTML Standard: obsolete features](https://html.spec.whatwg.org/multipage/obsolete.html)


## URL

### URL ไม่สะอาด

`On-Page` · ความเชื่อมั่น 80% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 686-689)**

1. ตรวจ URL path มี CamelCase หรือยาวเกิน 115 ตัว — *ไม่เป็นมิตร SEO*

เกณฑ์ตัดสิน:
- มี CapitalLetter หรือ > 115 → ควรแก้

**WHAT — ตรวจอะไร**

ที่อยู่หน้าเว็บ (URL) บางหน้าดูรกหรืออ่านไม่รู้เรื่อง เช่นมีตัวอักษรแปลกๆ พารามิเตอร์ยาวเหยียด แทนที่จะเป็นคำที่สื่อความหมาย

**WHY — ทำไมต้องตรวจ**

ที่อยู่ที่สะอาดและอ่านเข้าใจ (เช่น /สินค้า/รองเท้าวิ่ง) ทั้งช่วยอันดับและทำให้ลูกค้ามั่นใจกดลิงก์มากกว่า ที่อยู่ที่ดูมั่วๆ ทำให้คนลังเลที่จะคลิก

**อ้างอิง:** [Google: URL structure best practices](https://developers.google.com/search/docs/crawling-indexing/url-structure) · [RFC 3986: URI Generic Syntax](https://datatracker.ietf.org/doc/html/rfc3986)


# Indexing

## Canonical

### ไม่มี canonical

`Indexing` · ความเชื่อมั่น 100% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 345-367)**

1. หา link rel canonical — *บอก Google ว่าหน้านี้ canonical ของตัวเอง*
2. ถ้าไม่มี canonical ตรวจว่ามี query param หรือ title ซ้ำ — *สัญญาณ duplicate = ต้องแก้*
3. ถ้าไม่มี risk = ต่ำ (Google self-canonical) — *Google ให้ canonical โดยอัตโนมัติ*

เกณฑ์ตัดสิน:
- ไม่มี + มี risk → ผิดร้ายแรง | ไม่มี + ไม่มี risk → ควรแก้

**WHAT — ตรวจอะไร**

Canonical tag คือป้ายเล็กๆ ในโค้ดที่บอก Google ว่า "หน้าตัวจริงคือหน้านี้นะ" เพราะเว็บเดียวกันมักเข้าถึงได้หลาย URL (เช่น มี / , /home , ลิงก์ที่ต่อท้ายด้วย ?param ต่างๆ) ทั้งที่จริงเป็นหน้าเดียวกัน ถ้าไม่มีป้ายนี้ Google จะนับเป็นหลายหน้าแยกกัน

**WHY — ทำไมต้องตรวจ**

เมื่อ Google เห็นหน้าเดียวกันในหลายที่อยู่โดยไม่มีป้ายชี้ตัวจริง มันจะมองว่าเรา "ก๊อปเนื้อหาตัวเอง" คะแนนของหน้าถูกหารกระจาย ทำให้อันดับตก และอาจเลือกแสดง URL ที่ดูไม่สวยให้ลูกค้าเห็น

**HOW — ตรวจอย่างไร**

1. Final URL
2. อ่าน canonical
3. ดูเสี่ยง duplicate (query param/title ซ้ำ)

**DECISION RULE — เกณฑ์ตัดสิน**

- ไม่มี + เสี่ยง dup จริง → fail/high  →  🔴 High
- เว็บสะอาด → warn/low  →  🟡 Low/Warn

**DEPENDENCIES (ต้องผ่านก่อน):** `Final URL`

**อ้างอิง:** [Google: Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) · [RFC 6596: The Canonical Link Relation](https://datatracker.ietf.org/doc/html/rfc6596)


### canonical ซ้ำ

`Indexing` · ความเชื่อมั่น 90% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 665-666)**

1. นับจำนวน link rel canonical — *ต้องเป็น 1 เดียว*

เกณฑ์ตัดสิน:
- > 1 canonical → ผิดร้ายแรง

**WHAT — ตรวจอะไร**

หน้าเดียวกันใส่ป้ายชี้หน้าตัวจริง (Canonical) ไว้หลายอันและขัดแย้งกัน เหมือนป้ายบอกทางสองป้ายชี้คนละทาง

**WHY — ทำไมต้องตรวจ**

Google สับสนว่าจะเชื่อป้ายไหน สุดท้ายอาจเลือกหน้าผิดมาแสดงหรือไม่เก็บหน้าเราเข้าระบบเลย

**อ้างอิง:** [Google: Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)


### canonical relative

`Indexing` · ความเชื่อมั่น 80% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 667-668)**

1. ตรวจ canonical value เป็น relative หรือ absolute — *ต้อง absolute เต็ม*

เกณฑ์ตัดสิน:
- relative URL → ควรแก้

**WHAT — ตรวจอะไร**

ป้ายชี้หน้าตัวจริง (Canonical) เขียนที่อยู่แบบไม่เต็ม (ไม่ได้ขึ้นต้นด้วย https://...) ซึ่งเสี่ยงตีความผิด

**WHY — ทำไมต้องตรวจ**

ที่อยู่ที่ไม่สมบูรณ์อาจทำให้ Google ชี้ไปผิดหน้า ส่งผลให้หน้าที่ถูกต้องไม่ถูกจัดอันดับ

**อ้างอิง:** [Google: Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) · [RFC 6596: The Canonical Link Relation](https://datatracker.ietf.org/doc/html/rfc6596)


## Robots

### ไม่มี robots.txt

`Indexing` · ความเชื่อมั่น 100% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 235-270)**

1. หา robots.txt ที่ URL root — *ช่วยบอก bot ว่าไหนต้อง crawl*

เกณฑ์ตัดสิน:
- ไม่มี robots.txt → ควรแก้

**WHAT — ตรวจอะไร**

ไฟล์ robots.txt คือคู่มือต้อนรับสำหรับ Google ที่วางไว้หน้าเว็บ บอกว่าหน้าไหนเข้าได้ หน้าไหนไม่ต้องเข้า เว็บนี้ยังไม่มีไฟล์นี้

**WHY — ทำไมต้องตรวจ**

ไม่ใช่เรื่องร้ายแรงมาก แต่การมีไฟล์นี้ช่วยให้ Google เก็บข้อมูลเว็บได้อย่างมีระเบียบและเร็วขึ้น

**อ้างอิง:** [RFC 9309: Robots Exclusion Protocol](https://datatracker.ietf.org/doc/html/rfc9309) · [Google: Intro to robots.txt](https://developers.google.com/search/docs/crawling-indexing/robots/intro)


### robots ไม่ชี้ sitemap

`Indexing` · ความเชื่อมั่น 80% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 268-270)**

1. ตรวจว่า robots.txt มี Sitemap: URL — *ช่วยให้ bot หา URL ครบ*

เกณฑ์ตัดสิน:
- ไม่มี → ควรแก้

**WHAT — ตรวจอะไร**

ในไฟล์คู่มือต้อนรับ (robots.txt) ควรมีบรรทัดบอกที่อยู่ของ "แผนผังเว็บ" (sitemap) ให้ Google แต่ตอนนี้ยังไม่ได้ใส่

**WHY — ทำไมต้องตรวจ**

การชี้ทางไปแผนผังเว็บช่วยให้ Google เจอทุกหน้าได้ครบและเร็วขึ้น โดยเฉพาะหน้าใหม่ๆ

**อ้างอิง:** [sitemaps.org: protocol](https://www.sitemaps.org/protocol.html) · [Google: Sitemaps overview](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview)


### robots บล็อกทั้งเว็บ

`Indexing` · ความเชื่อมั่น 95% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 240-242)**

1. ตรวจ robots.txt มี Disallow: / แบบเหมารวม — *ถ้ามี bot จะไม่ crawl อะไรเลย*

เกณฑ์ตัดสิน:
- มี Disallow: / → ผิดร้ายแรง

**WHAT — ตรวจอะไร**

ไฟล์คู่มือต้อนรับ Google (robots.txt) ตั้งค่าเป็น "ห้ามเข้าทุกหน้า" — เท่ากับปิดประตูไม่ให้ Google เข้ามาดูเว็บเลย

**WHY — ทำไมต้องตรวจ**

นี่คือปัญหาร้ายแรงที่สุดอย่างหนึ่ง — ถ้าปิดประตูทั้งหมด เว็บจะค่อยๆ หายไปจาก Google ทั้งเว็บ ไม่มีใครค้นเจอเลย

**อ้างอิง:** [RFC 9309: Robots Exclusion Protocol](https://datatracker.ietf.org/doc/html/rfc9309) · [Google: Intro to robots.txt](https://developers.google.com/search/docs/crawling-indexing/robots/intro)


### robots บล็อกบางส่วน

`Indexing` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 244-267)**

1. ตรวจว่า robots.txt บล็อก Googlebot หรือ AI crawler จาก /blog, /shop, /service — *หน้าเนื้อหาสำคัญต้องให้ bot เข้าได้*
2. หากบล็อก Googlebot จริง = ร้ายแรง หากบล็อกแค่ AI = ปานกลาง — *Googlebot = traffic หาก AI = GEO*

เกณฑ์ตัดสิน:
- บล็อก Googlebot → ผิดร้ายแรง | บล็อก AI → ควรแก้

**WHAT — ตรวจอะไร**

ไฟล์คู่มือต้อนรับ Google (robots.txt) สั่งห้าม Google เข้าบางส่วนของเว็บ

**WHY — ทำไมต้องตรวจ**

ถ้าส่วนที่ถูกห้ามคือหน้าสำคัญ (เช่น หน้าสินค้า/บริการ) หน้าเหล่านั้นจะไม่ขึ้น Google เลย ควรตรวจว่าห้ามถูกที่หรือเปล่า

**อ้างอิง:** [RFC 9309: Robots Exclusion Protocol](https://datatracker.ietf.org/doc/html/rfc9309) · [Google: Intro to robots.txt](https://developers.google.com/search/docs/crawling-indexing/robots/intro)


### meta robots ผิด

`Indexing` · ความเชื่อมั่น 90% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 321-343)**

1. ตรวจค่า robots meta ใช้ directive ถูกต้องหรือไม่ — *directive ไม่มีจริง Google อาจ ignore*
2. เช่น noindex, nodiy → nodiy ไม่มีจริง — *directive invalid*

เกณฑ์ตัดสิน:
- มี invalid/deprecated directive → ควรแก้

**WHAT — ตรวจอะไร**

คำสั่งควบคุม Google ที่ฝังในหน้าเขียนผิดรูปแบบหรือสะกดผิด (เช่นพิมพ์ผิดเป็นคำที่ Google ไม่รู้จัก)

**WHY — ทำไมต้องตรวจ**

คำสั่งที่เขียนผิดอาจไม่ทำงาน หรือทำงานผิดจากที่ตั้งใจ เสี่ยงทำให้หน้าหลุดจากระบบ Google โดยไม่ตั้งใจ

**อ้างอิง:** [Google: robots meta tag](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)


### ติด noindex

`Indexing` · ความเชื่อมั่น 95% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 285-319)**

1. หา meta name robots content noindex หรือ X-Robots-Tag header — *บอก Google ห้ามจัดทำดัชนีหน้านี้*
2. จำแนก: utility (login/cart/search) vs เนื้อหา (about/product) — *ตั้งใจบล็อก utility ปกติ แต่เนื้อหาติด noindex = อาจพลาด*
3. ใช้ URL path เป็นเหตุผล — *เดาจาก path pattern*

เกณฑ์ตัดสิน:
- หน้าเนื้อหามี noindex → ควรแก้

ข้อสังเกต: heuristic เดา path pattern อาจผิด.

**WHAT — ตรวจอะไร**

หน้านี้ติดคำสั่ง "ห้าม Google เก็บเข้าระบบ" (noindex) อยู่ เท่ากับสั่ง Google ว่า "อย่าเอาหน้านี้ไปแสดงในผลค้นหา"

**WHY — ทำไมต้องตรวจ**

ถ้าเป็นหน้าสำคัญที่อยากให้คนค้นเจอ การติดคำสั่งนี้คือการทำให้หน้าหายไปจาก Google ทั้งหน้า เสียทราฟฟิกทั้งหมดของหน้านั้น

**อ้างอิง:** [Google: Block indexing (noindex)](https://developers.google.com/search/docs/crawling-indexing/block-indexing) · [Google: robots meta tag](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)


## Sitemap

### ไม่มี sitemap

`Indexing` · ความเชื่อมั่น 95% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 273-275)**

1. ตรวจว่ามี sitemap.xml หรือ URL ที่เป็น sitemap — *Google ใช้ sitemap เพื่อหา URL ครบ*

เกณฑ์ตัดสิน:
- ไม่มี sitemap → ผิดร้ายแรง

**WHAT — ตรวจอะไร**

XML Sitemap คือ "แผนผังเว็บ" หรือสารบัญที่ลิสต์ทุกหน้าของเว็บไว้ให้ Google เปิดอ่านทีเดียวครบ เว็บนี้ยังไม่มีไฟล์นี้

**WHY — ทำไมต้องตรวจ**

ถ้าไม่มีสารบัญ Google ต้องไล่คลำหาหน้าเองทีละลิงก์ ทำให้หน้าใหม่ๆ ถูกเก็บเข้าระบบช้ามาก กว่าจะขึ้น Google อาจใช้เวลาหลายสัปดาห์

**อ้างอิง:** [sitemaps.org: protocol](https://www.sitemaps.org/protocol.html) · [Google: Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)


### sitemap ไม่ครอบคลุม

`Indexing` · ความเชื่อมั่น 80% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 277-283)**

1. เทียบ URL ใน sitemap กับหน้าที่ crawl — *ต้องให้ Google รู้ทุกหน้า*
2. ถ้าหน้า crawl > 30% ไม่อยู่ใน sitemap = ปัญหา — *sitemap ครอบคลุมไม่ได้*

เกณฑ์ตัดสิน:
- ครอบคลุม < 70% → ควรแก้

**WHAT — ตรวจอะไร**

แผนผังเว็บ (sitemap) มีอยู่ แต่ลิสต์หน้าไม่ครบ — บางหน้าที่มีจริงไม่ได้ถูกใส่ในสารบัญ

**WHY — ทำไมต้องตรวจ**

หน้าที่ไม่อยู่ในสารบัญมีโอกาสถูก Google มองข้าม ทำให้หน้านั้นไม่ขึ้นผลค้นหา

**อ้างอิง:** [Google: Sitemaps overview](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview)


### sitemap ไม่มี lastmod

`Indexing` · ความเชื่อมั่น 80% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 778-779)**

1. ตรวจ sitemap.xml มี lastmod — *Google ใช้ decide ว่าจะ crawl หน้าไหน*

เกณฑ์ตัดสิน:
- sitemap มี URL แต่ไม่มี lastmod → ควรแก้

**WHAT — ตรวจอะไร**

แผนผังเว็บ (sitemap) ไม่ได้ระบุวันที่อัปเดตล่าสุดของแต่ละหน้า

**WHY — ทำไมต้องตรวจ**

การบอกวันที่อัปเดตช่วยให้ Google รู้ว่าหน้าไหนมีของใหม่ ควรกลับมาดูซ้ำ ทำให้เนื้อหาใหม่ขึ้น Google เร็วขึ้น

**อ้างอิง:** [sitemaps.org: protocol](https://www.sitemaps.org/protocol.html)


## Hreflang

### hreflang ผิด/ไม่มี

`Indexing` · ความเชื่อมั่น 90% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 388-409)**

1. ตรวจ link rel alternate hreflang — *บอก Google ว่าหน้าคู่ภาษา*
2. หากพบ hreflang ตรวจ x-default | หากไม่พบแต่หลายภาษา = ควรใส่ — *x-default บอก ถ้า user ไม่แน่ของภาษา ให้หน้านี้*

เกณฑ์ตัดสิน:
- มี hreflang ไม่มี x-default → ควรแก้ | หลายภาษาไม่มี hreflang → ควรแก้

**WHAT — ตรวจอะไร**

hreflang คือป้ายบอก Google ว่าหน้าไหนเป็นเวอร์ชันภาษาไทย หน้าไหนเป็นภาษาอังกฤษ สำหรับเว็บที่มีหลายภาษา

**WHY — ทำไมต้องตรวจ**

ถ้าตั้งค่าไม่ถูก Google อาจเอาหน้าภาษาอังกฤษไปแสดงให้คนไทย หรือสลับกัน ทำให้ลูกค้าเจอหน้าผิดภาษาแล้วกดออก

**อ้างอิง:** [Google: Localized versions (hreflang)](https://developers.google.com/search/docs/specialty/international/localized-versions)


## Redirects

### redirect ซ้อน

`Indexing` · ความเชื่อมั่น 95% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 369-370)**

1. ตรวจ redirect chain: A→B→C — *Hop เยอะ = เสีย crawl budget*

เกณฑ์ตัดสิน:
- Chain > 1 hop → ควรแก้

**WHAT — ตรวจอะไร**

การเด้งหน้าต่อกันหลายทอด เช่น หน้า A เด้งไป B, B เด้งไป C กว่าจะถึงปลายทางจริง เหมือนโทรหาเบอร์หนึ่งแล้วถูกโอนสายต่อ 3-4 ครั้ง

**WHY — ทำไมต้องตรวจ**

ทุกการเด้งทำให้หน้าโหลดช้าลงและคะแนนรั่วไหลทีละนิด ลูกค้าบนมือถือที่เน็ตช้าอาจกดออกก่อนหน้าจะโหลดเสร็จ

**อ้างอิง:** [Google: Redirects and Google Search](https://developers.google.com/search/docs/crawling-indexing/301-redirects) · [RFC 9110: Redirection 3xx](https://datatracker.ietf.org/doc/html/rfc9110#section-15.4)


### trailing slash ไม่นิ่ง

`Indexing` · ความเชื่อมั่น 80% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 691-701)**

1. ตรวจ URL คู่ต่างแค่ trailing slash ตอบ 200 ทั้งคู่ — *duplicate content*

เกณฑ์ตัดสิน:
- พบคู่ → ควรแก้

**WHAT — ตรวจอะไร**

ที่อยู่หน้าเว็บมีทั้งแบบมีและไม่มีเครื่องหมาย / ต่อท้าย ชี้ไปหน้าเดียวกัน เช่น /about กับ /about/

**WHY — ทำไมต้องตรวจ**

Google อาจนับเป็นสองหน้าซ้ำกัน ควรเลือกใช้แบบเดียวให้สม่ำเสมอเพื่อไม่ให้คะแนนกระจาย

**อ้างอิง:** [Google: URL structure best practices](https://developers.google.com/search/docs/crawling-indexing/url-structure) · [Google: Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)


### www/non-www ซ้ำ

`Indexing` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 750-772)**

1. ตรวจ www/non-www, http/https variant ตอบ 200 หรือ redirect — *ต้อง consolidate ไป 1 origin*
2. หลาย variant 200 = ต้อง 301 หรือ canonical — *ไม่งั้น Google เสียสัญญาณ*
3. variant ไม่ได้เลย = ผู้ใช้เข้าไม่ได้ — *ต้องแก้*

เกณฑ์ตัดสิน:
- หลาย variant 200 ไม่มี 301 → ผิดร้ายแรง | ขาด variant → ควรแก้

**WHAT — ตรวจอะไร**

เว็บเปิดได้หลายแบบที่อยู่ เช่นมีทั้งแบบมี www และไม่มี www หรือทั้ง http และ https ทั้งที่ควรเหลือแบบเดียว

**WHY — ทำไมต้องตรวจ**

Google อาจมองว่าเป็นหลายเว็บแยกกันที่เนื้อหาซ้ำ ทำให้คะแนนกระจาย ควรรวมให้เหลือที่อยู่หลักแบบเดียว

**อ้างอิง:** [Google: Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)


### meta refresh redirect

`Indexing` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 661-662)**

1. ตรวจ meta http-equiv refresh redirect — *Google ไม่แนะนำ ใช้ 301*

เกณฑ์ตัดสิน:
- มี meta refresh → ควรแก้

**WHAT — ตรวจอะไร**

หน้าใช้วิธีเด้งไปหน้าอื่นแบบเก่า (meta refresh) เช่นเปิดมาแล้วนับถอยหลังเด้งไปอีกหน้า

**WHY — ทำไมต้องตรวจ**

เป็นวิธีล้าสมัยที่ Google ไม่แนะนำ ทำให้การส่งต่อคะแนนระหว่างหน้าไม่สมบูรณ์ ควรเปลี่ยนเป็นการเด้งหน้าแบบมาตรฐาน

**อ้างอิง:** [Google: Redirects and Google Search](https://developers.google.com/search/docs/crawling-indexing/301-redirects) · [HTML Standard: meta http-equiv refresh](https://html.spec.whatwg.org/multipage/semantics.html#attr-meta-http-equiv-refresh)


## Crawlability

### ถูกบล็อก crawl

`Indexing` · ความเชื่อมั่น 90% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 376-378)**

1. ตรวจ HTTP status 429/403/5xx ที่ crawl — *บ่งชี้บล็อกชั่วคราว/rate-limit*

เกณฑ์ตัดสิน:
- พบ error ชั่วคราว → แจ้งเพื่อทราบ

**อ้างอิง:** [Google: Overview of Google crawlers](https://developers.google.com/crawling/docs/crawlers-fetchers/overview-google-crawlers) · [Google: Intro to robots.txt](https://developers.google.com/search/docs/crawling-indexing/robots/intro)


### soft 404

`Indexing` · ความเชื่อมั่น 90% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 380-381)**

1. หา URL ที่ไม่มีจริง ตอบ status เท่าไร — *ต้อง 404 ไม่ใช่ 200*

เกณฑ์ตัดสิน:
- ตอบ != 404 (soft 404) → ควรแก้

**WHAT — ตรวจอะไร**

หน้าที่ไม่มีอยู่จริง ควรตอบกลับว่า "ไม่พบหน้า (404)" แต่กลับตอบว่า "ปกติดี (200)" หรือเด้งไปหน้าแรกแทน เหมือนร้านที่ปิดไปแล้วแต่ป้ายยังเขียนว่าเปิด

**WHY — ทำไมต้องตรวจ**

Google จะเก็บหน้าขยะเหล่านี้เข้าระบบ ทำให้คุณภาพเว็บโดยรวมในสายตา Google ลดลง และเปลืองโควต้าที่ Google ใช้เก็บหน้าจริงที่สำคัญ

**อ้างอิง:** [Google: HTTP status & network errors](https://developers.google.com/crawling/docs/troubleshooting/http-status-codes)


### หน้า error

`Indexing` · ความเชื่อมั่น 95% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 372-378)**

1. ตรวจ HTTP status บน URL ที่ crawl — *status บอกสถานะ URL*
2. 404/410 = หาย (ถาวร) | 429/403/5xx = ชั่วคราว — *ต้องแยก ก่ายจริง vs ข้อผิดพลาดชั่วคราว*

เกณฑ์ตัดสิน:
- 404/410 → ผิดร้ายแรง | 429/403/5xx → แจ้งเพื่อทราบ

**WHAT — ตรวจอะไร**

พบหน้าที่เปิดแล้วเจอข้อผิดพลาด (error) ตอบกลับเป็นรหัสฝั่งเซิร์ฟเวอร์ผิดพลาด

**WHY — ทำไมต้องตรวจ**

หน้าที่พังทำให้ทั้งลูกค้าและ Google เจอทางตัน เสียประสบการณ์และเสียโอกาสขาย ควรรีบแก้ให้กลับมาใช้งานได้

**อ้างอิง:** [RFC 9110: HTTP Semantics](https://datatracker.ietf.org/doc/html/rfc9110) · [Google: HTTP status & network errors](https://developers.google.com/crawling/docs/troubleshooting/http-status-codes)


### เข้าหน้าเว็บไม่ได้

`Indexing` · ความเชื่อมั่น 100% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 95-99)**

1. พยายาม crawl หน้า HTML จากเว็บ — *เป็นขั้นแรก ต้องเข้าไปในเว็บได้*
2. ตรวจสอบว่าได้หน้าไหนที่ตอบ HTTP 200 — *หน้า 200 คือหน้าที่เปิดมาได้ปกติ*

เกณฑ์ตัดสิน:
- เมื่อหน้า 200 เป็นศูนย์ → ผิดร้ายแรง

**อ้างอิง:** [RFC 9110: HTTP Semantics](https://datatracker.ietf.org/doc/html/rfc9110) · [Google: HTTP status & network errors](https://developers.google.com/crawling/docs/troubleshooting/http-status-codes)


## Duplicate Content

### หน้าซ้ำใกล้เคียง

`Indexing` · ความเชื่อมั่น 80% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 728-738)**

1. เปรียบหน้า 2 หน้า ใช้ Jaccard similarity — *หา content เกือบซ้ำกัน*
2. ถ้า > 85% เหมือน = near-duplicate — *threshold*

เกณฑ์ตัดสิน:
- เปอร์เซ็นต์ > 85% → ควรแก้

ข้อสังเกต: ตรวจแค่ 60 หน้า ไม่ครบทั้งเว็บ.

**WHAT — ตรวจอะไร**

มีหลายหน้าที่เนื้อหาคล้ายกันมากจนเกือบเหมือนกัน เหมือนถ่ายเอกสารหน้าเดิมแล้วเปลี่ยนแค่หัวข้อนิดหน่อย

**WHY — ทำไมต้องตรวจ**

Google ไม่ชอบเนื้อหาซ้ำ และจะเลือกแสดงแค่หน้าเดียว หน้าที่เหลือถูกมองข้าม ทำให้เราเสียพื้นที่บนหน้าค้นหาไปเปล่าๆ

**DEPENDENCIES (ต้องผ่านก่อน):** `Final URL` · `Canonical`

**อ้างอิง:** [Google: Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) · [Moz: Duplicate content](https://moz.com/learn/seo/duplicate-content)


## Internal Links

### ลิงก์เสีย (hard)

`Indexing` · ความเชื่อมั่น 90% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 476-480)**

1. ตรวจ internal link (href) ชี้ไปที่ URL ไหน — *ลิงก์เสีย = ไม่มีหน้า landing*
2. 404/410 = เสียจริง | 429/403/5xx = ชั่วคราว — *ต้องแยก permanent vs temporary*

เกณฑ์ตัดสิน:
- 404/410 → ผิดร้ายแรง

**WHAT — ตรวจอะไร**

ลิงก์ภายในเว็บที่กดแล้วพาไปหน้าที่พังหรือไม่มีอยู่จริง (เจอหน้า error) เหมือนป้ายบอกทางในห้างที่ชี้ไปร้านที่ปิดไปแล้ว

**WHY — ทำไมต้องตรวจ**

ลูกค้าที่กดแล้วเจอหน้าพังจะรู้สึกหงุดหงิดและอาจเลิกเที่ยวชมเว็บทันที ทั้งยังทำให้ Google มองว่าเว็บดูแลไม่ดี กระทบความน่าเชื่อถือโดยรวม

**อ้างอิง:** [RFC 9110: 404 Not Found](https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.5) · [Google: Make your links crawlable](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)


### ลิงก์เสีย (soft)

`Indexing` · ความเชื่อมั่น 80% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 481)**

1. ตรวจลิงก์ที่ตอบ 429/403/5xx — *อาจชั่วคราว*

เกณฑ์ตัดสิน:
- พบ soft error → แจ้งเพื่อทราบ

**อ้างอิง:** [Google: HTTP status & network errors](https://developers.google.com/crawling/docs/troubleshooting/http-status-codes)


### หน้ากำพร้า

`Indexing` · ความเชื่อมั่น 70% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 741-747)**

1. หาหน้าที่ไม่มี internal link ชี้เข้า — *เข้าได้จาก sitemap เท่านั้น = ไม่ได้ link equity*
2. crawled page มี internal link ไป = มี inlink — *กลับกัน*

เกณฑ์ตัดสิน:
- พบ orphan → ควรแก้

**WHAT — ตรวจอะไร**

หน้ากำพร้า คือหน้าที่มีอยู่จริงแต่ไม่มีลิงก์จากหน้าอื่นในเว็บชี้มาหาเลย เหมือนห้องลับที่ไม่มีประตูเข้า

**WHY — ทำไมต้องตรวจ**

ถ้าไม่มีลิงก์ชี้มา ทั้งลูกค้าและ Google แทบจะหาหน้านี้ไม่เจอ เท่ากับทำหน้าไว้แต่ไม่มีใครได้ใช้

**อ้างอิง:** [Ahrefs: Orphan pages](https://ahrefs.com/blog/orphan-pages/) · [Google: Make your links crawlable](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)


### internal link น้อย

`Indexing` · ความเชื่อมั่น 70% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 492-493)**

1. นับ internal link ในแต่ละหน้า — *ต้อง 3 ลิงก์ขึ้นไป เพื่อ crawl budget*

เกณฑ์ตัดสิน:
- < 3 internal link → ควรแก้

**WHAT — ตรวจอะไร**

หน้าต่างๆ ในเว็บเชื่อมโยงถึงกันด้วยลิงก์ภายในน้อยเกินไป เหมือนห้างที่แต่ละร้านไม่มีป้ายบอกทางไปร้านอื่น

**WHY — ทำไมต้องตรวจ**

ลิงก์ภายในช่วยทั้งลูกค้าเดินดูเว็บต่อ (เพิ่มโอกาสขาย) และช่วย Google ไหลคะแนนไปยังหน้าสำคัญ ยิ่งเชื่อมดีหน้าสำคัญยิ่งติดอันดับง่าย

**อ้างอิง:** [Ahrefs: Internal links for SEO](https://ahrefs.com/blog/internal-links-for-seo/) · [Google: Make your links crawlable](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)


### anchor ว่าง

`Indexing` · ความเชื่อมั่น 85% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 483-485)**

1. ตรวจ a tag ไม่มี text ไม่มี aria-label — *AI และ screen reader ต้องรู้ลิงก์ไปไหน*

เกณฑ์ตัดสิน:
- พบ anchor ว่างเปล่า → ควรแก้

**WHAT — ตรวจอะไร**

มีลิงก์ที่กดได้แต่ไม่มีข้อความบอกว่าลิงก์ไปไหน (ลิงก์เปล่า เช่นเป็นแค่ไอคอนหรือช่องว่าง)

**WHY — ทำไมต้องตรวจ**

ทั้ง Google และผู้พิการที่ใช้โปรแกรมอ่านหน้าจอจะไม่รู้ว่าลิงก์นี้พาไปไหน เสียทั้งคะแนนและการเข้าถึง

**อ้างอิง:** [WCAG 2.1: Link Purpose (2.4.4)](https://www.w3.org/WAI/WCAG21/Understanding/link-purpose-in-context.html) · [Google: Make your links crawlable](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)


### anchor กว้างไป

`Indexing` · ความเชื่อมั่น 70% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 487-490)**

1. ตรวจ anchor text ใช้คำ generic: read more, click here — *Google ไม่รู้ลิงก์ไปเอกสารอะไร*

เกณฑ์ตัดสิน:
- หน้ามี generic anchor > 2 → ควรแก้

**WHAT — ตรวจอะไร**

ลิงก์ที่ใช้คำกำกวมอย่าง "คลิกที่นี่" หรือ "อ่านต่อ" ซ้ำๆ แทนที่จะบอกว่าลิงก์ไปเรื่องอะไร

**WHY — ทำไมต้องตรวจ**

คำลิงก์ที่สื่อความหมาย (เช่น "ดูรองเท้าวิ่งรุ่นใหม่") ช่วยให้ Google เข้าใจหน้าปลายทางและช่วยอันดับ ส่วน "คลิกที่นี่" ไม่ให้ข้อมูลอะไรเลย

**อ้างอิง:** [Google: Make your links crawlable](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) · [Ahrefs: Anchor text](https://ahrefs.com/blog/anchor-text/)


# Schema

## JSON-LD

### ไม่มี JSON-LD

`Schema` · ความเชื่อมั่น 100% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 414-417)**

1. หา script type application/ld+json — *Structured data ช่วย Google เข้าใจ*

เกณฑ์ตัดสิน:
- 0 หน้า → ผิดร้ายแรง

**WHAT — ตรวจอะไร**

Structured Data (JSON-LD) คือข้อมูลเสริมที่ฝังในหน้าแบบที่ "เครื่องอ่านได้" บอก Google ตรงๆ ว่าหน้านี้คือสินค้าอะไร ราคาเท่าไร ร้านชื่ออะไร มีรีวิวกี่ดาว เหมือนติดป้ายฉลากสินค้าที่เครื่องสแกนอ่านได้ทันที เว็บนี้ยังไม่มีเลยสักหน้า

**WHY — ทำไมต้องตรวจ**

ถ้าไม่มีฉลากนี้ จะเสีย 2 อย่างใหญ่: (1) เสีย "ผลการค้นหาแบบพิเศษ" บน Google เช่น ดาวรีวิว ราคา รูปสินค้า ที่ทำให้ผลของเราเด่นกว่าคู่แข่งและคนกดเยอะกว่า (2) เมื่อมีคนถาม ChatGPT หรือ AI ต่างๆ เกี่ยวกับธุรกิจแบบเรา AI จะไม่มีข้อมูลที่เป็นระเบียบให้ดึงไปตอบ เลยไปอ้างอิงเว็บคู่แข่งที่ติดฉลากไว้แทน

**อ้างอิง:** [Google: Intro to structured data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data) · [Schema.org](https://schema.org/) · [W3C: JSON-LD 1.1](https://www.w3.org/TR/json-ld11/)


### JSON-LD ผิดรูปแบบ

`Schema` · ความเชื่อมั่น 100% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 419-420)**

1. ตรวจ syntax JSON — *Google ต้อง parse JSON ได้*

เกณฑ์ตัดสิน:
- JSON ไม่ valid → ผิดร้ายแรง

**WHAT — ตรวจอะไร**

มีการติดฉลากข้อมูลให้เครื่องอ่าน (Structured Data) แล้ว แต่เขียนผิดรูปแบบ ทำให้ Google อ่านไม่ได้

**WHY — ทำไมต้องตรวจ**

ฉลากที่เสียเท่ากับไม่ได้ติด — เสียโอกาสได้ผลค้นหาแบบพิเศษ (ดาว/ราคา/รูป) และอาจโดน Google เตือนว่าเว็บมีข้อผิดพลาด

**อ้างอิง:** [W3C: JSON-LD 1.1](https://www.w3.org/TR/json-ld11/) · [Google: Intro to structured data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)


## Structured Data

### Organization schema

`Schema` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 428-430)**

1. ตรวจ JSON-LD มี @type Organization/LocalBusiness/Corporation — *Google ใช้ระบุธุรกิจ + Knowledge Panel*

เกณฑ์ตัดสิน:
- ไม่มี → ผิดร้ายแรง

**WHAT — ตรวจอะไร**

Organization schema คือฉลากข้อมูลที่บอก Google และ AI ว่า "บริษัทเราคือใคร" ชื่อเต็ม โลโก้ ที่อยู่ ช่องทางติดต่อ โซเชียล เว็บนี้ยังไม่ได้ติดฉลากนี้

**WHY — ทำไมต้องตรวจ**

ถ้าไม่มี Google และ AI จะไม่รู้จักตัวตนแบรนด์เรา ทำให้พลาดกล่องข้อมูลบริษัทด้านขวาของหน้า Google (Knowledge Panel) และเมื่อคนถาม AI ว่า "บริษัทนี้คือใคร" AI จะไม่มีข้อมูลยืนยันตัวตนของเรา

**อ้างอิง:** [Google: Organization structured data](https://developers.google.com/search/docs/appearance/structured-data/organization) · [Schema.org: Organization](https://schema.org/Organization)


### Breadcrumb schema

`Schema` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 431-433)**

1. ตรวจ JSON-LD มี @type BreadcrumbList — *Breadcrumb ใน SERP ช่วย CTR*

เกณฑ์ตัดสิน:
- ไม่มี → ควรแก้

**WHAT — ตรวจอะไร**

Breadcrumb schema คือฉลากบอกเส้นทางหน้า เช่น หน้าแรก › สินค้า › รองเท้า ให้ Google แสดงเส้นทางนี้ในผลค้นหา

**WHY — ทำไมต้องตรวจ**

ช่วยให้ผลค้นหาของเราดูเป็นระเบียบและน่ากดขึ้น และช่วยลูกค้าเข้าใจว่าหน้านี้อยู่ตรงไหนของเว็บ

**อ้างอิง:** [Google: Breadcrumb structured data](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb) · [Schema.org: BreadcrumbList](https://schema.org/BreadcrumbList)


### schema ไม่ครบ field

`Schema` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 436-461)**

1. ตรวจ JSON-LD ไม่มี required property — *ถ้าขาด required = Google ไม่ยอมใช้ rich result*
2. หากขาด recommended property = warn — *ช่วยให้ rich result ต่างกว่า*

เกณฑ์ตัดสิน:
- ขาด required → ผิดร้ายแรง | ขาด recommended → ควรแก้

**WHAT — ตรวจอะไร**

มีการติดฉลากข้อมูลให้เครื่องอ่าน (Structured Data) แล้ว แต่ใส่ข้อมูลไม่ครบตามที่ Google ต้องการ เช่น ติดฉลากสินค้าแต่ลืมใส่ราคา

**WHY — ทำไมต้องตรวจ**

ฉลากที่ข้อมูลไม่ครบ Google อาจไม่ยอมแสดงผลแบบพิเศษให้ เท่ากับลงแรงติดฉลากแล้วแต่ยังไม่ได้ประโยชน์เต็มที่

**อ้างอิง:** [Google: Intro to structured data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data) · [Schema.org](https://schema.org/)


## Social Cards

### Open Graph

`Schema` · ความเชื่อมั่น 80% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 464-467)**

1. หา meta property og:title และ og:image — *เมื่อแชร์บน social/LINE ต้องมีรูปและชื่อ*

เกณฑ์ตัดสิน:
- ไม่มี og:title หรือ og:image → ควรแก้

**WHAT — ตรวจอะไร**

Open Graph คือข้อมูลที่กำหนดว่า "เวลาแชร์ลิงก์เว็บนี้ลง Facebook, LINE, X จะขึ้นรูปและข้อความอะไร" เว็บนี้ใส่ไม่ครบ ทำให้แชร์แล้วไม่มีรูปหรือหัวข้อ

**WHY — ทำไมต้องตรวจ**

เวลาลูกค้าหรือเพจแชร์ลิงก์เรา ถ้าขึ้นมาเป็นลิงก์เปล่าๆ ไม่มีรูป ไม่มีหัวข้อ จะดูไม่น่าเชื่อถือและแทบไม่มีใครกด เสียโอกาสกระจายผ่านโซเชียลฟรีๆ

**อ้างอิง:** [The Open Graph protocol](https://ogp.me/)


### og:image เป็น relative

`Schema` · ความเชื่อมั่น 80% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 782-783)**

1. ตรวจ og:image value เป็น absolute หรือ relative — *Facebook/LINE ต้อง absolute*

เกณฑ์ตัดสิน:
- relative URL → ควรแก้

**WHAT — ตรวจอะไร**

รูปที่จะโชว์ตอนแชร์ลิงก์ (Open Graph image) ใส่ที่อยู่แบบไม่เต็ม ทำให้บางแพลตฟอร์มหารูปไม่เจอ

**WHY — ทำไมต้องตรวจ**

แชร์ไปแล้วรูปอาจไม่ขึ้น ทำให้โพสต์ดูโล่งและน่ากดน้อยลง ควรใส่ที่อยู่รูปแบบเต็ม

**อ้างอิง:** [The Open Graph protocol](https://ogp.me/)


### Twitter Card

`Schema` · ความเชื่อมั่น 70% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 469-470)**

1. หา meta name twitter:card — *Twitter preview ของ URL*

เกณฑ์ตัดสิน:
- ไม่มี → ควรแก้

**WHAT — ตรวจอะไร**

Twitter Card คือการตั้งค่าให้ลิงก์ที่แชร์บน X (Twitter) แสดงเป็นการ์ดสวยๆ พร้อมรูปและหัวข้อ

**WHY — ทำไมต้องตรวจ**

ช่วยให้ลิงก์ที่แชร์บน X ดูเป็นมืออาชีพและน่ากดมากขึ้น เพิ่มทราฟฟิกจากโซเชียล

**อ้างอิง:** [X Developer Docs (Cards)](https://docs.x.com/overview)


# Security

## HTTPS / TLS

### ไม่ใช่ HTTPS

`Security` · ความเชื่อมั่น 100% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 222-224)**

1. ตรวจว่า origin ใช้ https:// ไหม — *Google ต้องการเว็บปลอดภัย*

เกณฑ์ตัดสิน:
- HTTP ธรรมดา → ผิดร้ายแรง

**WHAT — ตรวจอะไร**

HTTPS คือการเข้ารหัสเว็บให้ปลอดภัย (สังเกตจากรูปกุญแจหน้าที่อยู่เว็บ) หน้าบางส่วนของเว็บนี้ยังไม่ปลอดภัย

**WHY — ทำไมต้องตรวจ**

เบราว์เซอร์จะขึ้นเตือน "เว็บไม่ปลอดภัย" ตัวแดงๆ ทำให้ลูกค้าตกใจและไม่กล้ากรอกข้อมูลหรือชำระเงิน ทั้งยัง Google จัดอันดับเว็บปลอดภัยดีกว่า

**อ้างอิง:** [Google: HTTPS as a ranking signal](https://developers.google.com/search/blog/2014/08/https-as-ranking-signal) · [RFC 9110: HTTP Semantics](https://datatracker.ietf.org/doc/html/rfc9110)


### SSL chain ไม่ครบ

`Security` · ความเชื่อมั่น 95% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 229-232)**

1. ตรวจว่า certificate ส่งมาครบ chain — *ไคลเอนต์เข้มงวด (bot/มือถือ) จะปฏิเสธ*

เกณฑ์ตัดสิน:
- ขาด intermediate → ผิดร้ายแรง

**อ้างอิง:** [RFC 8446: TLS 1.3](https://datatracker.ietf.org/doc/html/rfc8446) · [MDN: Transport Layer Security](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Transport_Layer_Security)


### mixed content

`Security` · ความเชื่อมั่น 100% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 383-386)**

1. ตรวจ HTTPS page มี resource แบบ http:// — *เบราว์เซอร์บล็อก mixed content*

เกณฑ์ตัดสิน:
- พบ http resource → ผิดร้ายแรง

**WHAT — ตรวจอะไร**

หน้าที่ปลอดภัย (HTTPS) แต่ยังดึงบางส่วน (เช่นรูปหรือสคริปต์) มาจากช่องทางที่ไม่ปลอดภัย เหมือนบ้านที่ล็อกประตูหน้าแต่เปิดหน้าต่างหลังทิ้งไว้

**WHY — ทำไมต้องตรวจ**

เบราว์เซอร์อาจขึ้นเตือนว่าหน้าไม่ปลอดภัยเต็มที่ หรือบล็อกบางส่วนไม่ให้แสดง ทำให้หน้าดูพังและลดความน่าเชื่อถือ

**อ้างอิง:** [W3C: Mixed Content](https://www.w3.org/TR/mixed-content/) · [MDN: Mixed content](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Mixed_content)


## Security Headers

### ขาด security headers

`Security` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 583-594)**

1. ตรวจหมดหน้าแรก มี security headers — *ปกป้อง downgrade attack / MIME sniffing / clickjacking*

เกณฑ์ตัดสิน:
- ขาด header > 0 → ควรแก้

**WHAT — ตรวจอะไร**

เว็บยังตั้งค่าความปลอดภัยเสริมบางอย่างไม่ครบ (การ์ดป้องกันการโจมตีรูปแบบต่างๆ ที่เพิ่มได้ฝั่งเซิร์ฟเวอร์)

**WHY — ทำไมต้องตรวจ**

ช่วยป้องกันการโจมตีและเพิ่มความน่าเชื่อถือของเว็บ เป็นการบ้านพื้นฐานด้านความปลอดภัยที่ควรทำให้ครบ

**อ้างอิง:** [MDN: HTTP headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers) · [OWASP: Secure Headers Project](https://owasp.org/www-project-secure-headers/)


# Performance

## Speed

### TTFB ช้า

`Performance` · ความเชื่อมั่น 90% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 575-576)**

1. วัด time to first byte (TTFB) — *ถ้า > 3 วินาที = slow*

เกณฑ์ตัดสิน:
- > 3 วินาที → ควรแก้

**WHAT — ตรวจอะไร**

TTFB คือเวลาที่เซิร์ฟเวอร์ใช้ตอบสนองครั้งแรกหลังคนกดเข้าเว็บ (ก่อนหน้าจะเริ่มแสดงอะไรด้วยซ้ำ) ของเว็บนี้ช้ากว่าเกณฑ์

**WHY — ทำไมต้องตรวจ**

ถ้าเซิร์ฟเวอร์ตอบช้าตั้งแต่วินาทีแรก ทุกอย่างหลังจากนั้นก็ช้าตาม ลูกค้าบนมือถือมักใจร้อน รอเกิน 3 วินาทีก็กดออกแล้ว

**อ้างอิง:** [web.dev: Time to First Byte (TTFB)](https://web.dev/articles/ttfb) · [Google: Core Web Vitals report](https://developers.google.com/search/docs/appearance/core-web-vitals)


## Payload

### ไม่บีบอัด (gzip/br)

`Performance` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 570-573)**

1. ตรวจ content-encoding header (gzip/brotli) — *ลดขนาด data = หน้าโหลดเร็ว*

เกณฑ์ตัดสิน:
- ทุกหน้าไม่มี compression → ควรแก้

**WHAT — ตรวจอะไร**

เว็บยังไม่ได้เปิดการบีบอัดไฟล์ก่อนส่งให้ผู้ใช้ (เหมือนส่งของโดยไม่ได้แพ็กให้กระชับ) ทำให้ไฟล์ที่ส่งใหญ่กว่าที่ควร

**WHY — ทำไมต้องตรวจ**

การเปิดบีบอัดเป็นวิธีง่ายๆ ที่ทำให้เว็บโหลดเร็วขึ้นทันทีโดยไม่ต้องแก้เนื้อหา ช่วยทั้งอันดับและประสบการณ์ลูกค้า

**อ้างอิง:** [Lighthouse: Enable text compression](https://developer.chrome.com/docs/lighthouse/performance/uses-text-compression)


### HTML ใหญ่เกิน

`Performance` · ความเชื่อมั่น 80% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 564-565)**

1. วัด HTML file size — *HTML > 500KB = เสีย download*

เกณฑ์ตัดสิน:
- > 500KB → ควรแก้

**WHAT — ตรวจอะไร**

โค้ดของหน้าเว็บมีขนาดใหญ่เกินไป ทำให้ดาวน์โหลดและประมวลผลช้า

**WHY — ทำไมต้องตรวจ**

หน้าที่หนักทำให้โหลดช้าโดยเฉพาะบนมือถือและเน็ตช้า ส่งผลให้ลูกค้ารอนานและ Google ให้คะแนนความเร็วต่ำ

**อ้างอิง:** [Lighthouse: Avoid enormous network payloads](https://developer.chrome.com/docs/lighthouse/performance/total-byte-weight)


### inline CSS/JS เยอะ

`Performance` · ความเชื่อมั่น 70% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 578-579)**

1. วัด inline script และ style รวมกัน — *inline > 200KB = payload ใหญ่*

เกณฑ์ตัดสิน:
- > 200KB inline → ควรแก้

**WHAT — ตรวจอะไร**

หน้ามีโค้ดตกแต่ง/สคริปต์เขียนปนอยู่ในตัวหน้าเยอะเกินไป แทนที่จะแยกเป็นไฟล์ต่างหากที่เบราว์เซอร์จำไว้ใช้ซ้ำได้

**WHY — ทำไมต้องตรวจ**

ทำให้ทุกหน้าหนักขึ้นและโหลดช้าซ้ำๆ เพราะเบราว์เซอร์เก็บไว้ใช้ซ้ำไม่ได้ กระทบความเร็วโดยรวม

**อ้างอิง:** [Lighthouse: Eliminate render-blocking resources](https://developer.chrome.com/docs/lighthouse/performance/render-blocking-resources) · [Lighthouse: Avoid enormous network payloads](https://developer.chrome.com/docs/lighthouse/performance/total-byte-weight)


### script เยอะ

`Performance` · ความเชื่อมั่น 70% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 567-568)**

1. นับจำนวน script src — *สคริปต์เยอะ = เสีย LCP/INP*

เกณฑ์ตัดสิน:
- > 25 script → ควรแก้

**WHAT — ตรวจอะไร**

หน้าโหลดสคริปต์ (โปรแกรมเล็กๆ ที่ทำให้เว็บทำงาน) จำนวนมากเกินไป

**WHY — ทำไมต้องตรวจ**

ยิ่งสคริปต์เยอะ หน้ายิ่งใช้เวลาประมวลผลนานก่อนพร้อมใช้งาน ลูกค้าต้องรอนานขึ้นกว่าจะกดอะไรได้

**อ้างอิง:** [Lighthouse: Avoid an excessive DOM size](https://developer.chrome.com/docs/lighthouse/performance/dom-size)


### อัตรา text:HTML ต่ำ

`Performance` · ความเชื่อมั่น 60% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 715-716)**

1. คำนวณ text / HTML size ratio เมื่อ HTML > 60KB — *ratio < 8% = โค้ดบวม*

เกณฑ์ตัดสิน:
- < 8% ratio + > 60KB → ควรแก้

**WHAT — ตรวจอะไร**

สัดส่วนระหว่าง "ตัวหนังสือจริงที่คนอ่าน" กับ "โค้ดเบื้องหลังหน้าเว็บ" ถ้าหน้ามีโค้ดเยอะแต่ตัวหนังสือน้อย แปลว่าหน้าหนักแต่เนื้อหาจริงนิดเดียว

**WHY — ทำไมต้องตรวจ**

หน้าที่มีเนื้อหาน้อยเมื่อเทียบกับขนาดไฟล์ มักโหลดช้าและให้คุณค่ากับผู้อ่านน้อย ส่งผลเสียทั้งต่ออันดับและประสบการณ์ลูกค้า

**อ้างอิง:** [Lighthouse: Avoid enormous network payloads](https://developer.chrome.com/docs/lighthouse/performance/total-byte-weight)


## Render-blocking

### blocking ใน <head>

`Performance` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 711-712)**

1. นับ script src ใน head ไม่มี defer/async — *blocking script = เบราว์เซอร์หยุด render*

เกณฑ์ตัดสิน:
- > 2 blocking script ใน head → ควรแก้

**WHAT — ตรวจอะไร**

มีไฟล์ที่ "ขวางการแสดงผล" อยู่ส่วนบนของหน้า ทำให้เบราว์เซอร์ต้องโหลดไฟล์นั้นให้เสร็จก่อนถึงจะเริ่มแสดงเนื้อหาให้คนเห็น

**WHY — ทำไมต้องตรวจ**

ทำให้คนเห็นหน้าจอขาวๆ นานขึ้นก่อนเนื้อหาจะโผล่ ซึ่งเป็นช่วงวิกฤตที่ลูกค้าตัดสินใจว่าจะรอหรือกดออก

**อ้างอิง:** [Lighthouse: Eliminate render-blocking resources](https://developer.chrome.com/docs/lighthouse/performance/render-blocking-resources)


### third-party เยอะ

`Performance` · ความเชื่อมั่น 80% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 703-708)**

1. นับ third-party script — *เยอะ = เสีย INP privacy*

เกณฑ์ตัดสิน:
- > 8 third-party โดเมน → ควรแก้

**WHAT — ตรวจอะไร**

หน้าดึงโค้ดจากบริการภายนอกหลายเจ้า (เช่น แชท วิดเจ็ต โฆษณา ตัวติดตามสถิติ) มากเกินไป

**WHY — ทำไมต้องตรวจ**

โค้ดจากภายนอกแต่ละตัวเราคุมความเร็วไม่ได้ ถ้าเจ้าใดช้าก็ลากให้ทั้งหน้าเราช้าตาม ควรเก็บเท่าที่จำเป็น

**อ้างอิง:** [Lighthouse: Reduce third-party impact](https://developer.chrome.com/docs/lighthouse/performance/third-party-summary)


# Media / Links

## Images

### รูปไม่มี alt

`Media / Links` · ความเชื่อมั่น 100% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 504-548)**

1. ตรวจรูปที่แสดงจริง (ใช้ rendered DOM ถ้ามี) — *ต้องแยก รูปที่โชว์ vs รูปที่ซ่อน*
2. หา alt attribute หรือ aria-label หรือ role=presentation — *ทั้ง 3 หมายถึง อธิบายแล้ว*
3. ไม่มี alt = fail | alt = warn (อาจรูปประดับ) — *ต้องแบ่งเคส*

เกณฑ์ตัดสิน:
- โชว์จริง + ไม่มี alt → ผิดร้ายแรง | โชว์จริง + alt → ควรแก้

ข้อสังเกต: alt ambiguous เพราะต้องคนดูยืนยัน.

**WHAT — ตรวจอะไร**

Alt text คือคำบรรยายรูปภาพที่เขียนไว้ในโค้ด บอกว่ารูปนั้นเป็นรูปอะไร (เช่น "รองเท้าวิ่งสีแดงรุ่น X") รูปส่วนใหญ่ในเว็บนี้ไม่มีคำบรรยาย

**WHY — ทำไมต้องตรวจ**

เสีย 2 อย่าง: (1) รูปเราจะไม่ขึ้นใน Google Images ทำให้พลาดทราฟฟิกจากการค้นรูป (2) ผู้พิการทางสายตาที่ใช้โปรแกรมอ่านหน้าจอจะไม่รู้ว่ารูปคืออะไร ซึ่งเป็นทั้งเรื่องการเข้าถึงและบางองค์กรถือเป็นข้อกำหนดทางกฎหมาย

**HOW — ตรวจอย่างไร**

1. rendered DOM (รูปที่แสดงจริง)
2. รูป decorative → ข้าม

**DECISION RULE — เกณฑ์ตัดสิน**

- visible + ไม่มี alt → fail/warn  →  🟡 Low/Warn
- alt="" → conf ต่ำ
- ครบ → pass

**อ้างอิง:** [HTML Standard: alt text requirements](https://html.spec.whatwg.org/multipage/images.html#alt) · [WCAG 2.1: Non-text Content (1.1.1)](https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html)


### ไม่มีขนาดรูป

`Media / Links` · ความเชื่อมั่น 80% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 555-558)**

1. ตรวจรูปมี width/height attribute — *ไม่มี = layout shift (CLS แย่)*

เกณฑ์ตัดสิน:
- 50% + > 5 รูป ไม่มี dimensions → ควรแก้

**WHAT — ตรวจอะไร**

รูปภาพไม่ได้ระบุขนาด (กว้าง×สูง) ไว้ในโค้ด ทำให้เวลาหน้าโหลด เนื้อหากระตุกขยับไปมาตอนรูปค่อยๆ ขึ้น

**WHY — ทำไมต้องตรวจ**

หน้าที่เนื้อหากระโดดไปมาตอนโหลดทำให้ลูกค้ารำคาญ (บางทีกำลังจะกดปุ่มแล้วปุ่มเลื่อนหนี) และ Google นับเป็นคะแนนความเร็วที่แย่ลง

**อ้างอิง:** [HTML Standard: dimension attributes](https://html.spec.whatwg.org/multipage/embedded-content-other.html#dimension-attributes) · [Google: Core Web Vitals report](https://developers.google.com/search/docs/appearance/core-web-vitals)


### ไม่ lazy-load

`Media / Links` · ความเชื่อมั่น 75% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 551-554)**

1. นับรูปที่ไม่มี loading="lazy" — *รูปด้านล่างหน้า ควร lazy load*

เกณฑ์ตัดสิน:
- 70% + > 5 รูป ไม่มี lazy → ควรแก้

**WHAT — ตรวจอะไร**

รูปภาพยังไม่ได้ตั้งค่าให้ "โหลดเมื่อเลื่อนถึง" (lazy load) ทำให้ตอนเปิดหน้าต้องโหลดรูปทั้งหมดพร้อมกันแม้รูปที่อยู่ล่างสุด

**WHY — ทำไมต้องตรวจ**

การโหลดรูปทุกใบพร้อมกันทำให้หน้าเปิดช้าลง โดยเฉพาะบนมือถือ ลูกค้าที่รอนานอาจกดออกก่อน

**อ้างอิง:** [HTML Standard: lazy-loading attribute](https://html.spec.whatwg.org/multipage/urls-and-fetching.html#lazy-loading-attributes) · [MDN: Lazy loading](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Lazy_loading)


## Rendering

### raw ≠ rendered

`Media / Links` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 611-633)**

1. เปรียบ raw HTML vs rendered (headless Chrome) — *ต้องแยก Google เห็น vs AI bot เห็น*
2. หากแตกต่างชัด = fail — *สิ่งที่ Google crawl ≠ สิ่งที่ AI bot เห็น*

เกณฑ์ตัดสิน:
- ต่างกันชัด → ผิดร้ายแรง | ตรงกัน → ผ่าน

**WHAT — ตรวจอะไร**

เปรียบเทียบสิ่งที่เห็น "ตอนเปิดหน้าครั้งแรก" กับ "หลังหน้าประกอบเสร็จ" แล้วพบว่าต่างกันมาก แปลว่าเนื้อหาสำคัญโผล่มาทีหลังด้วยโปรแกรม ไม่ได้อยู่ในหน้าตั้งแต่แรก

**WHY — ทำไมต้องตรวจ**

เนื้อหาที่โผล่ทีหลังมีความเสี่ยงที่ Google จะเก็บไม่ครบ และบอท AI ที่ไม่รอประกอบหน้าจะมองไม่เห็นเลย ทำให้เนื้อหาขายของเราหายไปจากทั้ง Google และ AI

**อ้างอิง:** [Google: JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)


### SPA shell ว่าง

`Media / Links` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 599-609)**

1. ตรวจ root container ว่างเปล่า — *CSR = เนื้อหา render บน client*
2. ว่าง = SPA | ไม่ว่าง = SSR — *ต้องแยก*

เกณฑ์ตัดสิน:
- SPA + empty root → ผิดร้ายแรง | SSR + เนื้อหาครบ → ผ่าน

**WHAT — ตรวจอะไร**

เว็บนี้สร้างแบบที่เนื้อหา "ค่อยประกอบขึ้นด้วยโปรแกรม (JavaScript) หลังเปิดหน้า" แทนที่จะส่งเนื้อหาสำเร็จรูปมาเลย ทำให้ตอนแรกที่เปิดมาหน้าแทบว่างเปล่า

**WHY — ทำไมต้องตรวจ**

นี่คือปัญหาใหญ่สำหรับยุค AI — Google พอจะรอประกอบหน้าได้บ้าง แต่บอทของ AI ทั้งหลาย (ChatGPT, Claude, Perplexity) ไม่รอประกอบหน้า มันเห็นแค่หน้าว่างๆ เท่ากับเว็บเราล่องหนในสายตา AI ทั้งหมด

**อ้างอิง:** [Google: JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)


### ไม่มี noscript fallback

`Media / Links` · ความเชื่อมั่น 80% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 635-636)**

1. ตรวจ noscript tag เมื่อ SPA — *ผู้ใช้ปิด JS อ่านอะไร*

เกณฑ์ตัดสิน:
- SPA ไม่มี noscript → ควรแก้

**WHAT — ตรวจอะไร**

สำหรับเว็บที่พึ่งพาโปรแกรม (JavaScript) ควรมีเนื้อหาสำรองเผื่อกรณีที่โปรแกรมไม่ทำงาน แต่เว็บนี้ไม่มี

**WHY — ทำไมต้องตรวจ**

ถ้าโปรแกรมโหลดไม่สำเร็จ (เน็ตช้า/บอทที่ไม่รันโปรแกรม) ผู้เข้าชมจะเจอหน้าว่างเปล่า เสียทั้งลูกค้าและการถูกเก็บข้อมูล

**อ้างอิง:** [HTML Standard: the noscript element](https://html.spec.whatwg.org/multipage/scripting.html#the-noscript-element) · [Google: JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)


# GEO (AI Search)

## llms.txt

### ไม่มี llms.txt

`GEO (AI Search)` · ความเชื่อมั่น 60% · Tier 4

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 84-89)**

1. ตรวจว่ามีไฟล์ /llms.txt หรือไม่ — *เพื่อดูว่าเว็บบอก AI engine ว่าสามารถใช้เนื้อหาได้*
2. อธิบายความจำเป็นของ llms.txt — *เพื่อให้เจ้าของเว็บรู้ว่านี่ไม่เป็นปัจจัย SEO ที่สำคัญ*

เกณฑ์ตัดสิน:
- ถ้ามี llms.txt → แจ้งเพื่อทราบ (ดี แต่ไม่ส่งผลอันดับ)
- ถ้าไม่มี → แจ้งเพื่อทราบ (ไม่ใช่ปัญหา)

**WHAT — ตรวจอะไร**

llms.txt คือไฟล์มาตรฐานใหม่ (เหมือน robots.txt แต่สำหรับ AI) ที่สรุปให้ AI ฟังว่าเว็บเราคือใคร มีหน้าสำคัญอะไรบ้าง ให้ AI ดึงไปใช้ได้ถูกต้อง เว็บนี้ยังไม่มี

**WHY — ทำไมต้องตรวจ**

เป็นมาตรฐานที่เพิ่งเกิดและยังมีคนทำน้อยมาก โดยเฉพาะเว็บไทย — การทำก่อนคือโอกาสนำหน้าคู่แข่งในการถูก AI เข้าใจและอ้างอิงอย่างถูกต้อง

**อ้างอิง:** [The /llms.txt proposal](https://llmstxt.org/)


## AI Crawler

### AI bot เข้าได้ไหม

`GEO (AI Search)` · ความเชื่อมั่น 75% · Tier 4

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 49-82)**

1. อ่านไฟล์ robots.txt เพื่อดูว่า AI bot ไหนถูกบล็อก — *เพื่อรู้ว่าเว็บช่วยให้ AI สามารถครอล (อ่าน) เนื้อหาได้หรือไม่*
2. รวมเก็บ path ที่เว็บปฏิเสธ AI bot ทั้งหมด — *เพื่อดูว่า bot ไหนถูกกั้น และที่ไหนของเว็บถูกกั้น*
3. ตรวจว่า root (/) ถูกบล็อกหรือแค่บาง section — *เพื่อเข้าใจความร้ายแรง — ทั้งเว็บกับแค่ส่วนนั้ง*

เกณฑ์ตัดสิน:
- ถ้าบล็อก root → ร้ายแรง (ผิด)
- ถ้าบล็อกเฉพาะ section → เตือน (ควรแก้)
- ถ้า bot ทั้งหมดผ่าน → ผ่าน

ข้อสังเกต: ไม่เช็ค HTTP headers (Disallow-Agent) แค่ robots.txt

**WHAT — ตรวจอะไร**

ตรวจว่าเว็บเปิดให้บอทของ AI ต่างๆ (เช่น GPTBot ของ ChatGPT, ClaudeBot, PerplexityBot) เข้ามาอ่านเนื้อหาได้หรือไม่

**WHY — ทำไมต้องตรวจ**

ถ้าปิดกั้นบอท AI เวลาคนถาม ChatGPT/Perplexity เกี่ยวกับสิ่งที่เราขาย AI จะไม่มีข้อมูลเราไปตอบเลย เท่ากับหายไปจากช่องทางค้นหายุคใหม่ที่กำลังโตเร็ว

**อ้างอิง:** [OpenAI: Bots (GPTBot)](https://developers.openai.com/api/docs/bots) · [Anthropic: Does Anthropic crawl the web?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) · [Perplexity: PerplexityBot](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)


### เสี่ยง SPA บัง AI bot

`GEO (AI Search)` · ความเชื่อมั่น 70% · Tier 4

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 91-99)**

1. ตรวจหน้าเว็บที่ส่ง HTML ว่างเปล่า (emptyRoot) — *เพื่อดูว่าเนื้อหาต่อจากเว็บ JavaScript หรือไม่*
2. นับจำนวนหน้าที่มีพฤติกรรมนี้ — *เพื่อรู้ขาดของปัญหา*
3. บอกว่า AI crawler ปัจจุบันไม่รัน JavaScript — *เพื่อให้เจ้าของรู้ว่า AI จะมองไม่เห็นเนื้อหาเลย*

เกณฑ์ตัดสิน:
- ถ้ามีหน้า SPA → ร้ายแรง (ผิด)
- ถ้าไม่มี → ผ่าน

**WHAT — ตรวจอะไร**

ตรวจว่าเนื้อหาเว็บต้องอาศัยโปรแกรม (JavaScript) ประกอบหน้าหรือไม่ ซึ่งเป็นความเสี่ยงสำหรับ AI ที่ไม่รอประกอบหน้า

**WHY — ทำไมต้องตรวจ**

ถ้าเนื้อหาเราโผล่ด้วยโปรแกรมทีหลัง บอท AI จะมองไม่เห็นและดึงไปตอบไม่ได้ ทำให้เราหายไปจากผลการค้นหายุค AI

**อ้างอิง:** [Google: JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics) · [OpenAI: Bots (GPTBot)](https://developers.openai.com/api/docs/bots)


## Citability

### FAQ schema

`GEO (AI Search)` · ความเชื่อมั่น 60% · Tier 4

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 101-112)**

1. เดินไปทั่วหน้าเว็บ ตรวจ JSON-LD schema — *เพื่อหา FAQPage หรือ QAPage type*
2. บอกว่า Google ไม่ใช้อีกแล้ว แต่ AI engine ใช้ — *เพื่อให้เจ้าของรู้คุณค่า และสิ่งที่ควรโฟกัส*

เกณฑ์ตัดสิน:
- ถ้ามี FAQ/QA schema → ผ่าน
- ถ้าไม่มี → ควรแก้ (แต่ไม่เร่งด่วน)

**WHAT — ตรวจอะไร**

FAQPage schema คือการติดฉลากให้ส่วนคำถาม-คำตอบในเว็บ เป็นรูปแบบที่ Google AI Overview และ ChatGPT ชอบหยิบไปตอบมากที่สุด เว็บนี้ยังไม่มีสักหน้า

**WHY — ทำไมต้องตรวจ**

นี่คือทางลัดที่ได้ผลที่สุดในการถูก AI อ้างถึง — ถ้าเราเตรียมคำถาม-คำตอบที่ลูกค้าถามบ่อยพร้อมติดฉลากไว้ มีโอกาสสูงที่ AI จะหยิบคำตอบของเราไปแสดงพร้อมเครดิตกลับมาหาเรา

**อ้างอิง:** [Google: Changes to FAQ rich results (2023)](https://developers.google.com/search/blog/2023/08/howto-faq-changes) · [Schema.org: FAQPage](https://schema.org/FAQPage)


### เนื้อหา Q&A

`GEO (AI Search)` · ความเชื่อมั่น 55% · Tier 4

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 114-121)**

1. ตรวจหัวข้อ (heading) ว่ามีคำที่บ่งบอกคำถาม ("/", "คืออะไร", "ทำไม", "what", "how") — *เพื่อดูว่าเนื้อหาเขียนแบบตอบคำถาม*
2. นับจำนวนหน้าที่มีลักษณะนี้ — *เพื่อรู้ว่าเนื้อหามีโครงสร้างเหมาะกับ AI หรือไม่*

เกณฑ์ตัดสิน:
- ถ้ามีหัวข้อเชิงคำถาม → ผ่าน
- ถ้าไม่มี → ควรแก้

**WHAT — ตรวจอะไร**

ตรวจว่าเว็บมีเนื้อหารูปแบบถาม-ตอบ (หัวข้อที่ตั้งเป็นคำถามแล้วตามด้วยคำตอบ) ซึ่งเป็นโครงสร้างที่ AI ดึงไปตอบง่าย

**WHY — ทำไมต้องตรวจ**

AI ตอบคำถามคน ดังนั้นเนื้อหาที่จัดเป็นคำถาม-คำตอบตรงกับสิ่งที่ AI มองหาพอดี ยิ่งมีมาก ยิ่งมีโอกาสถูกเลือกไปเป็นคำตอบ

**อ้างอิง:** [RAG — Lewis et al., 2020 (arXiv)](https://arxiv.org/abs/2005.11401)


### เนื้อหาอ้างอิงได้

`GEO (AI Search)` · ความเชื่อมั่น 55% · Tier 4

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 140-146)**

1. นับหน้าที่มีตาราง (hasTables) หรือลิสต์ (listCount >= 3) — *เพื่อดูว่าเนื้อหามีข้อมูลที่ AI สามารถอ้างอิงได้*
2. เทียบกับจำนวนหน้า — *เพื่อตัดสินว่าเนื้อหาพอเนื้อให้ cite*

เกณฑ์ตัดสิน:
- ถ้า >= 3 หน้าขึ้นไป → ผ่าน
- ถ้าน้อยกว่า → ควรแก้

**WHAT — ตรวจอะไร**

ตรวจว่าเนื้อหาในเว็บอยู่ในรูปแบบที่ AI ชอบหยิบไปอ้างอิง เช่น มีตาราง มีลิสต์ มีคำตอบที่ชัดเจนตรงประเด็น

**WHY — ทำไมต้องตรวจ**

AI มักดึงคำตอบจากเนื้อหาที่เป็นระเบียบและตอบตรงคำถาม ยิ่งเนื้อหาเราจัดรูปแบบดี ยิ่งมีโอกาสถูก AI เลือกไปอ้างอิงพร้อมลิงก์กลับมาหาเรา

**อ้างอิง:** [RAG — Lewis et al., 2020 (arXiv)](https://arxiv.org/abs/2005.11401)


## Authority / E-E-A-T

### E-E-A-T สัญญาณ

`GEO (AI Search)` · ความเชื่อมั่น 80% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 123-138)**

1. ตรวจว่าหน้ามี author (meta tag หรือ schema) — *เพื่อรู้ว่า AI จะระบุได้ว่าใครเขียนเนื้อหา*
2. ตรวจว่ามี datePublished หรือ dateModified — *เพื่อรู้ว่า AI ทราบเนื้อหาสดใหม่ไหน*
3. ตรวจว่า Organization มี sameAs ลิงก์ไป social/Wikipedia — *เพื่อช่วยให้ AI เชื่อมโยงแบรนด์กับเอกลักษณ์จริง*

เกณฑ์ตัดสิน:
- ถ้ามีทั้งหมด → ผ่าน
- ถ้าขาดส่วนไหน → ควรแก้

ข้อสังเกต: ตรวจแค่ structured data ไม่ได้วัด E-E-A-T จริง

**WHAT — ตรวจอะไร**

E-E-A-T คือสัญญาณความน่าเชื่อถือที่ Google และ AI ใช้ดู เช่น ใครเป็นคนเขียน มีวันที่เผยแพร่/อัปเดตไหม มีลิงก์ยืนยันตัวตนแบรนด์ (โซเชียล/วิกิพีเดีย) หรือเปล่า เว็บนี้ยังขาดสัญญาณเหล่านี้

**WHY — ทำไมต้องตรวจ**

ทั้ง Google และ AI ให้คะแนนแหล่งที่ดูน่าเชื่อถือสูงกว่า ถ้าเว็บเราไม่มีคนเขียน ไม่มีวันที่ ไม่มีตัวตนชัด AI จะลังเลที่จะอ้างอิงเรา และเลือกแหล่งอื่นที่ดูน่าเชื่อถือกว่าแทน

**อ้างอิง:** [Google: Creating helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) · [Google: Search Quality Rater Guidelines (PDF)](https://static.googleusercontent.com/media/guidelines.raterhub.com/en//searchqualityevaluatorguidelines.pdf)


### entity ชัดเจน

`GEO (AI Search)` · ความเชื่อมั่น 55% · Tier 4

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 166-176)**

1. ตรวจว่ามี Organization หรือ LocalBusiness schema ใน JSON-LD — *เพื่อบอก AI ว่าแบรนด์คืออะไร และข้อมูลเขา*

เกณฑ์ตัดสิน:
- ถ้ามี → ผ่าน
- ถ้าไม่มี → ควรแก้

ข้อสังเกต: ตรวจแค่ presence ไม่ได้ check ความครบถ้วน (name, logo, address เป็นต้น)

**WHAT — ตรวจอะไร**

ตรวจว่า AI "รู้จักตัวตนของแบรนด์เรา" ไหม ซึ่งต้องอาศัยฉลากข้อมูลองค์กร (Organization schema) ที่บอกว่าเราคือใคร เว็บนี้ยังไม่มี

**WHY — ทำไมต้องตรวจ**

เมื่อมีคนถาม AI ว่า "ธุรกิจประเภทนี้มีเจ้าไหนบ้าง" ถ้า AI ไม่มีข้อมูลตัวตนของแบรนด์เราที่ชัดเจน มันจะไม่นึกถึงเราและไปแนะนำคู่แข่งที่มีข้อมูลครบกว่าแทน

**อ้างอิง:** [Google: Introducing the Knowledge Graph](https://blog.google/products-and-platforms/products/search/introducing-knowledge-graph-things-not/) · [RAG — Lewis et al., 2020 (arXiv)](https://arxiv.org/abs/2005.11401)


### หน้า trust (about/contact)

`GEO (AI Search)` · ความเชื่อมั่น 65% · Tier 4

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 148-164)**

1. เดินไปทั่วหน้าและลิงก์ ตรวจว่ามีหน้า About, Contact, Privacy — *เพื่อรู้ว่าธุรกิจแสดงตัวตนให้ AI เห็น*
2. ตรวจว่าหน้ามีเบอร์โทรหรืออีเมลแสดง — *เพื่อให้ AI เห็นว่ามีวิธีติดต่อได้*

เกณฑ์ตัดสิน:
- ถ้าขาดหลาย signal (>= 3) → ร้ายแรง (ผิด)
- ถ้าขาดแค่ 1-2 → เตือน
- ถ้าครบ → ผ่าน

**WHAT — ตรวจอะไร**

ตรวจว่าเว็บมีหน้าสร้างความน่าเชื่อถือพื้นฐานครบไหม เช่น หน้าเกี่ยวกับเรา ติดต่อเรา นโยบายความเป็นส่วนตัว

**WHY — ทำไมต้องตรวจ**

ทั้งลูกค้า Google และ AI ใช้หน้าเหล่านี้ประเมินว่าเป็นธุรกิจจริงน่าเชื่อถือ ขาดไปทำให้ดูไม่มั่นคงและลดโอกาสถูกอ้างอิง

**อ้างอิง:** [Google: Search Quality Rater Guidelines (PDF)](https://static.googleusercontent.com/media/guidelines.raterhub.com/en//searchqualityevaluatorguidelines.pdf) · [Google: Creating helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)


# Verify

## Verification

### เทียบ Lighthouse



### เทียบ raw ↔ rendered



### คำนวณ confidence



### ส่งคน / seo-geo-verify


