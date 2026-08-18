const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const root = path.resolve(__dirname, '..');
const outputPath = path.join(root, 'js', 'translations.js');
const cjkPattern = /[\u3400-\u9fff\uf900-\ufaff]/;
const htmlFiles = ['index.html', 'manager.html'];
const ignoredJavaScript = new Set(['i18n.js', 'translations.js']);
const candidates = new Set();

function collect(value) {
  if (typeof value !== 'string') return;
  const normalized = value.replace(/\r\n?/g, '\n').trim();
  if (!normalized || !cjkPattern.test(normalized)) return;
  candidates.add(normalized);

  normalized
    .split(/<[^>]*>|\n+/g)
    .map((part) => part.trim())
    .filter((part) => part && cjkPattern.test(part))
    .forEach((part) => candidates.add(part));
}

function walkFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkFiles(absolute);
    return absolute;
  });
}

function collectJavaScript(source, filename) {
  let ast;
  try {
    ast = parser.parse(source, {
      sourceType: 'script',
      allowReturnOutsideFunction: true,
      plugins: ['optionalChaining', 'nullishCoalescingOperator'],
    });
  } catch (error) {
    throw new Error(`${filename}: ${error.message}`);
  }

  traverse(ast, {
    StringLiteral(nodePath) {
      collect(nodePath.node.value);
    },
    TemplateElement(nodePath) {
      collect(nodePath.node.value.cooked || nodePath.node.value.raw || '');
    },
  });
}

function collectHtml(source, filename) {
  const scriptPattern = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptPattern.exec(source))) {
    if (/\bsrc\s*=|application\/json/i.test(match[1])) continue;
    collectJavaScript(match[2], `${filename}:inline-script`);
  }

  const withoutCode = source
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  for (const textMatch of withoutCode.matchAll(/>([^<>]+)</g)) collect(textMatch[1]);
  for (const attributeMatch of withoutCode.matchAll(/\b(?:alt|aria-label|placeholder|title|value)\s*=\s*(["'])(.*?)\1/gi)) {
    collect(attributeMatch[2]);
  }
}

function extractCandidates() {
  walkFiles(path.join(root, 'js'))
    .filter((filename) => filename.endsWith('.js'))
    .filter((filename) => !ignoredJavaScript.has(path.basename(filename)))
    .forEach((filename) => collectJavaScript(fs.readFileSync(filename, 'utf8'), path.relative(root, filename)));

  htmlFiles.forEach((filename) => {
    collectHtml(fs.readFileSync(path.join(root, filename), 'utf8'), filename);
  });

  return Array.from(candidates).sort((first, second) => first.localeCompare(second, 'zh-CN'));
}

function createBatches(strings, maxCharacters = 3600) {
  const batches = [];
  let current = [];
  let size = 0;

  strings.forEach((source, index) => {
    const marker = `<<<CF${String(index).padStart(6, '0')}>>>`;
    const entrySize = marker.length + source.length + 2;
    if (current.length && size + entrySize > maxCharacters) {
      batches.push(current);
      current = [];
      size = 0;
    }
    current.push({ index, marker, source });
    size += entrySize;
  });
  if (current.length) batches.push(current);
  return batches;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function translateBatch(batch, attempt = 1) {
  const query = batch.map((entry) => `${entry.marker}\n${entry.source}`).join('\n');
  const body = new URLSearchParams({ client: 'gtx', sl: 'zh-CN', tl: 'en', dt: 't', q: query });

  try {
    const response = await fetch('https://translate.googleapis.com/translate_a/single', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const translated = (payload[0] || []).map((segment) => segment[0] || '').join('');
    const parsed = new Map();
    const markerPattern = /<<<CF(\d{6})>>>\s*([\s\S]*?)(?=<<<CF\d{6}>>>|$)/g;
    let match;
    while ((match = markerPattern.exec(translated))) {
      parsed.set(Number(match[1]), match[2].trim());
    }
    if (parsed.size !== batch.length) {
      throw new Error(`expected ${batch.length} entries, received ${parsed.size}`);
    }
    return parsed;
  } catch (error) {
    if (attempt >= 4) throw error;
    await delay(750 * (2 ** (attempt - 1)));
    return translateBatch(batch, attempt + 1);
  }
}

async function translateAll(strings) {
  const batches = createBatches(strings);
  const translations = new Array(strings.length);
  let nextBatch = 0;
  let completed = 0;

  async function worker() {
    while (nextBatch < batches.length) {
      const batchIndex = nextBatch;
      nextBatch += 1;
      const result = await translateBatch(batches[batchIndex]);
      result.forEach((translation, index) => {
        translations[index] = translation.replace(/—/g, ';');
      });
      completed += 1;
      if (completed % 10 === 0 || completed === batches.length) {
        console.log(`Translated ${completed}/${batches.length} batches`);
      }
    }
  }

  await Promise.all([worker(), worker()]);
  return translations;
}

function writeDictionary(strings, translations) {
  const dictionary = {};
  strings.forEach((source, index) => {
    const translation = translations[index];
    if (!translation) throw new Error(`Missing translation for: ${source.slice(0, 80)}`);
    dictionary[source] = translation;
  });

  const output = [
    '/* Generated by scripts/generate_translations.js. Do not edit by hand. */',
    '(function (global) {',
    "  'use strict';",
    `  global.COURT_FORGE_TRANSLATIONS = Object.freeze({ en: Object.freeze(${JSON.stringify(dictionary, null, 2)}) });`,
    "})(typeof window !== 'undefined' ? window : globalThis);",
    '',
  ].join('\n');
  fs.writeFileSync(outputPath, output, 'utf8');
  console.log(`Wrote ${strings.length} translations to ${path.relative(root, outputPath)}`);
}

async function main() {
  const strings = extractCandidates();
  console.log(`Collected ${strings.length} unique Chinese strings`);
  const translations = await translateAll(strings);
  writeDictionary(strings, translations);
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
