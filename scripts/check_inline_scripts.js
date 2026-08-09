const fs = require('fs');
const parser = require('@babel/parser');

const html = fs.readFileSync('index.html', 'utf8');
const scriptPattern = /<script([^>]*)>([\s\S]*?)<\/script>/g;
let match;
let inlineCount = 0;
let failed = false;

while ((match = scriptPattern.exec(html))) {
  if (/type=['"]application\/json/.test(match[1]) || /\bsrc=/.test(match[1])) continue;
  inlineCount += 1;
  try {
    parser.parse(match[2], {
      sourceType: 'script',
      allowReturnOutsideFunction: true,
      plugins: ['optionalChaining', 'nullishCoalescingOperator'],
    });
  } catch (error) {
    const htmlLine = html.slice(0, match.index).split(/\r?\n/).length;
    console.error(`inline script ${inlineCount} near HTML line ${htmlLine}: ${error.message}`);
    failed = true;
  }
}

const localModules = Array.from(html.matchAll(/<script\s+src=["']([^"']+\.js)["'][^>]*><\/script>/gi))
  .map(match => match[1])
  .filter(file => !/^[a-z]+:/i.test(file));

for (const file of localModules) {
  try {
    parser.parse(fs.readFileSync(file, 'utf8'), { sourceType: 'script' });
  } catch (error) {
    console.error(`${file}: ${error.message}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log(`Parsed ${inlineCount} inline scripts and ${localModules.length} local modules successfully.`);
