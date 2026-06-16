// Schema.org / JSON-LD Validator — เทียบเท่าแกนกลางของ Google Rich Results Test
// ──────────────────────────────────────────────────────────────────────────
// ตรวจว่า structured data มี "required / recommended properties" ครบตามที่ Google
// กำหนดไว้จริงหรือไม่ (ไม่ใช่แค่เช็คว่ามี @type) — deterministic, fixture-testable
// อ้างอิง: developers.google.com/search/docs/appearance/structured-data
//
// ใช้เป็น "ชั้น 2" ของการ verify: rule ของเราตรงกับเกณฑ์ rich-result ของ Google

// required properties ต่อ type (ขาด = error → ไม่ได้ rich result)
const REQUIRED = {
  Organization: ['name'],
  LocalBusiness: ['name', 'address'],
  Product: ['name'],
  Offer: ['price', 'priceCurrency'],
  Article: ['headline'],
  NewsArticle: ['headline'],
  BlogPosting: ['headline'],
  Event: ['name', 'startDate', 'location'],
  Recipe: ['name', 'image'],
  VideoObject: ['name', 'thumbnailUrl', 'uploadDate'],
  Review: ['reviewRating', 'author'],
  AggregateRating: ['ratingValue'],
  Question: ['name', 'acceptedAnswer'],
  FAQPage: ['mainEntity'],
  BreadcrumbList: ['itemListElement'],
};

// recommended properties ต่อ type (ขาด = warning → rich result ด้อยลง)
const RECOMMENDED = {
  Organization: ['url', 'logo', 'sameAs'],
  LocalBusiness: ['telephone', 'openingHours', 'image', 'priceRange', 'geo'],
  Product: ['image', 'offers', 'brand'],
  Offer: ['availability', 'url'],
  Article: ['image', 'datePublished', 'author', 'dateModified'],
  NewsArticle: ['image', 'datePublished', 'author', 'dateModified'],
  BlogPosting: ['image', 'datePublished', 'author', 'dateModified'],
  Event: ['image', 'endDate', 'offers'],
  Recipe: ['author', 'datePublished', 'recipeIngredient', 'recipeInstructions'],
  VideoObject: ['description', 'duration', 'contentUrl'],
};

// LocalBusiness subtypes ที่พบบ่อย → ใช้กฎ LocalBusiness
const LOCALBIZ_SUBTYPES = new Set([
  'Restaurant', 'Store', 'Hotel', 'BarOrPub', 'CafeOrCoffeeShop', 'Bakery',
  'RealEstateAgent', 'AutoDealer', 'Dentist', 'MedicalClinic', 'LegalService',
  'FinancialService', 'ProfessionalService', 'HomeAndConstructionBusiness',
]);

function typesOf(node) {
  if (!node || typeof node !== 'object') return [];
  const t = node['@type'];
  if (!t) return [];
  return [].concat(t).map(String);
}

function hasProp(node, prop) {
  const v = node[prop];
  if (v == null) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  return true; // object/number/boolean ถือว่ามี
}

// รวบรวมทุก node ที่มี @type จากกราฟ (รองรับ array + @graph + nested)
function collectTypedNodes(data, acc = []) {
  if (Array.isArray(data)) { data.forEach(d => collectTypedNodes(d, acc)); return acc; }
  if (!data || typeof data !== 'object') return acc;
  if (data['@type']) acc.push(data);
  for (const [k, v] of Object.entries(data)) {
    if (k === '@type' || k === '@context') continue;
    if (v && typeof v === 'object') collectTypedNodes(v, acc);
  }
  return acc;
}

// แม็ป type ที่รู้จัก (รวม subtype ของ LocalBusiness)
function knownType(type) {
  if (REQUIRED[type] || RECOMMENDED[type]) return type;
  if (LOCALBIZ_SUBTYPES.has(type)) return 'LocalBusiness';
  return null;
}

// ตรวจ node เดียว → คืน { errors:[], warnings:[] }
function validateNode(node) {
  const errors = [], warnings = [];
  for (const rawType of typesOf(node)) {
    const type = knownType(rawType);
    if (!type) continue;

    for (const prop of (REQUIRED[type] || [])) {
      if (!hasProp(node, prop)) errors.push({ type: rawType, prop, kind: 'required' });
    }
    for (const prop of (RECOMMENDED[type] || [])) {
      if (!hasProp(node, prop)) warnings.push({ type: rawType, prop, kind: 'recommended' });
    }

    // กฎพิเศษที่ตารางธรรมดาจับไม่ได้
    if (type === 'AggregateRating') {
      // ratingValue ตรวจจาก REQUIRED table แล้ว — ที่นี่เช็คเฉพาะกฎ OR
      if (!hasProp(node, 'reviewCount') && !hasProp(node, 'ratingCount'))
        errors.push({ type: rawType, prop: 'reviewCount|ratingCount', kind: 'required' });
    }
    if (type === 'FAQPage') {
      const qs = [].concat(node.mainEntity || []);
      const badQ = qs.filter(q => !hasProp(q, 'name') || !hasProp(q, 'acceptedAnswer') || !hasProp(q.acceptedAnswer || {}, 'text'));
      if (qs.length && badQ.length) errors.push({ type: rawType, prop: 'mainEntity[].acceptedAnswer.text', kind: 'required' });
    }
    if (type === 'BreadcrumbList') {
      const items = [].concat(node.itemListElement || []);
      const badItems = items.filter(it => !hasProp(it, 'position') || (!hasProp(it, 'name') && !hasProp(it, 'item')));
      if (items.length && badItems.length) errors.push({ type: rawType, prop: 'itemListElement[].position/name', kind: 'required' });
    }
  }
  return { errors, warnings };
}

// API หลัก: รับ array ของ parsed JSON-LD data objects → สรุปผลทั้งหน้า
export function validateSchemaNodes(jsonLdDataArray) {
  const nodes = [];
  for (const data of jsonLdDataArray) collectTypedNodes(data, nodes);
  const errors = [], warnings = [];
  const validatableTypes = new Set();
  for (const node of nodes) {
    for (const t of typesOf(node)) if (knownType(t)) validatableTypes.add(t);
    const r = validateNode(node);
    errors.push(...r.errors);
    warnings.push(...r.warnings);
  }
  return {
    errors,
    warnings,
    hasValidatableType: validatableTypes.size > 0,
    types: [...validatableTypes],
  };
}
