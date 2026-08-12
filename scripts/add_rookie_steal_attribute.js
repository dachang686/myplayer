const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'js', 'data', 'draft_data.js');
const DRAFT_PROFILES_FILE = path.join(ROOT, 'scripts', 'data', 'draft_class_2026_profiles.json');
const FUTURE_PROFILES_FILE = path.join(ROOT, 'scripts', 'data', 'future_prospect_profiles.json');

function loadDraftData(source) {
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`${source}\nthis.__draft = DRAFT_CLASS_2026_RATINGS; this.__future = FUTURE_PROSPECT_RATINGS;`, sandbox);
  return { draft: sandbox.__draft, future: sandbox.__future };
}

function indexProfiles(file) {
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rows = Array.isArray(payload) ? payload : payload.profiles;
  if (!Array.isArray(rows)) throw new Error(`${file} 缺少 profiles 数组`);
  return Object.fromEntries(rows.map((row) => [row.id, row]));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function primaryPosition(pos) {
  return String(pos || 'SF').split('/')[0].trim();
}

function deriveSteal(rating, profile) {
  const positionBaseline = { PG: 62, SG: 53, SF: 54, PF: 51, C: 47 };
  const pdef = Number(rating.attributes.PDEF ?? 50);
  const posBase = positionBaseline[primaryPosition(rating.pos)] ?? 54;
  const steals = Number(profile?.stats?.steals);
  const hasStealStats = Number.isFinite(steals) && steals >= 0;
  const evidence = hasStealStats
    ? 45 + clamp(steals, 0, 3.5) * 12
    : posBase;
  const value = hasStealStats
    ? Math.round(pdef * 0.55 + evidence * 0.45)
    : Math.round(pdef * 0.65 + posBase * 0.35);
  return clamp(value, 25, 99);
}

function addSteals(source, ratings, profiles, sectionStart, sectionEnd) {
  const start = source.indexOf(sectionStart);
  const end = sectionEnd ? source.indexOf(sectionEnd, start + sectionStart.length) : source.length;
  if (start < 0 || end < 0) throw new Error(`未找到数据区段：${sectionStart}`);

  let section = source.slice(start, end);
  let count = 0;
  for (const [id, rating] of Object.entries(ratings)) {
    const entryStart = section.indexOf(`"${id}": {`);
    if (entryStart < 0) throw new Error(`未找到新秀 ${id}`);
    const attributesStart = section.indexOf('attributes: {', entryStart);
    const attributesEnd = section.indexOf('}', attributesStart);
    const attributesBlock = section.slice(attributesStart, attributesEnd);
    if (/\bSTL\s*:/.test(attributesBlock)) throw new Error(`${id} 已有 STL，停止重复写入`);

    const stl = deriveSteal(rating, profiles[id]);
    const before = section.slice(0, attributesStart);
    const block = section.slice(attributesStart, attributesEnd);
    const after = section.slice(attributesEnd);
    const updatedBlock = block.replace(/(\bPDEF\s*:\s*\d+\s*,)/, `$1 STL: ${stl},`);
    if (updatedBlock === block) throw new Error(`${id} 的 attributes 缺少 PDEF`);
    section = before + updatedBlock + after;
    count += 1;
  }
  return { source: source.slice(0, start) + section + source.slice(end), count };
}

let source = fs.readFileSync(DATA_FILE, 'utf8');
const data = loadDraftData(source);
const draftProfiles = indexProfiles(DRAFT_PROFILES_FILE);
const futureProfiles = indexProfiles(FUTURE_PROFILES_FILE);

const draftResult = addSteals(
  source,
  data.draft,
  draftProfiles,
  'var DRAFT_CLASS_2026_RATINGS = {',
  'var FUTURE_PROSPECT_RATINGS = {'
);
source = draftResult.source;

const futureResult = addSteals(
  source,
  data.future,
  futureProfiles,
  'var FUTURE_PROSPECT_RATINGS = {',
  null
);
source = futureResult.source;

fs.writeFileSync(DATA_FILE, source, 'utf8');
console.log(JSON.stringify({ draft: draftResult.count, future: futureResult.count }));
