const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const entryFiles = ['index.html'];
const activeFiles = new Set(entryFiles.concat(['README.md', 'SOURCE_PROVENANCE.md']));

for (const entry of entryFiles) {
  const entryText = fs.readFileSync(path.join(root, entry), 'utf8');
  for (const match of entryText.matchAll(/<script\s+src=["']([^"']+)["']/gi)) {
    const relative = match[1].replace(/\//g, path.sep);
    if (/^[a-z]+:/i.test(relative)) throw new Error(`External script is not allowed: ${match[1]}`);
    activeFiles.add(relative);
  }
}

const forbidden = [
  { label: 'third-party platform/domain', pattern: /hoopchina|hupu|huputiyu|cdn\.[a-z0-9.-]+|fonts\.googleapis|fonts\.gstatic|colorbox|kaleido/i },
  { label: 'remote executable or style asset', pattern: /<(?:script|link)\b[^>]*(?:src|href)=["']https?:\/\//i },
  { label: 'legacy asset reference', pattern: /(?:src|href|url\()\s*["']?assets[\\/]/i }
];

const failures = [];
for (const relative of activeFiles) {
  const fullPath = path.join(root, relative);
  if (!fs.existsSync(fullPath)) {
    failures.push(`${relative}: active file is missing`);
    continue;
  }
  const text = fs.readFileSync(fullPath, 'utf8');
  for (const rule of forbidden) {
    const match = text.match(rule.pattern);
    if (!match) continue;
    const line = text.slice(0, match.index).split(/\r?\n/).length;
    failures.push(`${relative}:${line}: ${rule.label}: ${JSON.stringify(match[0])}`);
  }
}

const removedFiles = [
  'js/ad_activity_id.js', 'js/career_biography.js', 'js/career_poster_rendering.js',
  'js/career_story_poster.legacy.js', 'js/colorbox_ai_runtime.js', 'js/core_game_logic.js',
  'js/hupu_user_profile.js', 'js/page_env_bootstrap.js', 'js/platform_integrations.js',
  'js/player_headshots.js', 'js/poster_sharing.js', 'js/storage.js',
  'js/local_platform_runtime.js', 'js/data/player_logo.svg'
];

if (process.argv.includes('--repository')) {
  const assetRoot = path.join(root, 'assets');
  if (fs.existsSync(assetRoot)) failures.push('assets/: legacy third-party asset directory still exists');
  for (const relative of removedFiles) {
    if (fs.existsSync(path.join(root, relative))) failures.push(`${relative}: confirmed removal target still exists`);
  }

  const textExtensions = new Set(['.html', '.js', '.md', '.json', '.svg', '.css']);
  const ignoredRoots = new Set(['.git', 'assets', 'node_modules']);
  const strictFiles = [];
  function collectTextFiles(directory, relativeRoot) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && ignoredRoots.has(entry.name)) continue;
      const relative = path.join(relativeRoot, entry.name);
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) collectTextFiles(fullPath, relative);
      else if (textExtensions.has(path.extname(entry.name).toLowerCase())) strictFiles.push(relative);
    }
  }
  collectTextFiles(root, '');
  for (const relative of strictFiles) {
    if (relative.replace(/\\/g, '/') === 'scripts/check_legal_surface.js') continue;
    const text = fs.readFileSync(path.join(root, relative), 'utf8');
    for (const rule of forbidden) {
      const match = text.match(rule.pattern);
      if (!match) continue;
      const line = text.slice(0, match.index).split(/\r?\n/).length;
      failures.push(`${relative}:${line}: repository ${rule.label}: ${JSON.stringify(match[0])}`);
    }
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Legal surface check passed: ${activeFiles.size} active files scanned.`);
}
