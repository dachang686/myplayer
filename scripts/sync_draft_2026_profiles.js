const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const identityPath = path.join(__dirname, 'data', 'draft_class_2026_identity.json');
const outputPath = path.join(__dirname, 'data', 'draft_class_2026_profiles.json');
const identity = JSON.parse(fs.readFileSync(identityPath, 'utf8'));
const slugOverrides = {
  6: 'mikel-brown',
  7: 'darius-acuff',
  22: 'labaron-philon',
};

function slugify(name) {
  return String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/\./g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function decodeHtml(value) {
  return String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function plainText(value) {
  return decodeHtml(String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNumber(text, pattern) {
  const match = text.match(pattern);
  return match ? Number(match[1]) : null;
}

function findSeasonSentence(articleText) {
  const sentences = articleText.split(/(?<=[.!?])\s+/);
  const candidates = sentences.filter((sentence) =>
    /(?:averaged|posted|put up)\s+\d+(?:\.\d+)?\s+points/i.test(sentence)
  );
  const reversed = candidates.slice().reverse();
  return reversed.find((sentence) => /(?:shooting splits|shooting|across \d+|in \d+ (?:games|starts|appearances))/i.test(sentence))
    || reversed.find((sentence) => /(?:freshman|season|games|starts|appearances|overall)/i.test(sentence))
    || candidates[candidates.length - 1]
    || '';
}

function parseProfile(html, player, url) {
  const definitionMatch = html.match(/<dl class="DraftProspectPlayer_definition__[^>]+">([\s\S]*?)<\/dl>/i);
  if (!definitionMatch) throw new Error(`Missing bio definition for ${player.name}`);
  const bio = {};
  const pairPattern = /<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/gi;
  let pair;
  while ((pair = pairPattern.exec(definitionMatch[1]))) {
    bio[plainText(pair[1])] = plainText(pair[2]);
  }

  const pageText = plainText(html.slice((definitionMatch.index || 0) + definitionMatch[0].length));
  const overviewMatch = pageText.match(/(?:Get to Know [\s\S]*?\s)?Overview\s+([\s\S]*?)\s+Analysis\s+/i);
  const scoutingMatch = pageText.match(/\sAnalysis\s+([\s\S]*?)\s+Career Highlights\s+/i);
  const overviewText = overviewMatch ? overviewMatch[1] : pageText;
  const scoutingText = scoutingMatch ? scoutingMatch[1] : pageText;
  const seasonSentence = findSeasonSentence(overviewText);
  const shooting = seasonSentence.match(/(?:on\s+)?([0-9.]+)%?\s*\/\s*([0-9.]+)%?\s*\/\s*([0-9.]+)%?\s+shooting/i);
  const heightWeight = String(bio['Height/Weight'] || '').match(/([0-9]+-[0-9]+)\s*\/\s*([0-9]+)\s*lbs/i);

  const stats = {
    games: parseNumber(seasonSentence, /(?:across|in)\s+(\d+)\s+(?:games|starts|appearances)/i),
    minutes: parseNumber(seasonSentence, /([0-9.]+)\s+minutes/i),
    points: parseNumber(seasonSentence, /(?:averaged|posted|put up)\s+([0-9.]+)\s+points/i),
    rebounds: parseNumber(seasonSentence, /([0-9.]+)\s+rebounds/i),
    assists: parseNumber(seasonSentence, /([0-9.]+)\s+assists/i),
    steals: parseNumber(seasonSentence, /([0-9.]+)\s+steals/i),
    blocks: parseNumber(seasonSentence, /([0-9.]+)\s+blocks/i),
    fieldGoalPct: shooting ? Number(shooting[1]) : null,
    threePointPct: shooting ? Number(shooting[2]) : null,
    freeThrowPct: shooting ? Number(shooting[3]) : null,
  };

  return {
    id: `D26-${String(player.pick).padStart(2, '0')}`,
    pick: player.pick,
    name: player.name,
    source: url,
    position: bio.Position || null,
    height: heightWeight ? heightWeight[1] : null,
    weightLbs: heightWeight ? Number(heightWeight[2]) : null,
    school: bio['School/Club'] || player.school || null,
    country: bio.Country || null,
    classStatus: bio.Status || null,
    birthday: bio.Birthday || null,
    stats,
    profileSignals: {
      shooting: /(?:shot-maker|shooting|three-point|deep range|catch-and-shoot|perimeter shot)/i.test(scoutingText),
      playmaking: /(?:playmaking|playmaker|vision|passing|ballhandler|ball handler|creator)/i.test(scoutingText),
      finishing: /(?:finish|finishing|above the rim|lob threat|post scoring)/i.test(scoutingText),
      perimeterDefense: /(?:guard multiple|switch|perimeter defender|lateral|passing lanes)/i.test(scoutingText),
      interiorDefense: /(?:rim protect|shot block|help-side|interior defender|weakside blocks)/i.test(scoutingText),
      rebounding: /(?:rebound|offensive glass)/i.test(scoutingText),
      athleticism: /(?:elite athlete|explosive athlete|vertical|quickness|transition terror)/i.test(scoutingText),
      strength: /(?:strong frame|power|bullies|through contact|physical)/i.test(scoutingText),
    },
  };
}

async function fetchText(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'user-agent': 'Mozilla/5.0 Codex local roster data review',
          accept: 'text/html,application/xhtml+xml',
        },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw lastError;
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function main() {
  const refresh = process.argv.includes('--refresh');
  const existingPayload = fs.existsSync(outputPath)
    ? JSON.parse(fs.readFileSync(outputPath, 'utf8'))
    : { profiles: [] };
  const existingByPick = new Map((existingPayload.profiles || []).map((profile) => [profile.pick, profile]));
  const failures = [];
  const profiles = await mapLimit(identity.players, 4, async (player) => {
    if (!refresh && existingByPick.has(player.pick)) {
      const cached = { ...existingByPick.get(player.pick) };
      delete cached.evidenceSentence;
      return cached;
    }
    const slug = slugOverrides[player.pick] || slugify(player.name);
    const url = `https://www.nba.com/draft/2026/prospects/${slug}`;
    try {
      const html = await fetchText(url);
      const profile = parseProfile(html, player, url);
      process.stdout.write(`cached ${profile.id} ${player.name}\n`);
      return profile;
    } catch (error) {
      failures.push({ pick: player.pick, name: player.name, url, error: error.message });
      process.stderr.write(`failed D26-${String(player.pick).padStart(2, '0')} ${player.name}: ${error.message}\n`);
      return null;
    }
  });

  const payload = {
    source: identity.source,
    fetchedAt: new Date().toISOString(),
    profiles: profiles.filter(Boolean),
    failures,
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify({ outputPath, profiles: payload.profiles.length, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
