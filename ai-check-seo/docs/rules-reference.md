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

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 106-115)**

1. ตรวจว่าแท็ก title อยู่ใน HTML ดิบหรือไม่
2. ถ้าไม่มี ลองหา title ที่สร้างมาจาก JavaScript หลังจาก render
3. เปรียบเทียบทั้ง raw HTML และหลัง JavaScript render

เกณฑ์ตัดสิน:
- ไม่มี title ทั้ง raw และ rendered - ข้อผิดพลาดร้ายแรง
- มี title แต่อยู่ใน JavaScript เท่านั้น - เตือนสูง (AI bot ไม่รัน JS)
- มี title ครบทุกหน้า - ผ่าน

**WHAT — ตรวจอะไร**

Title คือชื่อหน้าเว็บ — เป็นบรรทัดสีน้ำเงินตัวใหญ่ที่คนเห็นเป็นอันดับแรกบนหน้าผลการค้นหา Google และเป็นชื่อที่โชว์บนแท็บเบราว์เซอร์ ถ้าหน้าไหนไม่ใส่ Google จะเดาชื่อให้เอง ซึ่งมักออกมาไม่ตรงกับที่เราอยากสื่อ

**WHY — ทำไมต้องตรวจ**

นี่คือ "พาดหัวร้าน" บนหน้า Google — เป็นตัวตัดสินว่าคนจะคลิกเข้าเว็บเราหรือคลิกคู่แข่ง ถ้าปล่อยให้ Google เดาเอง พาดหัวอาจกลายเป็นข้อความมั่วๆ ที่ไม่มีใครอยากกด เท่ากับเสียลูกค้าตั้งแต่ยังไม่เข้าเว็บ

**อ้างอิง:** [Google: Influencing title links](https://developers.google.com/search/docs/appearance/title-link) · [HTML Standard: the title element](https://html.spec.whatwg.org/multipage/semantics.html#the-title-element)


### <title> สั้น/ยาว

`On-Page` · ความเชื่อมั่น 75% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 117-123)**

1. นับจำนวนตัวอักษรของ title แต่ละหน้า
2. หาหน้าที่ title ยาวเกิน 60 ตัวอักษร (โดนตัดใน SERP)
3. หาหน้าที่ title สั้นน้อยกว่า 15 ตัวอักษร

เกณฑ์ตัดสิน:
- มีหน้าที่ title ยาวหรือสั้นเกินไป - เตือนกลาง
- ทั้งหมดอยู่ในช่วง 15-60 ตัวอักษร - ผ่าน

**WHAT — ตรวจอะไร**

ความยาวของชื่อหน้า (Title) ที่เหมาะสมคือประมาณ 30–60 ตัวอักษร ถ้ายาวเกินไป Google จะตัดท้ายทิ้งแล้วต่อด้วย "…" ถ้าสั้นเกินไปก็ดูไม่น่าสนใจ

**WHY — ทำไมต้องตรวจ**

ชื่อที่โดนตัดกลางคันทำให้ข้อความขายที่สำคัญหายไปจากสายตาลูกค้าบนหน้า Google ลดโอกาสที่คนจะกดเข้ามา

**อ้างอิง:** [Google: Influencing title links](https://developers.google.com/search/docs/appearance/title-link) · [Moz: Title tag](https://moz.com/learn/seo/title-tag)


### <title> ซ้ำ  ✅ ยืนยันแล้ว

`On-Page` · ความเชื่อมั่น 85% · Tier 2
> verify (เคส vgi) + backport exclusions/normalize เท่า h1 + unit test 130/130

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 125-133)**

1. ตรวจเฉพาะหน้าที่เป็นเนื้อหาจริง (ตัด noindex, canonical, pagination ออก)
2. ปรับข้อความ title ให้เทียบกันได้ (ตัดช่องว่าง ตัดตัวพิมพ์ใหญ่)
3. หาว่า title ไหนซ้ำกันหลายหน้า

เกณฑ์ตัดสิน:
- มี title ซ้ำในหลายหน้า - ข้อผิดพลาดร้ายแรง
- title ไม่ซ้ำกัน - ผ่าน

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

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 136-144)**

1. ตรวจว่า meta description อยู่ใน HTML ดิบหรือไม่
2. ถ้าไม่มี ลองหา description ที่สร้างจาก JavaScript
3. เปรียบเทียบ raw HTML และหลัง JavaScript

เกณฑ์ตัดสิน:
- ไม่มี description ทั้ง raw และ rendered - ข้อผิดพลาดกลาง
- มี description แต่อยู่ใน JavaScript เท่านั้น - เตือนสูง
- มี description ครบ - ผ่าน

**WHAT — ตรวจอะไร**

Meta description คือข้อความสรุป 1-2 บรรทัดสีเทาที่อยู่ใต้ชื่อหน้าในผลการค้นหา Google เป็นเหมือน "คำโปรย" ที่ชวนคนกด ถ้าไม่ใส่ Google จะดึงข้อความท่อนไหนก็ได้จากหน้ามาแสดงแทน

**WHY — ทำไมต้องตรวจ**

นี่คือพื้นที่โฆษณาฟรีบนหน้า Google ที่เราเขียนเองได้ ถ้าปล่อยว่าง Google อาจหยิบข้อความที่ไม่เกี่ยวหรือไม่น่าสนใจมาโชว์ เท่ากับเสียโอกาสปิดการขายตั้งแต่หน้าค้นหา

**อ้างอิง:** [Google: Control your snippets](https://developers.google.com/search/docs/appearance/snippet) · [Moz: Meta description](https://moz.com/learn/seo/meta-description)


### description สั้น/ยาว

`On-Page` · ความเชื่อมั่น 75% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 146-147)**

1. นับจำนวนตัวอักษรของ description แต่ละหน้า
2. หาหน้าที่ description สั้นน้อยกว่า 50 หรือยาวเกิน 170 ตัวอักษร

เกณฑ์ตัดสิน:
- มีหน้า description ที่ยาวหรือสั้นไม่เหมาะสม - เตือนเล็กน้อย

**WHAT — ตรวจอะไร**

คำโปรยใต้ชื่อหน้า (Meta description) ที่ดีควรยาวราว 80–160 ตัวอักษร สั้นไปก็ไม่พอเล่ารายละเอียด ยาวไปก็โดน Google ตัดท้าย

**WHY — ทำไมต้องตรวจ**

ความยาวพอดีทำให้คำโปรยเล่าจุดขายได้ครบและไม่โดนตัด เพิ่มโอกาสที่คนอ่านแล้วอยากกดเข้ามา

**อ้างอิง:** [Google: Control your snippets](https://developers.google.com/search/docs/appearance/snippet) · [Moz: Meta description](https://moz.com/learn/seo/meta-description)


### description ซ้ำ

`On-Page` · ความเชื่อมั่น 75% · Tier 3
> logic+exclusions เท่า h1-duplicate + unit test แล้ว · รอ verify เว็บจริง

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 149-154)**

1. ตรวจเฉพาะหน้าเนื้อหาจริง (ตัด noindex, canonical, pagination)
2. ปรับข้อความ description ให้เทียบกันได้
3. หาว่า description ไหนซ้ำกันหลายหน้า

เกณฑ์ตัดสิน:
- มี description ซ้ำในหลายหน้า - เตือนกลาง

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

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 158-168)**

1. ตรวจว่าหน้ามี H1 ที่มีข้อความจริง (ไม่ใช่ว่างเปล่า)
2. ถ้าไม่มี ลองหา H1 ที่สร้างจาก JavaScript หลังจาก render
3. เปรียบเทียบทั้ง raw HTML และหลัง JavaScript

เกณฑ์ตัดสิน:
- ไม่มี H1 ที่มีข้อความทั้ง raw และ rendered - ข้อผิดพลาดร้ายแรง
- มี H1 แต่อยู่ใน JavaScript เท่านั้น - เตือนสูง
- ทุกหน้ามี H1 - ผ่าน

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

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 178-190)**

1. นับจำนวน H1 ในแต่ละหน้า
2. หาหน้าที่มี H1 มากกว่า 1 ตัว

เกณฑ์ตัดสิน:
- มีหน้ามี H1 หลายตัว - แจ้งเพื่อทราบ (ไม่ใช่ข้อผิดพลาด ตาม HTML5 ถูกต้อง)

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

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 670-677)**

1. ตรวจเฉพาะหน้าเนื้อหาจริง (ตัด noindex, canonical, pagination)
2. ปรับข้อความ H1 ให้เทียบกันได้
3. หาว่า H1 ไหนซ้ำกันหลายหน้า

เกณฑ์ตัดสิน:
- มี H1 ซ้ำในหลายหน้า - เตือนกลาง

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

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 171-176)**

1. ตรวจว่า H1 ถูกซ่อนด้วย CSS (display:none หรือ visibility:hidden)
2. นับจำนวน H1 ที่ซ่อนอยู่

เกณฑ์ตัดสิน:
- มี H1 ที่ถูกซ่อน - เตือนกลาง

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

1. นำหัวข้อ (H1-H6) มาเรียงตาม level
2. ตรวจว่า level มีการข้ามระดับไหม (เช่น H1 - H3 โดยไม่มี H2)

เกณฑ์ตัดสิน:
- มีหน้าที่ heading ข้ามระดับ - เตือนเล็กน้อย

**WHAT — ตรวจอะไร**

ลำดับหัวข้อในหน้าไม่เรียงตามขั้น เหมือนสารบัญที่กระโดดจากบทที่ 1 ไปหัวข้อย่อย 3.2 เลยโดยไม่มีบทที่ 2

**WHY — ทำไมต้องตรวจ**

โครงสร้างหัวข้อที่เป็นระเบียบช่วยให้ Google และโปรแกรมอ่านหน้าจอ (สำหรับผู้พิการ) เข้าใจลำดับเนื้อหา ทำให้หน้าอ่านง่ายและจัดอันดับดีขึ้น

**อ้างอิง:** [HTML Standard: headings & outlines](https://html.spec.whatwg.org/multipage/sections.html#headings-and-outlines) · [WCAG 2.1: Headings and Labels (2.4.6)](https://www.w3.org/WAI/WCAG21/Understanding/headings-and-labels.html)


### heading ว่างเปล่า

`On-Page` · ความเชื่อมั่น 90% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 680-681)**

1. ตรวจว่าหน้ามี heading tag (h1-h6) ที่ว่างเปล่า ไหม

เกณฑ์ตัดสิน:
- มี heading ว่างเปล่า - เตือนเล็กน้อย

**WHAT — ตรวจอะไร**

มีช่องหัวข้อในหน้าที่ว่างเปล่า ไม่มีข้อความ เหมือนป้ายหัวข้อที่แขวนไว้แต่ไม่ได้เขียนอะไร

**WHY — ทำไมต้องตรวจ**

หัวข้อว่างทำให้โครงสร้างหน้าดูรกและสับสน ไม่ช่วยทั้งคนอ่านและ Google

**อ้างอิง:** [HTML Standard: headings & outlines](https://html.spec.whatwg.org/multipage/sections.html#headings-and-outlines) · [WCAG 2.1: Headings and Labels (2.4.6)](https://www.w3.org/WAI/WCAG21/Understanding/headings-and-labels.html)


## Content

### เนื้อหาบาง (thin)

`On-Page` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 201-202)**

1. นับจำนวนคำในแต่ละหน้า
2. หาหน้าที่มีคำน้อยกว่า 150 คำ

เกณฑ์ตัดสิน:
- มีหน้าเนื้อหาบางเกินไป - เตือนกลาง

**WHAT — ตรวจอะไร**

หน้าที่มีเนื้อหาน้อยเกินไป (เนื้อความสั้นมาก เช่นไม่ถึง 150 คำ) เปรียบเหมือนโบรชัวร์ที่มีแต่หัวข้อ ไม่มีรายละเอียดให้อ่าน

**WHY — ทำไมต้องตรวจ**

Google ชอบหน้าที่ให้ข้อมูลครบและเป็นประโยชน์ หน้าที่เนื้อหาบางจะสู้คู่แข่งที่เขียนละเอียดกว่าไม่ได้ ทำให้ติดอันดับยาก และลูกค้าที่เข้ามาก็ได้ข้อมูลไม่พอจะตัดสินใจซื้อ

**อ้างอิง:** [Google: Creating helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)


### ปี copyright เก่า

`On-Page` · ความเชื่อมั่น 60% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 719-721)**

1. ค้นหาปี copyright ในหน้า (text ที่มีปี)
2. เปรียบเทียบกับปีปัจจุบัน

เกณฑ์ตัดสิน:
- ปี copyright เก่าเกิน 1 ปี - เตือนเล็กน้อย

**WHAT — ตรวจอะไร**

ปีลิขสิทธิ์ที่ท้ายเว็บ (เช่น © 2020) ยังเป็นปีเก่า ไม่อัปเดตเป็นปีปัจจุบัน

**WHY — ทำไมต้องตรวจ**

ลูกค้าที่เห็นปีเก่าๆ อาจคิดว่าเว็บนี้ถูกทิ้งร้างหรือบริษัทเลิกทำแล้ว ทำให้ขาดความน่าเชื่อถือ เป็นจุดเล็กๆ ที่ทำลายความมั่นใจในการซื้อ

**อ้างอิง:** [Google: Creating helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)


## HTML Document

### ไม่มี lang ใน <html>

`On-Page` · ความเชื่อมั่น 95% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 204-207)**

1. ตรวจว่าแท็ก html มีแอตทริบิวต์ lang หรือไม่
2. ถ้ามี บันทึกว่าเป็นภาษาอะไร

เกณฑ์ตัดสิน:
- ไม่มี lang attribute - เตือนเล็กน้อย
- มี lang ครบ - ผ่าน

**WHAT — ตรวจอะไร**

หน้าเว็บไม่ได้ระบุว่าเป็นภาษาอะไร (ไทยหรืออังกฤษ) ในโค้ด เหมือนหนังสือที่ไม่บอกว่าเขียนภาษาอะไรบนปก

**WHY — ทำไมต้องตรวจ**

Google และเบราว์เซอร์ใช้ข้อมูลนี้แสดงผลและแปลภาษาให้ถูกต้อง ถ้าไม่ระบุ อาจแสดงผลเพี้ยนหรือถูกเสนอให้คนผิดกลุ่มภาษา

**อ้างอิง:** [HTML Standard: the lang attribute](https://html.spec.whatwg.org/multipage/dom.html#the-lang-and-xml:lang-attributes) · [WCAG 2.1: Language of Page (3.1.1)](https://www.w3.org/WAI/WCAG21/Understanding/language-of-page.html)


### ไม่มี viewport

`On-Page` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 209-212)**

1. ตรวจว่า meta viewport อยู่ในหน้าหรือไม่

เกณฑ์ตัดสิน:
- ไม่มี viewport meta - ข้อผิดพลาดร้ายแรง
- มี viewport meta - ผ่าน

**WHAT — ตรวจอะไร**

หน้าไม่ได้ตั้งค่าให้ปรับขนาดตามจอมือถือ (viewport) ทำให้เปิดบนมือถือแล้วหน้าเล็กจิ๋วต้องซูมเอง

**WHY — ทำไมต้องตรวจ**

ลูกค้าส่วนใหญ่เข้าเว็บผ่านมือถือ ถ้าหน้าไม่ปรับให้พอดีจอจะใช้งานยากมากและกดออกเร็ว ทั้ง Google ก็ลงโทษเว็บที่ไม่รองรับมือถือ

**อ้างอิง:** [Google: Mobile-first indexing](https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing) · [MDN: Viewport meta tag](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport)


### viewport ห้ามซูม

`On-Page` · ความเชื่อมั่น 90% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 214-215)**

1. ตรวจค่า viewport meta ว่ามี maximum-scale=1 หรือ user-scalable=no ไหม

เกณฑ์ตัดสิน:
- มี maximum-scale=1 หรือ user-scalable=no - เตือนเล็กน้อย

**WHAT — ตรวจอะไร**

หน้าตั้งค่าห้ามผู้ใช้ซูมเข้า-ออกบนมือถือ

**WHY — ทำไมต้องตรวจ**

ผู้สูงอายุหรือคนสายตาไม่ดีจะซูมอ่านไม่ได้ เป็นอุปสรรคการเข้าถึงและทำให้เสียลูกค้ากลุ่มนี้

**อ้างอิง:** [WCAG 2.1: Resize Text (1.4.4)](https://www.w3.org/WAI/WCAG21/Understanding/resize-text.html) · [MDN: Viewport meta tag](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport)


### ไม่มี favicon

`On-Page` · ความเชื่อมั่น 75% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 217)**

1. ตรวจว่าหน้าแรกมี favicon (link rel=icon) หรือไม่

เกณฑ์ตัดสิน:
- หน้าแรกไม่มี favicon - เตือนเล็กน้อย

**WHAT — ตรวจอะไร**

Favicon คือไอคอนเล็กๆ ของเว็บที่โชว์บนแท็บเบราว์เซอร์และตอนบุ๊กมาร์ก เว็บนี้ยังไม่มี

**WHY — ทำไมต้องตรวจ**

เป็นรายละเอียดเล็กๆ ที่ทำให้แบรนด์ดูเป็นมืออาชีพและจำง่าย เวลาลูกค้าเปิดหลายแท็บจะหาเว็บเราเจอง่ายขึ้น

**อ้างอิง:** [Google: Define a favicon](https://developers.google.com/search/docs/appearance/favicon-in-search)


### favicon ไฟล์ผิด

`On-Page` · ความเชื่อมั่น 70% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 775)**

1. ตรวจว่า /favicon.ico ตอบสถานะ HTTP ไหม

เกณฑ์ตัดสิน:
- ตอบ 4xx/5xx - เตือนเล็กน้อย

**WHAT — ตรวจอะไร**

มีการอ้างถึงไอคอนเว็บ (favicon) แต่ไฟล์จริงหาไม่เจอหรือเปิดไม่ได้

**WHY — ทำไมต้องตรวจ**

ทำให้แท็บเบราว์เซอร์ขึ้นไอคอนว่างหรือแตก ดูไม่เรียบร้อย ควรอัปโหลดไฟล์ให้ถูกต้อง

**อ้างอิง:** [Google: Define a favicon](https://developers.google.com/search/docs/appearance/favicon-in-search)


### ไม่มี doctype

`On-Page` · ความเชื่อมั่น 100% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 653-654)**

1. ตรวจว่าแต่ละหน้ามี DOCTYPE html ไหม

เกณฑ์ตัดสิน:
- มีหน้าไม่มี DOCTYPE - เตือนเล็กน้อย

**WHAT — ตรวจอะไร**

หน้าเว็บไม่ได้ประกาศชนิดเอกสารมาตรฐาน (DOCTYPE) ที่บรรทัดแรกของโค้ด

**WHY — ทำไมต้องตรวจ**

อาจทำให้เบราว์เซอร์แสดงผลในโหมดเก่าที่เพี้ยน หน้าตาเว็บอาจผิดเพี้ยนในบางเครื่อง

**อ้างอิง:** [HTML Standard: the DOCTYPE](https://html.spec.whatwg.org/multipage/syntax.html#the-doctype)


### charset ไม่ใช่ UTF-8

`On-Page` · ความเชื่อมั่น 95% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 642-650)**

1. ตรวจ charset ของแต่ละหน้า
2. หาหน้าที่ใช้ charset ไม่ใช่ UTF-8 (เช่น windows-874, TIS-620)

เกณฑ์ตัดสิน:
- มีหน้า charset ไม่ใช่ UTF-8 - เตือนกลาง

**WHAT — ตรวจอะไร**

หน้าไม่ได้ตั้งค่าระบบตัวอักษรเป็นมาตรฐานสากล (UTF-8) ทำให้ภาษาไทยเสี่ยงแสดงเป็นตัวอักษรเพี้ยนมั่วๆ

**WHY — ทำไมต้องตรวจ**

ถ้าภาษาไทยกลายเป็นตัวประหลาดอ่านไม่ออก ลูกค้าจะกดออกทันทีและ Google ก็อ่านเนื้อหาเราไม่รู้เรื่อง

**อ้างอิง:** [WHATWG: Encoding Standard](https://encoding.spec.whatwg.org/) · [HTML Standard: charset declaration](https://html.spec.whatwg.org/multipage/semantics.html#charset)


## Markup/Meta

### meta keywords (ล้าสมัย)

`On-Page` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 724-725)**

1. ตรวจว่าหน้ามี meta keywords tag ไหม

เกณฑ์ตัดสิน:
- มี meta keywords - แจ้งเพื่อทราบ (ไม่มีผล)

**WHAT — ตรวจอะไร**

แท็ก meta keywords คือการใส่คีย์เวิร์ดซ่อนไว้ในโค้ด เป็นเทคนิคยุคเก่าที่ Google เลิกใช้ไปนานแล้ว

**WHY — ทำไมต้องตรวจ**

ไม่ได้ช่วยอันดับเลย แถมบางทีไปบอกใบ้คู่แข่งว่าเราเล็งคำไหนอยู่ ควรเอาออกเพื่อความสะอาดของหน้า

**อ้างอิง:** [Google: We don't use the keywords meta tag](https://developers.google.com/search/blog/2009/09/google-does-not-use-keywords-meta-tag)


### แท็กเลิกใช้แล้ว

`On-Page` · ความเชื่อมั่น 90% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 657-658)**

1. ตรวจว่าหน้ามี deprecated tag (<font>, <center>, <marquee>) ไหม
2. นับจำนวนหน้า

เกณฑ์ตัดสิน:
- มีหน้า deprecated tags - เตือนเล็กน้อย

**WHAT — ตรวจอะไร**

หน้าเว็บยังใช้โค้ดรูปแบบเก่าที่เลิกใช้แล้วตามมาตรฐานปัจจุบัน

**WHY — ทำไมต้องตรวจ**

โค้ดเก่าอาจแสดงผลเพี้ยนในเบราว์เซอร์รุ่นใหม่และดูแลยาก ควรปรับให้เป็นมาตรฐานปัจจุบัน

**อ้างอิง:** [HTML Standard: obsolete features](https://html.spec.whatwg.org/multipage/obsolete.html)


## URL

### URL ไม่สะอาด

`On-Page` · ความเชื่อมั่น 80% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 686-689)**

1. ตรวจ URL path ว่ามีตัวพิมพ์ใหญ่ไหม
2. ตรวจความยาว URL ว่ายาวเกิน 115 ตัวอักษรไหม

เกณฑ์ตัดสิน:
- มี URL ที่ไม่เป็นมิตร - เตือนเล็กน้อย

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

1. ตรวจว่าแต่ละหน้ามี canonical tag ไหม
2. ประเมินความเสี่ยง duplicate โดยดูว่ามี query parameter หรือ title ซ้ำไหม

เกณฑ์ตัดสิน:
- ไม่มี canonical แต่มีความเสี่ยง duplicate - ข้อผิดพลาดร้ายแรง
- ไม่มี canonical แต่ไม่มีความเสี่ยง duplicate - เตือนเล็กน้อย
- มี canonical ครบ - ผ่าน

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

1. ตรวจว่าหน้ามี canonical tag มากกว่า 1 ตัว

เกณฑ์ตัดสิน:
- มี canonical มากกว่า 1 - ข้อผิดพลาดร้ายแรง

**WHAT — ตรวจอะไร**

หน้าเดียวกันใส่ป้ายชี้หน้าตัวจริง (Canonical) ไว้หลายอันและขัดแย้งกัน เหมือนป้ายบอกทางสองป้ายชี้คนละทาง

**WHY — ทำไมต้องตรวจ**

Google สับสนว่าจะเชื่อป้ายไหน สุดท้ายอาจเลือกหน้าผิดมาแสดงหรือไม่เก็บหน้าเราเข้าระบบเลย

**อ้างอิง:** [Google: Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)


### canonical relative

`Indexing` · ความเชื่อมั่น 80% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 667-668)**

1. ตรวจค่า canonical ว่า absolute URL ไหม (ขึ้นต้นด้วย https://)

เกณฑ์ตัดสิน:
- canonical เป็น relative URL - เตือนเล็กน้อย

**WHAT — ตรวจอะไร**

ป้ายชี้หน้าตัวจริง (Canonical) เขียนที่อยู่แบบไม่เต็ม (ไม่ได้ขึ้นต้นด้วย https://...) ซึ่งเสี่ยงตีความผิด

**WHY — ทำไมต้องตรวจ**

ที่อยู่ที่ไม่สมบูรณ์อาจทำให้ Google ชี้ไปผิดหน้า ส่งผลให้หน้าที่ถูกต้องไม่ถูกจัดอันดับ

**อ้างอิง:** [Google: Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) · [RFC 6596: The Canonical Link Relation](https://datatracker.ietf.org/doc/html/rfc6596)


## Robots

### ไม่มี robots.txt

`Indexing` · ความเชื่อมั่น 100% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 235-236)**

1. ตรวจว่า robots.txt มีอยู่ในเว็บหรือไม่

เกณฑ์ตัดสิน:
- ไม่มี robots.txt - เตือนกลาง

**WHAT — ตรวจอะไร**

ไฟล์ robots.txt คือคู่มือต้อนรับสำหรับ Google ที่วางไว้หน้าเว็บ บอกว่าหน้าไหนเข้าได้ หน้าไหนไม่ต้องเข้า เว็บนี้ยังไม่มีไฟล์นี้

**WHY — ทำไมต้องตรวจ**

ไม่ใช่เรื่องร้ายแรงมาก แต่การมีไฟล์นี้ช่วยให้ Google เก็บข้อมูลเว็บได้อย่างมีระเบียบและเร็วขึ้น

**อ้างอิง:** [RFC 9309: Robots Exclusion Protocol](https://datatracker.ietf.org/doc/html/rfc9309) · [Google: Intro to robots.txt](https://developers.google.com/search/docs/crawling-indexing/robots/intro)


### robots ไม่ชี้ sitemap

`Indexing` · ความเชื่อมั่น 80% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 268-270)**

1. ตรวจ robots.txt ว่าอ้างถึง sitemap ในบรรทัด Sitemap: ไหม

เกณฑ์ตัดสิน:
- มี Sitemap: - ผ่าน
- ไม่มี Sitemap: - เตือนเล็กน้อย

**WHAT — ตรวจอะไร**

ในไฟล์คู่มือต้อนรับ (robots.txt) ควรมีบรรทัดบอกที่อยู่ของ "แผนผังเว็บ" (sitemap) ให้ Google แต่ตอนนี้ยังไม่ได้ใส่

**WHY — ทำไมต้องตรวจ**

การชี้ทางไปแผนผังเว็บช่วยให้ Google เจอทุกหน้าได้ครบและเร็วขึ้น โดยเฉพาะหน้าใหม่ๆ

**อ้างอิง:** [sitemaps.org: protocol](https://www.sitemaps.org/protocol.html) · [Google: Sitemaps overview](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview)


### robots บล็อกทั้งเว็บ

`Indexing` · ความเชื่อมั่น 95% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 238-242)**

1. ตรวจข้อมูล robots.txt ว่ามี Disallow: / ลงทะเบียนให้ User-agent: * ไหม

เกณฑ์ตัดสิน:
- มี Disallow: / แบบเหมารวม - ข้อผิดพลาดร้ายแรง
- ไม่มี Disallow: / - ผ่าน

**WHAT — ตรวจอะไร**

ไฟล์คู่มือต้อนรับ Google (robots.txt) ตั้งค่าเป็น "ห้ามเข้าทุกหน้า" — เท่ากับปิดประตูไม่ให้ Google เข้ามาดูเว็บเลย

**WHY — ทำไมต้องตรวจ**

นี่คือปัญหาร้ายแรงที่สุดอย่างหนึ่ง — ถ้าปิดประตูทั้งหมด เว็บจะค่อยๆ หายไปจาก Google ทั้งเว็บ ไม่มีใครค้นเจอเลย

**อ้างอิง:** [RFC 9309: Robots Exclusion Protocol](https://datatracker.ietf.org/doc/html/rfc9309) · [Google: Intro to robots.txt](https://developers.google.com/search/docs/crawling-indexing/robots/intro)


### robots บล็อกบางส่วน

`Indexing` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 246-267)**

1. ตรวจ robots.txt ว่า Googlebot สามารถเข้า section เนื้อหาสำคัญ (/blog, /product, /service) ได้ไหม
2. ตรวจแยกว่า AI bots (GPTBot, ClaudeBot) สามารถเข้าได้ไหม

เกณฑ์ตัดสิน:
- Googlebot ถูกบล็อก - ข้อผิดพลาดร้ายแรง
- Googlebot ได้แต่ AI bots ถูกบล็อก - เตือนกลาง
- ไม่บล็อก Googlebot/AI - ผ่าน

**WHAT — ตรวจอะไร**

ไฟล์คู่มือต้อนรับ Google (robots.txt) สั่งห้าม Google เข้าบางส่วนของเว็บ

**WHY — ทำไมต้องตรวจ**

ถ้าส่วนที่ถูกห้ามคือหน้าสำคัญ (เช่น หน้าสินค้า/บริการ) หน้าเหล่านั้นจะไม่ขึ้น Google เลย ควรตรวจว่าห้ามถูกที่หรือเปล่า

**อ้างอิง:** [RFC 9309: Robots Exclusion Protocol](https://datatracker.ietf.org/doc/html/rfc9309) · [Google: Intro to robots.txt](https://developers.google.com/search/docs/crawling-indexing/robots/intro)


### meta robots ผิด

`Indexing` · ความเชื่อมั่น 90% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 322-343)**

1. อ่านค่า meta robots จากแต่ละหน้า
2. แยก tokens โดยเขียนด้วยลูกน้ำ
3. ตรวจว่า token ใดใช้ directive ที่ไม่ valid หรือ deprecated

เกณฑ์ตัดสิน:
- มี directive ไม่รู้จัก/เลิกใช้ - เตือนกลาง

**WHAT — ตรวจอะไร**

คำสั่งควบคุม Google ที่ฝังในหน้าเขียนผิดรูปแบบหรือสะกดผิด (เช่นพิมพ์ผิดเป็นคำที่ Google ไม่รู้จัก)

**WHY — ทำไมต้องตรวจ**

คำสั่งที่เขียนผิดอาจไม่ทำงาน หรือทำงานผิดจากที่ตั้งใจ เสี่ยงทำให้หน้าหลุดจากระบบ Google โดยไม่ตั้งใจ

**อ้างอิง:** [Google: robots meta tag](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)


### ติด noindex

`Indexing` · ความเชื่อมั่น 95% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 285-319)**

1. ตรวจหน้าที่มี noindex (meta robots หรือ X-Robots-Tag header)
2. จำแนกว่าหน้านี้ดูเหมือน 'utility page' (login/cart/search) หรือ 'content page' (homepage/บทความ) จากเครื่องหมาย URL
3. แยกหน้าที่ตั้งใจมี noindex ออกจาก 'พลาดใส่ noindex โดยไม่ตั้งใจ'

เกณฑ์ตัดสิน:
- มี noindex บนหน้า content ดูเหมือนพลาด - เตือนสูง
- มี noindex บนหน้า utility ทั้งหมด - ผ่าน

ข้อสังเกต: จำแนกเจตนาจาก URL path pattern โดยไม่ได้อ่านจริง ความแน่นอน 60-80%

**WHAT — ตรวจอะไร**

หน้านี้ติดคำสั่ง "ห้าม Google เก็บเข้าระบบ" (noindex) อยู่ เท่ากับสั่ง Google ว่า "อย่าเอาหน้านี้ไปแสดงในผลค้นหา"

**WHY — ทำไมต้องตรวจ**

ถ้าเป็นหน้าสำคัญที่อยากให้คนค้นเจอ การติดคำสั่งนี้คือการทำให้หน้าหายไปจาก Google ทั้งหน้า เสียทราฟฟิกทั้งหมดของหน้านั้น

**อ้างอิง:** [Google: Block indexing (noindex)](https://developers.google.com/search/docs/crawling-indexing/block-indexing) · [Google: robots meta tag](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)


## Sitemap

### ไม่มี sitemap

`Indexing` · ความเชื่อมั่น 95% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 273-275)**

1. ตรวจว่าเว็บมี XML sitemap ไหม
2. พยายาม fetch sitemap จากตำแหน่งมาตรฐาน

เกณฑ์ตัดสิน:
- ไม่มี sitemap - ข้อผิดพลาดกลาง
- มี sitemap - ผ่าน

**WHAT — ตรวจอะไร**

XML Sitemap คือ "แผนผังเว็บ" หรือสารบัญที่ลิสต์ทุกหน้าของเว็บไว้ให้ Google เปิดอ่านทีเดียวครบ เว็บนี้ยังไม่มีไฟล์นี้

**WHY — ทำไมต้องตรวจ**

ถ้าไม่มีสารบัญ Google ต้องไล่คลำหาหน้าเองทีละลิงก์ ทำให้หน้าใหม่ๆ ถูกเก็บเข้าระบบช้ามาก กว่าจะขึ้น Google อาจใช้เวลาหลายสัปดาห์

**อ้างอิง:** [sitemaps.org: protocol](https://www.sitemaps.org/protocol.html) · [Google: Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)


### sitemap ไม่ครอบคลุม

`Indexing` · ความเชื่อมั่น 80% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 277-283)**

1. เปรียบเทียบ URL ที่ crawl เจอกับ URL ในไฟล์ sitemap
2. คิดเปอร์เซ็นต์ความครอบคลุม

เกณฑ์ตัดสิน:
- sitemap ครอบคลุมไม่ถึง 70% - เตือนเล็กน้อย

**WHAT — ตรวจอะไร**

แผนผังเว็บ (sitemap) มีอยู่ แต่ลิสต์หน้าไม่ครบ — บางหน้าที่มีจริงไม่ได้ถูกใส่ในสารบัญ

**WHY — ทำไมต้องตรวจ**

หน้าที่ไม่อยู่ในสารบัญมีโอกาสถูก Google มองข้าม ทำให้หน้านั้นไม่ขึ้นผลค้นหา

**อ้างอิง:** [Google: Sitemaps overview](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview)


### sitemap ไม่มี lastmod

`Indexing` · ความเชื่อมั่น 80% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 778-779)**

1. ตรวจว่า sitemap มี <lastmod> tag ไหม

เกณฑ์ตัดสิน:
- sitemap ไม่มี lastmod - เตือนเล็กน้อย

**WHAT — ตรวจอะไร**

แผนผังเว็บ (sitemap) ไม่ได้ระบุวันที่อัปเดตล่าสุดของแต่ละหน้า

**WHY — ทำไมต้องตรวจ**

การบอกวันที่อัปเดตช่วยให้ Google รู้ว่าหน้าไหนมีของใหม่ ควรกลับมาดูซ้ำ ทำให้เนื้อหาใหม่ขึ้น Google เร็วขึ้น

**อ้างอิง:** [sitemaps.org: protocol](https://www.sitemaps.org/protocol.html)


## Hreflang

### hreflang ผิด/ไม่มี

`Indexing` · ความเชื่อมั่น 90% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 388-409)**

1. ตรวจว่าเว็บมี hreflang tags ไหม
2. ถ้ามี ตรวจว่ามี x-default ไหม
3. ถ้าไม่มี hreflang แต่มี URL หลายภาษา ให้เตือน

เกณฑ์ตัดสิน:
- มี hreflang แต่ไม่มี x-default - เตือน
- มี hreflang ครบ - ผ่าน
- ไม่มี hreflang แต่มี URL หลายภาษา - เตือนกลาง

**WHAT — ตรวจอะไร**

hreflang คือป้ายบอก Google ว่าหน้าไหนเป็นเวอร์ชันภาษาไทย หน้าไหนเป็นภาษาอังกฤษ สำหรับเว็บที่มีหลายภาษา

**WHY — ทำไมต้องตรวจ**

ถ้าตั้งค่าไม่ถูก Google อาจเอาหน้าภาษาอังกฤษไปแสดงให้คนไทย หรือสลับกัน ทำให้ลูกค้าเจอหน้าผิดภาษาแล้วกดออก

**อ้างอิง:** [Google: Localized versions (hreflang)](https://developers.google.com/search/docs/specialty/international/localized-versions)


## Redirects

### redirect ซ้อน

`Indexing` · ความเชื่อมั่น 95% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 369-370)**

1. ตรวจแต่ละหน้าว่ามี redirect chain (redirect ต่อกัน) ไหม
2. นับจำนวน redirect hop

เกณฑ์ตัดสิน:
- มี redirect chain เกิน 1 hop - เตือนกลาง

**WHAT — ตรวจอะไร**

การเด้งหน้าต่อกันหลายทอด เช่น หน้า A เด้งไป B, B เด้งไป C กว่าจะถึงปลายทางจริง เหมือนโทรหาเบอร์หนึ่งแล้วถูกโอนสายต่อ 3-4 ครั้ง

**WHY — ทำไมต้องตรวจ**

ทุกการเด้งทำให้หน้าโหลดช้าลงและคะแนนรั่วไหลทีละนิด ลูกค้าบนมือถือที่เน็ตช้าอาจกดออกก่อนหน้าจะโหลดเสร็จ

**อ้างอิง:** [Google: Redirects and Google Search](https://developers.google.com/search/docs/crawling-indexing/301-redirects) · [RFC 9110: Redirection 3xx](https://datatracker.ietf.org/doc/html/rfc9110#section-15.4)


### trailing slash ไม่นิ่ง

`Indexing` · ความเชื่อมั่น 80% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 691-701)**

1. เปรียบเทียบ URL ที่ตอบ 200 ทั้งแบบมี/ ท้ายและไม่มี
2. หาคู่ URL ที่ซ้ำจาก trailing slash

เกณฑ์ตัดสิน:
- มี URL ซ้ำจาก trailing slash - เตือนกลาง

**WHAT — ตรวจอะไร**

ที่อยู่หน้าเว็บมีทั้งแบบมีและไม่มีเครื่องหมาย / ต่อท้าย ชี้ไปหน้าเดียวกัน เช่น /about กับ /about/

**WHY — ทำไมต้องตรวจ**

Google อาจนับเป็นสองหน้าซ้ำกัน ควรเลือกใช้แบบเดียวให้สม่ำเสมอเพื่อไม่ให้คะแนนกระจาย

**อ้างอิง:** [Google: URL structure best practices](https://developers.google.com/search/docs/crawling-indexing/url-structure) · [Google: Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)


### www/non-www ซ้ำ

`Indexing` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 750-772)**

1. ตรวจ variant ของโดเมน (www/non-www, http/https)
2. ตรวจว่า variant ตอบ 200 ทั้งหมดหรือ redirect ไหม
3. ตรวจว่ามี canonical ชี้โดเมนหลัก

เกณฑ์ตัดสิน:
- variant ตอบ 200 โดยไม่ redirect - ข้อผิดพลาดร้ายแรง (หรือ เตือนกลาง ถ้ามี canonical)
- variant ไม่เข้าถึง - เตือนกลาง
- variant รวมร่างถูกต้อง - ผ่าน

**WHAT — ตรวจอะไร**

เว็บเปิดได้หลายแบบที่อยู่ เช่นมีทั้งแบบมี www และไม่มี www หรือทั้ง http และ https ทั้งที่ควรเหลือแบบเดียว

**WHY — ทำไมต้องตรวจ**

Google อาจมองว่าเป็นหลายเว็บแยกกันที่เนื้อหาซ้ำ ทำให้คะแนนกระจาย ควรรวมให้เหลือที่อยู่หลักแบบเดียว

**อ้างอิง:** [Google: Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)


### meta refresh redirect

`Indexing` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 661-662)**

1. ตรวจว่าหน้ามี meta refresh tag ไหม

เกณฑ์ตัดสิน:
- มี meta refresh - เตือนกลาง

**WHAT — ตรวจอะไร**

หน้าใช้วิธีเด้งไปหน้าอื่นแบบเก่า (meta refresh) เช่นเปิดมาแล้วนับถอยหลังเด้งไปอีกหน้า

**WHY — ทำไมต้องตรวจ**

เป็นวิธีล้าสมัยที่ Google ไม่แนะนำ ทำให้การส่งต่อคะแนนระหว่างหน้าไม่สมบูรณ์ ควรเปลี่ยนเป็นการเด้งหน้าแบบมาตรฐาน

**อ้างอิง:** [Google: Redirects and Google Search](https://developers.google.com/search/docs/crawling-indexing/301-redirects) · [HTML Standard: meta http-equiv refresh](https://html.spec.whatwg.org/multipage/semantics.html#attr-meta-http-equiv-refresh)


## Crawlability

### ถูกบล็อก crawl

`Indexing` · ความเชื่อมั่น 90% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 376-378)**

1. ตรวจ URL ที่ตอบ 429/403/5xx (บล็อกบอท หรือ rate-limit อื่นๆ)

เกณฑ์ตัดสิน:
- พบ error 429/403/5xx - แจ้งเพื่อทราบ (อาจชั่วคราว)

**อ้างอิง:** [Google: Overview of Google crawlers](https://developers.google.com/crawling/docs/crawlers-fetchers/overview-google-crawlers) · [Google: Intro to robots.txt](https://developers.google.com/search/docs/crawling-indexing/robots/intro)


### soft 404

`Indexing` · ความเชื่อมั่น 90% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 380-381)**

1. ตรวจว่า URL ที่ไม่มีจริง (404) ตอบสถานะ HTTP ไหม
2. ตรวจว่าตอบ 404 จริงหรือ 200 (soft 404)

เกณฑ์ตัดสิน:
- ตอบ 200 แทนที่จะเป็น 404 - เตือนกลาง

**WHAT — ตรวจอะไร**

หน้าที่ไม่มีอยู่จริง ควรตอบกลับว่า "ไม่พบหน้า (404)" แต่กลับตอบว่า "ปกติดี (200)" หรือเด้งไปหน้าแรกแทน เหมือนร้านที่ปิดไปแล้วแต่ป้ายยังเขียนว่าเปิด

**WHY — ทำไมต้องตรวจ**

Google จะเก็บหน้าขยะเหล่านี้เข้าระบบ ทำให้คุณภาพเว็บโดยรวมในสายตา Google ลดลง และเปลืองโควต้าที่ Google ใช้เก็บหน้าจริงที่สำคัญ

**อ้างอิง:** [Google: HTTP status & network errors](https://developers.google.com/crawling/docs/troubleshooting/http-status-codes)


### หน้า error

`Indexing` · ความเชื่อมั่น 95% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 374-378)**

1. ตรวจ URL ที่ตอบ 404 หรือ 410 (หน้าหายจริง)
2. คัด out URL ที่ตอบ 429/403/5xx (ชั่วคราว) แยกต่างหาก

เกณฑ์ตัดสิน:
- พบ URL ตอบ 404/410 - ข้อผิดพลาดร้ายแรง
- พบ URL ตอบ 429/403/5xx - แจ้งเพื่อทราบ (ชั่วคราว)

**WHAT — ตรวจอะไร**

พบหน้าที่เปิดแล้วเจอข้อผิดพลาด (error) ตอบกลับเป็นรหัสฝั่งเซิร์ฟเวอร์ผิดพลาด

**WHY — ทำไมต้องตรวจ**

หน้าที่พังทำให้ทั้งลูกค้าและ Google เจอทางตัน เสียประสบการณ์และเสียโอกาสขาย ควรรีบแก้ให้กลับมาใช้งานได้

**อ้างอิง:** [RFC 9110: HTTP Semantics](https://datatracker.ietf.org/doc/html/rfc9110) · [Google: HTTP status & network errors](https://developers.google.com/crawling/docs/troubleshooting/http-status-codes)


### เข้าหน้าเว็บไม่ได้

`Indexing` · ความเชื่อมั่น 100% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 95-99)**

1. พยายาม crawl เว็บไปเจอว่า URL ตอบสถานะที่ไม่ใช่ 200 ทั้งหมด
2. นับจำนวนหน้าที่ได้มาจริงว่า 0 หน้า

เกณฑ์ตัดสิน:
- ไม่พบหน้าเว็บปกติแม่แต่หน้าเดียว - ข้อผิดพลาดร้ายแรง เว็บไม่ตอบปกติ

**อ้างอิง:** [RFC 9110: HTTP Semantics](https://datatracker.ietf.org/doc/html/rfc9110) · [Google: HTTP status & network errors](https://developers.google.com/crawling/docs/troubleshooting/http-status-codes)


## Duplicate Content

### หน้าซ้ำใกล้เคียง

`Indexing` · ความเชื่อมั่น 80% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 728-738)**

1. เปรียบเทียบเนื้อหา 2 หน้า โดยใช้ Jaccard similarity
2. หาคู่หน้าที่มีเนื้อหาเหมือนกันเกิน 85%

เกณฑ์ตัดสิน:
- มีหน้าเนื้อหาเกือบซ้ำ - เตือนกลาง

**WHAT — ตรวจอะไร**

มีหลายหน้าที่เนื้อหาคล้ายกันมากจนเกือบเหมือนกัน เหมือนถ่ายเอกสารหน้าเดิมแล้วเปลี่ยนแค่หัวข้อนิดหน่อย

**WHY — ทำไมต้องตรวจ**

Google ไม่ชอบเนื้อหาซ้ำ และจะเลือกแสดงแค่หน้าเดียว หน้าที่เหลือถูกมองข้าม ทำให้เราเสียพื้นที่บนหน้าค้นหาไปเปล่าๆ

**DEPENDENCIES (ต้องผ่านก่อน):** `Final URL` · `Canonical`

**อ้างอิง:** [Google: Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) · [Moz: Duplicate content](https://moz.com/learn/seo/duplicate-content)


## Internal Links

### ลิงก์เสีย (hard)

`Indexing` · ความเชื่อมั่น 90% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 476-481)**

1. ตรวจลิงก์ภายในทั้งเว็บ
2. ตรวจว่าลิงก์ชี้ไปหน้า 404/410 หรือไม่
3. แยก เหายจริง (404/410) ออกจาก ชั่วคราว (429/403/5xx)

เกณฑ์ตัดสิน:
- มีลิงก์ชี้ไปหน้า 404/410 - ข้อผิดพลาดร้ายแรง
- มีลิงก์ชั่วคราวตอบ 429/403/5xx - แจ้งเพื่อทราบ
- ไม่มีลิงก์เสีย - ผ่าน

**WHAT — ตรวจอะไร**

ลิงก์ภายในเว็บที่กดแล้วพาไปหน้าที่พังหรือไม่มีอยู่จริง (เจอหน้า error) เหมือนป้ายบอกทางในห้างที่ชี้ไปร้านที่ปิดไปแล้ว

**WHY — ทำไมต้องตรวจ**

ลูกค้าที่กดแล้วเจอหน้าพังจะรู้สึกหงุดหงิดและอาจเลิกเที่ยวชมเว็บทันที ทั้งยังทำให้ Google มองว่าเว็บดูแลไม่ดี กระทบความน่าเชื่อถือโดยรวม

**อ้างอิง:** [RFC 9110: 404 Not Found](https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.5) · [Google: Make your links crawlable](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)


### ลิงก์เสีย (soft)

`Indexing` · ความเชื่อมั่น 80% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 481)**

1. ตรวจลิงก์ที่ตอบ 429/403/5xx (ชั่วคราว)

เกณฑ์ตัดสิน:
- มีลิงก์ชั่วคราวตอบ error - แจ้งเพื่อทราบ

**อ้างอิง:** [Google: HTTP status & network errors](https://developers.google.com/crawling/docs/troubleshooting/http-status-codes)


### หน้ากำพร้า

`Indexing` · ความเชื่อมั่น 70% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 741-747)**

1. ตรวจว่าแต่ละหน้ามี internal link ชี้เข้ามาจากหน้าอื่นไหม
2. ตัด homepage และ startUrl ออก
3. หาหน้าที่ไม่มี internal link จาก sitemap เท่านั้น

เกณฑ์ตัดสิน:
- มีหน้า orphan - เตือนกลาง

**WHAT — ตรวจอะไร**

หน้ากำพร้า คือหน้าที่มีอยู่จริงแต่ไม่มีลิงก์จากหน้าอื่นในเว็บชี้มาหาเลย เหมือนห้องลับที่ไม่มีประตูเข้า

**WHY — ทำไมต้องตรวจ**

ถ้าไม่มีลิงก์ชี้มา ทั้งลูกค้าและ Google แทบจะหาหน้านี้ไม่เจอ เท่ากับทำหน้าไว้แต่ไม่มีใครได้ใช้

**อ้างอิง:** [Ahrefs: Orphan pages](https://ahrefs.com/blog/orphan-pages/) · [Google: Make your links crawlable](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)


### internal link น้อย

`Indexing` · ความเชื่อมั่น 70% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 492-493)**

1. นับ internal link (ลิงก์ไป URL เดียวกันโดเมน) ในแต่ละหน้า
2. หาหน้าที่มี internal link น้อยกว่า 3

เกณฑ์ตัดสิน:
- มีหน้า internal link น้อยกว่า 3 - เตือนกลาง

**WHAT — ตรวจอะไร**

หน้าต่างๆ ในเว็บเชื่อมโยงถึงกันด้วยลิงก์ภายในน้อยเกินไป เหมือนห้างที่แต่ละร้านไม่มีป้ายบอกทางไปร้านอื่น

**WHY — ทำไมต้องตรวจ**

ลิงก์ภายในช่วยทั้งลูกค้าเดินดูเว็บต่อ (เพิ่มโอกาสขาย) และช่วย Google ไหลคะแนนไปยังหน้าสำคัญ ยิ่งเชื่อมดีหน้าสำคัญยิ่งติดอันดับง่าย

**อ้างอิง:** [Ahrefs: Internal links for SEO](https://ahrefs.com/blog/internal-links-for-seo/) · [Google: Make your links crawlable](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)


### anchor ว่าง

`Indexing` · ความเชื่อมั่น 85% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 483-485)**

1. ตรวจลิงก์ทั้งเว็บ ว่ามี anchor text ไหม
2. นับลิงก์ที่ไม่มี text

เกณฑ์ตัดสิน:
- มีลิงก์ที่ไม่มี anchor text - เตือนกลาง

**WHAT — ตรวจอะไร**

มีลิงก์ที่กดได้แต่ไม่มีข้อความบอกว่าลิงก์ไปไหน (ลิงก์เปล่า เช่นเป็นแค่ไอคอนหรือช่องว่าง)

**WHY — ทำไมต้องตรวจ**

ทั้ง Google และผู้พิการที่ใช้โปรแกรมอ่านหน้าจอจะไม่รู้ว่าลิงก์นี้พาไปไหน เสียทั้งคะแนนและการเข้าถึง

**อ้างอิง:** [WCAG 2.1: Link Purpose (2.4.4)](https://www.w3.org/WAI/WCAG21/Understanding/link-purpose-in-context.html) · [Google: Make your links crawlable](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)


### anchor กว้างไป

`Indexing` · ความเชื่อมั่น 70% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 487-490)**

1. ตรวจลิงก์ว่าใช้ generic words (คลิกที่นี่, read more) ไหม
2. นับลิงก์ generic ต่อหน้า

เกณฑ์ตัดสิน:
- หน้าใดมี generic anchor เกิน 2 ตัว - เตือนเล็กน้อย

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

1. ตรวจว่าหน้ามี JSON-LD script ไหม
2. นับเปอร์เซ็นต์หน้าที่มี JSON-LD

เกณฑ์ตัดสิน:
- ไม่มี JSON-LD เลย - ข้อผิดพลาดร้ายแรง
- มี JSON-LD แต่ไม่ครบทั้งเว็บ - เตือนสูง
- มี JSON-LD ครบตามเกณฑ์ - ผ่าน

**WHAT — ตรวจอะไร**

Structured Data (JSON-LD) คือข้อมูลเสริมที่ฝังในหน้าแบบที่ "เครื่องอ่านได้" บอก Google ตรงๆ ว่าหน้านี้คือสินค้าอะไร ราคาเท่าไร ร้านชื่ออะไร มีรีวิวกี่ดาว เหมือนติดป้ายฉลากสินค้าที่เครื่องสแกนอ่านได้ทันที เว็บนี้ยังไม่มีเลยสักหน้า

**WHY — ทำไมต้องตรวจ**

ถ้าไม่มีฉลากนี้ จะเสีย 2 อย่างใหญ่: (1) เสีย "ผลการค้นหาแบบพิเศษ" บน Google เช่น ดาวรีวิว ราคา รูปสินค้า ที่ทำให้ผลของเราเด่นกว่าคู่แข่งและคนกดเยอะกว่า (2) เมื่อมีคนถาม ChatGPT หรือ AI ต่างๆ เกี่ยวกับธุรกิจแบบเรา AI จะไม่มีข้อมูลที่เป็นระเบียบให้ดึงไปตอบ เลยไปอ้างอิงเว็บคู่แข่งที่ติดฉลากไว้แทน

**อ้างอิง:** [Google: Intro to structured data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data) · [Schema.org](https://schema.org/) · [W3C: JSON-LD 1.1](https://www.w3.org/TR/json-ld11/)


### JSON-LD ผิดรูปแบบ

`Schema` · ความเชื่อมั่น 100% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 419-420)**

1. ตรวจ JSON-LD syntax ว่า parse ได้ไหม
2. นับหน้าที่มี JSON-LD ไวยากรณ์ผิด

เกณฑ์ตัดสิน:
- มี JSON-LD ไวยากรณ์ผิด - ข้อผิดพลาดร้ายแรง

**WHAT — ตรวจอะไร**

มีการติดฉลากข้อมูลให้เครื่องอ่าน (Structured Data) แล้ว แต่เขียนผิดรูปแบบ ทำให้ Google อ่านไม่ได้

**WHY — ทำไมต้องตรวจ**

ฉลากที่เสียเท่ากับไม่ได้ติด — เสียโอกาสได้ผลค้นหาแบบพิเศษ (ดาว/ราคา/รูป) และอาจโดน Google เตือนว่าเว็บมีข้อผิดพลาด

**อ้างอิง:** [W3C: JSON-LD 1.1](https://www.w3.org/TR/json-ld11/) · [Google: Intro to structured data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)


## Structured Data

### Organization schema

`Schema` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 428-430)**

1. ตรวจว่ามี Organization/LocalBusiness/Corporation schema ไหม

เกณฑ์ตัดสิน:
- มี Organization/LocalBusiness schema - ผ่าน
- ไม่มี - ข้อผิดพลาดกลาง

**WHAT — ตรวจอะไร**

Organization schema คือฉลากข้อมูลที่บอก Google และ AI ว่า "บริษัทเราคือใคร" ชื่อเต็ม โลโก้ ที่อยู่ ช่องทางติดต่อ โซเชียล เว็บนี้ยังไม่ได้ติดฉลากนี้

**WHY — ทำไมต้องตรวจ**

ถ้าไม่มี Google และ AI จะไม่รู้จักตัวตนแบรนด์เรา ทำให้พลาดกล่องข้อมูลบริษัทด้านขวาของหน้า Google (Knowledge Panel) และเมื่อคนถาม AI ว่า "บริษัทนี้คือใคร" AI จะไม่มีข้อมูลยืนยันตัวตนของเรา

**อ้างอิง:** [Google: Organization structured data](https://developers.google.com/search/docs/appearance/structured-data/organization) · [Schema.org: Organization](https://schema.org/Organization)


### Breadcrumb schema

`Schema` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 431-433)**

1. ตรวจว่ามี BreadcrumbList schema ไหม

เกณฑ์ตัดสิน:
- มี BreadcrumbList - ผ่าน
- ไม่มี - เตือนเล็กน้อย

**WHAT — ตรวจอะไร**

Breadcrumb schema คือฉลากบอกเส้นทางหน้า เช่น หน้าแรก › สินค้า › รองเท้า ให้ Google แสดงเส้นทางนี้ในผลค้นหา

**WHY — ทำไมต้องตรวจ**

ช่วยให้ผลค้นหาของเราดูเป็นระเบียบและน่ากดขึ้น และช่วยลูกค้าเข้าใจว่าหน้านี้อยู่ตรงไหนของเว็บ

**อ้างอิง:** [Google: Breadcrumb structured data](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb) · [Schema.org: BreadcrumbList](https://schema.org/BreadcrumbList)


### schema ไม่ครบ field

`Schema` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 436-461)**

1. วิเคราะห์ JSON-LD schema ว่า required property ครบไหม
2. แยก errors (ขาดสิ่งจำเป็น) กับ warnings (ขาด recommended)

เกณฑ์ตัดสิน:
- ขาด required property - ข้อผิดพลาดร้ายแรง
- ขาด recommended property - เตือนเล็กน้อย
- ครบตามเกณฑ์ - ผ่าน

**WHAT — ตรวจอะไร**

มีการติดฉลากข้อมูลให้เครื่องอ่าน (Structured Data) แล้ว แต่ใส่ข้อมูลไม่ครบตามที่ Google ต้องการ เช่น ติดฉลากสินค้าแต่ลืมใส่ราคา

**WHY — ทำไมต้องตรวจ**

ฉลากที่ข้อมูลไม่ครบ Google อาจไม่ยอมแสดงผลแบบพิเศษให้ เท่ากับลงแรงติดฉลากแล้วแต่ยังไม่ได้ประโยชน์เต็มที่

**อ้างอิง:** [Google: Intro to structured data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data) · [Schema.org](https://schema.org/)


## Social Cards

### Open Graph

`Schema` · ความเชื่อมั่น 80% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 464-467)**

1. ตรวจว่าหน้ามี og:title และ og:image ไหม
2. นับหน้าที่ขาด Open Graph

เกณฑ์ตัดสิน:
- ขาด og:title หรือ og:image ในหลายหน้า - ข้อผิดพลาดกลาง หรือ เตือน
- มี Open Graph ครบ - ผ่าน

**WHAT — ตรวจอะไร**

Open Graph คือข้อมูลที่กำหนดว่า "เวลาแชร์ลิงก์เว็บนี้ลง Facebook, LINE, X จะขึ้นรูปและข้อความอะไร" เว็บนี้ใส่ไม่ครบ ทำให้แชร์แล้วไม่มีรูปหรือหัวข้อ

**WHY — ทำไมต้องตรวจ**

เวลาลูกค้าหรือเพจแชร์ลิงก์เรา ถ้าขึ้นมาเป็นลิงก์เปล่าๆ ไม่มีรูป ไม่มีหัวข้อ จะดูไม่น่าเชื่อถือและแทบไม่มีใครกด เสียโอกาสกระจายผ่านโซเชียลฟรีๆ

**อ้างอิง:** [The Open Graph protocol](https://ogp.me/)


### og:image เป็น relative

`Schema` · ความเชื่อมั่น 80% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 782-783)**

1. ตรวจค่า og:image ว่า absolute URL ไหม (ขึ้นต้นด้วย https://)

เกณฑ์ตัดสิน:
- og:image เป็น relative URL - เตือนเล็กน้อย

**WHAT — ตรวจอะไร**

รูปที่จะโชว์ตอนแชร์ลิงก์ (Open Graph image) ใส่ที่อยู่แบบไม่เต็ม ทำให้บางแพลตฟอร์มหารูปไม่เจอ

**WHY — ทำไมต้องตรวจ**

แชร์ไปแล้วรูปอาจไม่ขึ้น ทำให้โพสต์ดูโล่งและน่ากดน้อยลง ควรใส่ที่อยู่รูปแบบเต็ม

**อ้างอิง:** [The Open Graph protocol](https://ogp.me/)


### Twitter Card

`Schema` · ความเชื่อมั่น 70% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 469-470)**

1. ตรวจว่าหน้ามี twitter:card meta tag ไหม

เกณฑ์ตัดสิน:
- ไม่มี twitter:card ทั้งเว็บ - เตือนเล็กน้อย

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

1. ตรวจว่าเว็บเสิร์ฟผ่าน HTTPS หรือ HTTP

เกณฑ์ตัดสิน:
- ใช้ HTTPS - ผ่าน
- ใช้ HTTP - ข้อผิดพลาดร้ายแรง

**WHAT — ตรวจอะไร**

HTTPS คือการเข้ารหัสเว็บให้ปลอดภัย (สังเกตจากรูปกุญแจหน้าที่อยู่เว็บ) หน้าบางส่วนของเว็บนี้ยังไม่ปลอดภัย

**WHY — ทำไมต้องตรวจ**

เบราว์เซอร์จะขึ้นเตือน "เว็บไม่ปลอดภัย" ตัวแดงๆ ทำให้ลูกค้าตกใจและไม่กล้ากรอกข้อมูลหรือชำระเงิน ทั้งยัง Google จัดอันดับเว็บปลอดภัยดีกว่า

**อ้างอิง:** [Google: HTTPS as a ranking signal](https://developers.google.com/search/blog/2014/08/https-as-ranking-signal) · [RFC 9110: HTTP Semantics](https://datatracker.ietf.org/doc/html/rfc9110)


### SSL chain ไม่ครบ

`Security` · ความเชื่อมั่น 95% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 229-233)**

1. ตรวจว่า certificate chain ครบถ้วนหรือไม่ (leaf + intermediate)
2. ตั้งข้อสังเกตถ้า crawl พบ certificate chain ไม่ครบ

เกณฑ์ตัดสิน:
- ใบรับรอง SSL ส่งไม่ครบสาย - ข้อผิดพลาดร้ายแรง

**อ้างอิง:** [RFC 8446: TLS 1.3](https://datatracker.ietf.org/doc/html/rfc8446) · [MDN: Transport Layer Security](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Transport_Layer_Security)


### mixed content

`Security` · ความเชื่อมั่น 100% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 383-386)**

1. ตรวจหน้า HTTPS ว่า load resource ผ่าน HTTP (script/style/image) ไหม

เกณฑ์ตัดสิน:
- มีหน้า HTTPS ที่ load HTTP resource - ข้อผิดพลาดกลาง

**WHAT — ตรวจอะไร**

หน้าที่ปลอดภัย (HTTPS) แต่ยังดึงบางส่วน (เช่นรูปหรือสคริปต์) มาจากช่องทางที่ไม่ปลอดภัย เหมือนบ้านที่ล็อกประตูหน้าแต่เปิดหน้าต่างหลังทิ้งไว้

**WHY — ทำไมต้องตรวจ**

เบราว์เซอร์อาจขึ้นเตือนว่าหน้าไม่ปลอดภัยเต็มที่ หรือบล็อกบางส่วนไม่ให้แสดง ทำให้หน้าดูพังและลดความน่าเชื่อถือ

**อ้างอิง:** [W3C: Mixed Content](https://www.w3.org/TR/mixed-content/) · [MDN: Mixed content](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Mixed_content)


## Security Headers

### ขาด security headers

`Security` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 585-595)**

1. ตรวจ header ความปลอดภัยของหน้าแรก
2. ตรวจ HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy

เกณฑ์ตัดสิน:
- ขาด security headers - เตือนเล็กน้อย
- มี security headers ครบ - ผ่าน

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

1. วัดเวลา TTFB (Time To First Byte) ของแต่ละหน้า
2. หาหน้าที่ใช้เวลาเกิน 3 วินาที

เกณฑ์ตัดสิน:
- มีหน้าตอบช้า - เตือนกลาง

**WHAT — ตรวจอะไร**

TTFB คือเวลาที่เซิร์ฟเวอร์ใช้ตอบสนองครั้งแรกหลังคนกดเข้าเว็บ (ก่อนหน้าจะเริ่มแสดงอะไรด้วยซ้ำ) ของเว็บนี้ช้ากว่าเกณฑ์

**WHY — ทำไมต้องตรวจ**

ถ้าเซิร์ฟเวอร์ตอบช้าตั้งแต่วินาทีแรก ทุกอย่างหลังจากนั้นก็ช้าตาม ลูกค้าบนมือถือมักใจร้อน รอเกิน 3 วินาทีก็กดออกแล้ว

**อ้างอิง:** [web.dev: Time to First Byte (TTFB)](https://web.dev/articles/ttfb) · [Google: Core Web Vitals report](https://developers.google.com/search/docs/appearance/core-web-vitals)


## Payload

### ไม่บีบอัด (gzip/br)

`Performance` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 570-573)**

1. ตรวจ Content-Encoding header ในทุกหน้า ว่ามี gzip/brotli ไหม

เกณฑ์ตัดสิน:
- ไม่มี compression ในทั้งเว็บ - เตือนกลาง
- มี compression - ผ่าน

**WHAT — ตรวจอะไร**

เว็บยังไม่ได้เปิดการบีบอัดไฟล์ก่อนส่งให้ผู้ใช้ (เหมือนส่งของโดยไม่ได้แพ็กให้กระชับ) ทำให้ไฟล์ที่ส่งใหญ่กว่าที่ควร

**WHY — ทำไมต้องตรวจ**

การเปิดบีบอัดเป็นวิธีง่ายๆ ที่ทำให้เว็บโหลดเร็วขึ้นทันทีโดยไม่ต้องแก้เนื้อหา ช่วยทั้งอันดับและประสบการณ์ลูกค้า

**อ้างอิง:** [Lighthouse: Enable text compression](https://developer.chrome.com/docs/lighthouse/performance/uses-text-compression)


### HTML ใหญ่เกิน

`Performance` · ความเชื่อมั่น 80% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 564-565)**

1. วัดขนาด HTML ของแต่ละหน้า
2. หาหน้าที่ใหญ่เกิน 500 KB

เกณฑ์ตัดสิน:
- มีหน้า HTML ใหญ่เกิน 500 KB - เตือนกลาง

**WHAT — ตรวจอะไร**

โค้ดของหน้าเว็บมีขนาดใหญ่เกินไป ทำให้ดาวน์โหลดและประมวลผลช้า

**WHY — ทำไมต้องตรวจ**

หน้าที่หนักทำให้โหลดช้าโดยเฉพาะบนมือถือและเน็ตช้า ส่งผลให้ลูกค้ารอนานและ Google ให้คะแนนความเร็วต่ำ

**อ้างอิง:** [Lighthouse: Avoid enormous network payloads](https://developer.chrome.com/docs/lighthouse/performance/total-byte-weight)


### inline CSS/JS เยอะ

`Performance` · ความเชื่อมั่น 70% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 578-579)**

1. นับขนาด inline script และ inline style ต่อหน้า
2. หาหน้าที่รวมเกิน 200 KB

เกณฑ์ตัดสิน:
- มีหน้า inline bloat - เตือนเล็กน้อย

**WHAT — ตรวจอะไร**

หน้ามีโค้ดตกแต่ง/สคริปต์เขียนปนอยู่ในตัวหน้าเยอะเกินไป แทนที่จะแยกเป็นไฟล์ต่างหากที่เบราว์เซอร์จำไว้ใช้ซ้ำได้

**WHY — ทำไมต้องตรวจ**

ทำให้ทุกหน้าหนักขึ้นและโหลดช้าซ้ำๆ เพราะเบราว์เซอร์เก็บไว้ใช้ซ้ำไม่ได้ กระทบความเร็วโดยรวม

**อ้างอิง:** [Lighthouse: Eliminate render-blocking resources](https://developer.chrome.com/docs/lighthouse/performance/render-blocking-resources) · [Lighthouse: Avoid enormous network payloads](https://developer.chrome.com/docs/lighthouse/performance/total-byte-weight)


### script เยอะ

`Performance` · ความเชื่อมั่น 70% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 567-568)**

1. นับจำนวน script tag ในแต่ละหน้า
2. หาหน้าที่มีเกิน 25 script files

เกณฑ์ตัดสิน:
- มีหน้า script เกิน 25 ไฟล์ - เตือนกลาง

**WHAT — ตรวจอะไร**

หน้าโหลดสคริปต์ (โปรแกรมเล็กๆ ที่ทำให้เว็บทำงาน) จำนวนมากเกินไป

**WHY — ทำไมต้องตรวจ**

ยิ่งสคริปต์เยอะ หน้ายิ่งใช้เวลาประมวลผลนานก่อนพร้อมใช้งาน ลูกค้าต้องรอนานขึ้นกว่าจะกดอะไรได้

**อ้างอิง:** [Lighthouse: Avoid an excessive DOM size](https://developer.chrome.com/docs/lighthouse/performance/dom-size)


### อัตรา text:HTML ต่ำ

`Performance` · ความเชื่อมั่น 60% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 715-716)**

1. คิดสัดส่วนระหว่างข้อความจริงต่อขนาด HTML ไฟล์
2. ตรวจว่าต่ำไม่ถึง 8% และ HTML มากเกิน 60 KB

เกณฑ์ตัดสิน:
- สัดส่วน text-to-HTML ต่ำมาก - เตือนเล็กน้อย

**WHAT — ตรวจอะไร**

สัดส่วนระหว่าง "ตัวหนังสือจริงที่คนอ่าน" กับ "โค้ดเบื้องหลังหน้าเว็บ" ถ้าหน้ามีโค้ดเยอะแต่ตัวหนังสือน้อย แปลว่าหน้าหนักแต่เนื้อหาจริงนิดเดียว

**WHY — ทำไมต้องตรวจ**

หน้าที่มีเนื้อหาน้อยเมื่อเทียบกับขนาดไฟล์ มักโหลดช้าและให้คุณค่ากับผู้อ่านน้อย ส่งผลเสียทั้งต่ออันดับและประสบการณ์ลูกค้า

**อ้างอิง:** [Lighthouse: Avoid enormous network payloads](https://developer.chrome.com/docs/lighthouse/performance/total-byte-weight)


## Render-blocking

### blocking ใน <head>

`Performance` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 711-712)**

1. ตรวจ script ใน <head> ว่ามี defer/async ไหม
2. นับจำนวน blocking script เกิน 2

เกณฑ์ตัดสิน:
- มี blocking script ใน head - เตือนกลาง

**WHAT — ตรวจอะไร**

มีไฟล์ที่ "ขวางการแสดงผล" อยู่ส่วนบนของหน้า ทำให้เบราว์เซอร์ต้องโหลดไฟล์นั้นให้เสร็จก่อนถึงจะเริ่มแสดงเนื้อหาให้คนเห็น

**WHY — ทำไมต้องตรวจ**

ทำให้คนเห็นหน้าจอขาวๆ นานขึ้นก่อนเนื้อหาจะโผล่ ซึ่งเป็นช่วงวิกฤตที่ลูกค้าตัดสินใจว่าจะรอหรือกดออก

**อ้างอิง:** [Lighthouse: Eliminate render-blocking resources](https://developer.chrome.com/docs/lighthouse/performance/render-blocking-resources)


### third-party เยอะ

`Performance` · ความเชื่อมั่น 80% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 703-708)**

1. ตรวจ script ว่าเป็น third-party จากโดเมนภายนอก ไหม
2. นับจำนวนโดเมน third-party ต่อหน้า
3. หาหน้าที่เกิน 8 โดเมน

เกณฑ์ตัดสิน:
- มีหน้า third-party เยอะ - เตือนกลาง

**WHAT — ตรวจอะไร**

หน้าดึงโค้ดจากบริการภายนอกหลายเจ้า (เช่น แชท วิดเจ็ต โฆษณา ตัวติดตามสถิติ) มากเกินไป

**WHY — ทำไมต้องตรวจ**

โค้ดจากภายนอกแต่ละตัวเราคุมความเร็วไม่ได้ ถ้าเจ้าใดช้าก็ลากให้ทั้งหน้าเราช้าตาม ควรเก็บเท่าที่จำเป็น

**อ้างอิง:** [Lighthouse: Reduce third-party impact](https://developer.chrome.com/docs/lighthouse/performance/third-party-summary)


# Media / Links

## Images

### รูปไม่มี alt

`Media / Links` · ความเชื่อมั่น 100% · Tier 1

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 504-547)**

1. นับรูปที่แสดงจริงบนหน้า (ตัด ruble ที่ซ่อน/aria-hidden ออก)
2. ตรวจรูปไหนไม่มี alt attribute
3. ตรวจรูปไหนใช้ alt= (อ้างว่าประดับ)
4. คิดเปอร์เซ็นต์รูปที่ขาด alt

เกณฑ์ตัดสิน:
- รูปที่แสดงจริงไม่มี alt เกิน 50% - ข้อผิดพลาดกลาง
- รูปที่แสดงจริงไม่มี alt เกินไม่ถึง 50% - เตือนกลาง
- มี alt ประดับ (alt=) บ้าง - เตือนเล็กน้อย
- รูปมี alt ครบ - ผ่าน

ข้อสังเกต: ใช้ rendered DOM เพื่อเห็นรูปที่แสดงจริง แต่บางครั้ง fallback ไป heuristic จาก raw HTML ซึ่งอาจไม่แม่นอาจ 45-90%

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

1. ตรวจรูปส่วนใหญ่ (เกิน 50%) ว่ามี width/height ไหม
2. พิจารณาถ้ารูปมากพอ (>5 รูป)

เกณฑ์ตัดสิน:
- รูปส่วนใหญ่ไม่ระบุ width/height - เตือนเล็กน้อย

**WHAT — ตรวจอะไร**

รูปภาพไม่ได้ระบุขนาด (กว้าง×สูง) ไว้ในโค้ด ทำให้เวลาหน้าโหลด เนื้อหากระตุกขยับไปมาตอนรูปค่อยๆ ขึ้น

**WHY — ทำไมต้องตรวจ**

หน้าที่เนื้อหากระโดดไปมาตอนโหลดทำให้ลูกค้ารำคาญ (บางทีกำลังจะกดปุ่มแล้วปุ่มเลื่อนหนี) และ Google นับเป็นคะแนนความเร็วที่แย่ลง

**อ้างอิง:** [HTML Standard: dimension attributes](https://html.spec.whatwg.org/multipage/embedded-content-other.html#dimension-attributes) · [Google: Core Web Vitals report](https://developers.google.com/search/docs/appearance/core-web-vitals)


### ไม่ lazy-load

`Media / Links` · ความเชื่อมั่น 75% · Tier 3

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 551-554)**

1. ตรวจรูปส่วนใหญ่ (เกิน 70%) ว่ามี loading=lazy ไหม
2. พิจารณาถ้ารูปมากพอ (>5 รูป)

เกณฑ์ตัดสิน:
- รูปส่วนใหญ่ไม่มี lazy loading - เตือนเล็กน้อย

**WHAT — ตรวจอะไร**

รูปภาพยังไม่ได้ตั้งค่าให้ "โหลดเมื่อเลื่อนถึง" (lazy load) ทำให้ตอนเปิดหน้าต้องโหลดรูปทั้งหมดพร้อมกันแม้รูปที่อยู่ล่างสุด

**WHY — ทำไมต้องตรวจ**

การโหลดรูปทุกใบพร้อมกันทำให้หน้าเปิดช้าลง โดยเฉพาะบนมือถือ ลูกค้าที่รอนานอาจกดออกก่อน

**อ้างอิง:** [HTML Standard: lazy-loading attribute](https://html.spec.whatwg.org/multipage/urls-and-fetching.html#lazy-loading-attributes) · [MDN: Lazy loading](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Lazy_loading)


## Rendering

### raw ≠ rendered

`Media / Links` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 611-633)**

1. เทียบ raw HTML กับเนื้อหาหลัง render ด้วย headless Chrome
2. ตรวจว่า H1, heading, text length เหมือนกันไหม

เกณฑ์ตัดสิน:
- raw และ rendered ต่างกันชัดเจน - ข้อผิดพลาดร้ายแรง
- render ล้มเหลว - เตือนสูง (อาจชั่วคราว)
- raw และ rendered ตรงกัน - ผ่าน

**WHAT — ตรวจอะไร**

เปรียบเทียบสิ่งที่เห็น "ตอนเปิดหน้าครั้งแรก" กับ "หลังหน้าประกอบเสร็จ" แล้วพบว่าต่างกันมาก แปลว่าเนื้อหาสำคัญโผล่มาทีหลังด้วยโปรแกรม ไม่ได้อยู่ในหน้าตั้งแต่แรก

**WHY — ทำไมต้องตรวจ**

เนื้อหาที่โผล่ทีหลังมีความเสี่ยงที่ Google จะเก็บไม่ครบ และบอท AI ที่ไม่รอประกอบหน้าจะมองไม่เห็นเลย ทำให้เนื้อหาขายของเราหายไปจากทั้ง Google และ AI

**อ้างอิง:** [Google: JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)


### SPA shell ว่าง

`Media / Links` · ความเชื่อมั่น 85% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 599-609)**

1. ตรวจว่า root container ว่างเปล่าไหม (HTML ดิบแค่ shell)
2. ตรวจหา framework markers (Vue/React/Angular)

เกณฑ์ตัดสิน:
- เป็น SPA เปลือกเปล่า (client-side render เท่านั้น) - ข้อผิดพลาดร้ายแรง
- มี framework แต่ render server-side - ผ่าน
- ไม่ใช่ SPA เนื้อหาอยู่ใน HTML ดิบ - ผ่าน

**WHAT — ตรวจอะไร**

เว็บนี้สร้างแบบที่เนื้อหา "ค่อยประกอบขึ้นด้วยโปรแกรม (JavaScript) หลังเปิดหน้า" แทนที่จะส่งเนื้อหาสำเร็จรูปมาเลย ทำให้ตอนแรกที่เปิดมาหน้าแทบว่างเปล่า

**WHY — ทำไมต้องตรวจ**

นี่คือปัญหาใหญ่สำหรับยุค AI — Google พอจะรอประกอบหน้าได้บ้าง แต่บอทของ AI ทั้งหลาย (ChatGPT, Claude, Perplexity) ไม่รอประกอบหน้า มันเห็นแค่หน้าว่างๆ เท่ากับเว็บเราล่องหนในสายตา AI ทั้งหมด

**อ้างอิง:** [Google: JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)


### ไม่มี noscript fallback

`Media / Links` · ความเชื่อมั่น 80% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 635-636)**

1. ตรวจหน้า SPA ว่ามี noscript fallback ไหม

เกณฑ์ตัดสิน:
- SPA ไม่มี noscript fallback - เตือนเล็กน้อย

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

1. หาไฟล์ /llms.txt บนเว็บ

เกณฑ์ตัดสิน:
- เมื่อมี /llms.txt → แจ้งเพื่อทราบ (ครบเท่านั้น แต่ Google บอกว่าไม่ใช้)
- เมื่อไม่มี → แจ้งเพื่อทราบ (ไม่ใช่ปัญหา Google ไม่ crawl llms.txt ไม่ได้ส่งผลอันดับ)

ข้อสังเกต: เช็คแค่มี/ไม่มี ไม่ได้ตรวจเนื้อหาไฟล์นั้นถูกต้องไหม

**WHAT — ตรวจอะไร**

llms.txt คือไฟล์มาตรฐานใหม่ (เหมือน robots.txt แต่สำหรับ AI) ที่สรุปให้ AI ฟังว่าเว็บเราคือใคร มีหน้าสำคัญอะไรบ้าง ให้ AI ดึงไปใช้ได้ถูกต้อง เว็บนี้ยังไม่มี

**WHY — ทำไมต้องตรวจ**

เป็นมาตรฐานที่เพิ่งเกิดและยังมีคนทำน้อยมาก โดยเฉพาะเว็บไทย — การทำก่อนคือโอกาสนำหน้าคู่แข่งในการถูก AI เข้าใจและอ้างอิงอย่างถูกต้อง

**อ้างอิง:** [The /llms.txt proposal](https://llmstxt.org/)


## AI Crawler

### AI bot เข้าได้ไหม

`GEO (AI Search)` · ความเชื่อมั่น 75% · Tier 4

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 49-82)**

1. ดึง robots.txt ของเว็บ
2. สร้างรายการ path (หน้าหลัก / และ path อื่นๆ จากหน้าที่ crawl ได้) + path ที่ถูกห้าม
3. ทดสอบว่า AI crawler หลัก (GPTBot, ClaudeBot, PerplexityBot เป็นต้น) มี access ได้ไหม โดยเช็ค robots.txt
4. แยกว่า AI ตัวไหนโดนห้าม — โดนทั้งเว็บหรือเฉพาะส่วนนึง

เกณฑ์ตัดสิน:
- เมื่อ AI crawler หลักถูกบล็อกทั้งเว็บ → ผิดร้ายแรง (ไม่มีทางแบรนด์ปรากฏใน ChatGPT/Perplexity)
- เมื่อ AI crawler ถูกบล็อกเฉพาะส่วน → ควรแก้ (เนื้อหาในส่วนนั้นหาย)
- เมื่อทั้งหมดผ่าน → ผ่าน (ได้ 14 AI bot หลักเข้าถึง)

ข้อสังเกต: เช็คแค่ว่า robots.txt อนุญาตหรือไม่ ไม่ได้ตรวจว่า robots.txt ระบุให้ปกติถูกต้องอื่นๆ

**WHAT — ตรวจอะไร**

ตรวจว่าเว็บเปิดให้บอทของ AI ต่างๆ (เช่น GPTBot ของ ChatGPT, ClaudeBot, PerplexityBot) เข้ามาอ่านเนื้อหาได้หรือไม่

**WHY — ทำไมต้องตรวจ**

ถ้าปิดกั้นบอท AI เวลาคนถาม ChatGPT/Perplexity เกี่ยวกับสิ่งที่เราขาย AI จะไม่มีข้อมูลเราไปตอบเลย เท่ากับหายไปจากช่องทางค้นหายุคใหม่ที่กำลังโตเร็ว

**อ้างอิง:** [OpenAI: Bots (GPTBot)](https://developers.openai.com/api/docs/bots) · [Anthropic: Does Anthropic crawl the web?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) · [Perplexity: PerplexityBot](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)


### เสี่ยง SPA บัง AI bot

`GEO (AI Search)` · ความเชื่อมั่น 70% · Tier 4

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 91-99)**

1. ตรวจแต่ละหน้า — ดู HTML ดิบที่เซิร์ฟเวอร์ส่งมา
2. ถ้า HTML เป็นแค่ shell ว่างๆ (ไม่มีข้อความจริง) → หมายความว่า JavaScript จะต้องรันถึงจะได้เนื้อหา
3. นับว่ากี่หน้าแบบนี้

เกณฑ์ตัดสิน:
- เมื่อมีหน้า SPA (HTML ว่าง JS render) → ผิดร้ายแรง (AI crawler ไม่รัน JavaScript — เห็นเนื้อหาไม่ครบ)
- เมื่อเนื้อหาอยู่ใน HTML ดิบทั้งหมด → ผ่าน

ข้อสังเกต: เช็คแค่ว่า HTML ดิบมีเนื้อหาไหม ไม่ได้ตรวจว่า JavaScript ต้องรันนานเท่าไหร่หรือแบบไหน

**WHAT — ตรวจอะไร**

ตรวจว่าเนื้อหาเว็บต้องอาศัยโปรแกรม (JavaScript) ประกอบหน้าหรือไม่ ซึ่งเป็นความเสี่ยงสำหรับ AI ที่ไม่รอประกอบหน้า

**WHY — ทำไมต้องตรวจ**

ถ้าเนื้อหาเราโผล่ด้วยโปรแกรมทีหลัง บอท AI จะมองไม่เห็นและดึงไปตอบไม่ได้ ทำให้เราหายไปจากผลการค้นหายุค AI

**อ้างอิง:** [Google: JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics) · [OpenAI: Bots (GPTBot)](https://developers.openai.com/api/docs/bots)


## Citability

### FAQ schema

`GEO (AI Search)` · ความเชื่อมั่น 60% · Tier 4

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 101-112)**

1. ดู JSON-LD ใน <head> ของแต่ละหน้า
2. หา @type ว่ามี FAQPage หรือ QAPage หรือไม่

เกณฑ์ตัดสิน:
- เมื่อมี FAQPage หรือ QAPage schema → ผ่าน (ช่วย ChatGPT/Perplexity ดึงคำตอบได้ตรง)
- เมื่อไม่มี → ควรแก้ (ไม่มี rich result ใน Google แล้ว แต่ช่วย AI engine อ้างอิง)

ข้อสังเกต: เช็คแค่ว่ามี schema type นี้ไหม ไม่ได้ตรวจข้อมูลข้างในถูกต้อง

**WHAT — ตรวจอะไร**

FAQPage schema คือการติดฉลากให้ส่วนคำถาม-คำตอบในเว็บ เป็นรูปแบบที่ Google AI Overview และ ChatGPT ชอบหยิบไปตอบมากที่สุด เว็บนี้ยังไม่มีสักหน้า

**WHY — ทำไมต้องตรวจ**

นี่คือทางลัดที่ได้ผลที่สุดในการถูก AI อ้างถึง — ถ้าเราเตรียมคำถาม-คำตอบที่ลูกค้าถามบ่อยพร้อมติดฉลากไว้ มีโอกาสสูงที่ AI จะหยิบคำตอบของเราไปแสดงพร้อมเครดิตกลับมาหาเรา

**อ้างอิง:** [Google: Changes to FAQ rich results (2023)](https://developers.google.com/search/blog/2023/08/howto-faq-changes) · [Schema.org: FAQPage](https://schema.org/FAQPage)


### เนื้อหา Q&A

`GEO (AI Search)` · ความเชื่อมั่น 55% · Tier 4

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 114-121)**

1. ดู heading ในแต่ละหน้า
2. หาว่า heading (h2, h3 เป็นต้น ไม่นับ h1) เป็นคำถาม ไหม (มี ? หรือคำว่า คืออะไร/ทำไม/อย่างไร/เท่าไหร่ เป็นต้น)

เกณฑ์ตัดสิน:
- เมื่อมี heading เชิงคำถาม → ผ่าน (AI ดึงคำตอบง่าย)
- เมื่อไม่มี → ควรแก้ (เพิ่มหัวข้อคำถาม + คำตอบ 2-3 ประโยคแรกเหลือ)

ข้อสังเกต: เช็คแค่ว่ามี heading คำถามไหม ไม่ได้ตรวจว่าคำตอบใต้นั้นอ่านง่ายและสั้นพอ

**WHAT — ตรวจอะไร**

ตรวจว่าเว็บมีเนื้อหารูปแบบถาม-ตอบ (หัวข้อที่ตั้งเป็นคำถามแล้วตามด้วยคำตอบ) ซึ่งเป็นโครงสร้างที่ AI ดึงไปตอบง่าย

**WHY — ทำไมต้องตรวจ**

AI ตอบคำถามคน ดังนั้นเนื้อหาที่จัดเป็นคำถาม-คำตอบตรงกับสิ่งที่ AI มองหาพอดี ยิ่งมีมาก ยิ่งมีโอกาสถูกเลือกไปเป็นคำตอบ

**อ้างอิง:** [RAG — Lewis et al., 2020 (arXiv)](https://arxiv.org/abs/2005.11401)


### เนื้อหาอ้างอิงได้

`GEO (AI Search)` · ความเชื่อมั่น 55% · Tier 4

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 140-146)**

1. นับว่าแต่ละหน้ามี table (ตาราง) ไหม
2. นับจำนวน list ที่มีข้อมูล (ลิสต์ 3 ข้อขึ้นไป)
3. ตรวจว่า ≥3 หน้า มีตาราง หรือลิสต์ข้อมูลไหม

เกณฑ์ตัดสิน:
- เมื่อ ≥3 หน้า มีตาราง/ลิสต์ข้อมูล → ผ่าน (AI ชอบ cite)
- เมื่อน้อยกว่า → เตือนเล็กน้อย (เพิ่มข้อมูล benchmark/สถิติจะดี)

ข้อสังเกต: เช็คแค่ว่ามี table/list ไหม ไม่ได้ตรวจว่าข้อมูลข้างในแม่นยำ/นำเสนอดี

**WHAT — ตรวจอะไร**

ตรวจว่าเนื้อหาในเว็บอยู่ในรูปแบบที่ AI ชอบหยิบไปอ้างอิง เช่น มีตาราง มีลิสต์ มีคำตอบที่ชัดเจนตรงประเด็น

**WHY — ทำไมต้องตรวจ**

AI มักดึงคำตอบจากเนื้อหาที่เป็นระเบียบและตอบตรงคำถาม ยิ่งเนื้อหาเราจัดรูปแบบดี ยิ่งมีโอกาสถูก AI เลือกไปอ้างอิงพร้อมลิงก์กลับมาหาเรา

**อ้างอิง:** [RAG — Lewis et al., 2020 (arXiv)](https://arxiv.org/abs/2005.11401)


## Authority / E-E-A-T

### E-E-A-T สัญญาณ

`GEO (AI Search)` · ความเชื่อมั่น 80% · Tier 2

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 123-138)**

1. เช็คแต่ละหน้า — มี author metadata หรือ schema ไหม (author, Person type ใน JSON-LD)
2. เช็คว่า มี datePublished/dateModified ไหม (meta article:published_time หรือ JSON-LD)
3. เช็คว่า Organization มี sameAs link ไปโซเชียลมีเดีย/Wikipedia หรือไม่

เกณฑ์ตัดสิน:
- เมื่อหน้าไม่มี author กับ date แม่นย่า → ควรแก้ (เสริมสัญญาณความน่าเชื่อถือให้ชัดขึ้น)
- เมื่อ Organization ไม่มี sameAs → ควรแก้ (ช่วยให้ Google/AI ระบุแบรนด์เชื่อถือได้มากขึ้น)
- เมื่อครบทั้งหมด → ผ่าน

ข้อสังเกต: เช็คแค่มี/ไม่มี สัญญาณ ไม่ได้ตรวจว่าข้อมูล (author name, date, social links) เป็นจริงและถูกต้อง

**WHAT — ตรวจอะไร**

E-E-A-T คือสัญญาณความน่าเชื่อถือที่ Google และ AI ใช้ดู เช่น ใครเป็นคนเขียน มีวันที่เผยแพร่/อัปเดตไหม มีลิงก์ยืนยันตัวตนแบรนด์ (โซเชียล/วิกิพีเดีย) หรือเปล่า เว็บนี้ยังขาดสัญญาณเหล่านี้

**WHY — ทำไมต้องตรวจ**

ทั้ง Google และ AI ให้คะแนนแหล่งที่ดูน่าเชื่อถือสูงกว่า ถ้าเว็บเราไม่มีคนเขียน ไม่มีวันที่ ไม่มีตัวตนชัด AI จะลังเลที่จะอ้างอิงเรา และเลือกแหล่งอื่นที่ดูน่าเชื่อถือกว่าแทน

**อ้างอิง:** [Google: Creating helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) · [Google: Search Quality Rater Guidelines (PDF)](https://static.googleusercontent.com/media/guidelines.raterhub.com/en//searchqualityevaluatorguidelines.pdf)


### entity ชัดเจน

`GEO (AI Search)` · ความเชื่อมั่น 55% · Tier 4

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 166-176)**

1. หา Organization หรือ LocalBusiness schema ใน JSON-LD ของหน้าหลัก

เกณฑ์ตัดสิน:
- เมื่อไม่มี Organization schema → ควรแก้ (เพิ่ม Organization: name, logo, description, address, sameAs)
- เมื่อมี → ผ่าน

ข้อสังเกต: เช็คแค่มี/ไม่มี schema type ไม่ได้ตรวจว่า field ข้างในครบถ้วนและถูกต้อง

**WHAT — ตรวจอะไร**

ตรวจว่า AI "รู้จักตัวตนของแบรนด์เรา" ไหม ซึ่งต้องอาศัยฉลากข้อมูลองค์กร (Organization schema) ที่บอกว่าเราคือใคร เว็บนี้ยังไม่มี

**WHY — ทำไมต้องตรวจ**

เมื่อมีคนถาม AI ว่า "ธุรกิจประเภทนี้มีเจ้าไหนบ้าง" ถ้า AI ไม่มีข้อมูลตัวตนของแบรนด์เราที่ชัดเจน มันจะไม่นึกถึงเราและไปแนะนำคู่แข่งที่มีข้อมูลครบกว่าแทน

**อ้างอิง:** [Google: Introducing the Knowledge Graph](https://blog.google/products-and-platforms/products/search/introducing-knowledge-graph-things-not/) · [RAG — Lewis et al., 2020 (arXiv)](https://arxiv.org/abs/2005.11401)


### หน้า trust (about/contact)

`GEO (AI Search)` · ความเชื่อมั่น 65% · Tier 4

**⚙ ตรวจอย่างไร (ตอนนี้ · จากโค้ด · line 148-164)**

1. ดู link ทั้งหมดบนเว็บ — ใน URL และ href ของลิงก์
2. หาว่ามี about/เกี่ยวกับเรา, contact/ติดต่อ, privacy/นโยบาย ไหม
3. เช็คว่า มีเบอร์โทร/อีเมล (mailto) บนหน้าเว็บไหม

เกณฑ์ตัดสิน:
- เมื่อขาด ≥3 สิ่งจากนั้น (About/Contact/Privacy/เบอร์โทร) → ผิดร้ายแรง (ธุรกิจดูเป็น scam)
- เมื่อขาด 1-2 → ควรแก้ (เพิ่มหน้า Trust + ข้อมูลติดต่อจริง)
- เมื่อครบ → ผ่าน

ข้อสังเกต: เช็คแค่มี/ไม่มี link ไม่ได้ตรวจว่าหน้า About/Contact/Privacy มีข้อมูลจริง/ครบถ้วน

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


