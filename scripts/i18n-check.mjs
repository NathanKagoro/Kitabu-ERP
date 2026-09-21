#!/usr/bin/env node
/**
 * Fails the build when the translations have drifted.
 *
 * Two checks:
 *   1. Every locale has exactly the same set of keys. A missing Swahili string
 *      is a product bug, not a nicety -- it shows an English word to someone who
 *      did not ask for one.
 *   2. Every t('...') used in the source resolves to a real key, so a renamed
 *      key cannot quietly ship as raw dots on screen.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const messagesDir = join(root, 'messages');
const SOURCE_DIRS = ['app', 'components', 'lib', 'server'];
const SOURCE_EXT = /\.(ts|tsx)$/;

const problems = [];

// --- 1. locale parity -------------------------------------------------------

const locales = readdirSync(messagesDir)
  .filter((file) => file.endsWith('.json'))
  .map((file) => file.replace(/\.json$/, ''));

if (locales.length === 0) {
  console.error('i18n:check — no message files found in /messages');
  process.exit(1);
}

const messages = Object.fromEntries(
  locales.map((locale) => [locale, JSON.parse(readFileSync(join(messagesDir, `${locale}.json`), 'utf8'))])
);

function flatten(object, prefix = '', out = new Map()) {
  for (const [key, value] of Object.entries(object)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) flatten(value, path, out);
    else out.set(path, value);
  }
  return out;
}

const flat = Object.fromEntries(locales.map((locale) => [locale, flatten(messages[locale])]));
const reference = locales.includes('sw') ? 'sw' : locales[0];
const allKeys = new Set(Object.values(flat).flatMap((map) => [...map.keys()]));

for (const locale of locales) {
  for (const key of allKeys) {
    if (!flat[locale].has(key)) problems.push(`missing key  ${locale}: ${key}`);
  }
}

// An empty string renders as nothing at all, which looks like a broken screen.
for (const locale of locales) {
  for (const [key, value] of flat[locale]) {
    if (typeof value !== 'string' || value.trim() === '') {
      problems.push(`empty value  ${locale}: ${key}`);
    }
  }
}

// ICU placeholders must match across locales or one language crashes at runtime.
const placeholders = (value) => new Set([...String(value).matchAll(/\{(\w+)[,}]/g)].map((m) => m[1]));
for (const key of flat[reference].keys()) {
  const expected = placeholders(flat[reference].get(key));
  for (const locale of locales) {
    if (locale === reference || !flat[locale].has(key)) continue;
    const actual = placeholders(flat[locale].get(key));
    for (const name of expected) {
      if (!actual.has(name)) problems.push(`missing {${name}}  ${locale}: ${key}`);
    }
    for (const name of actual) {
      if (!expected.has(name)) problems.push(`unexpected {${name}}  ${locale}: ${key}`);
    }
  }
}

// --- 2. keys used in source -------------------------------------------------

function walk(dir, files = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (SOURCE_EXT.test(entry)) files.push(full);
  }
  return files;
}

const sourceFiles = SOURCE_DIRS.flatMap((dir) => walk(join(root, dir)));
const knownKeys = flat[reference];

for (const file of sourceFiles) {
  const code = readFileSync(file, 'utf8');
  const namespaces = [
    ...code.matchAll(/(?:useTranslations|getTranslations)\(\s*['"]([\w.]+)['"]\s*\)/g),
  ].map((match) => match[1]);
  // A file that calls t() without a namespace is using root-level keys.
  if (/(?:useTranslations|getTranslations)\(\s*\)/.test(code)) namespaces.push('');

  if (namespaces.length === 0) continue;

  for (const match of code.matchAll(/\bt(?:\.rich)?\(\s*['"]([\w.]+)['"]/g)) {
    const key = match[1];
    const resolves = namespaces.some((ns) => knownKeys.has(ns ? `${ns}.${key}` : key));
    if (!resolves) {
      problems.push(`unknown key  ${relative(root, file)}: t('${key}') [${namespaces.join(', ')}]`);
    }
  }
}

// --- report -----------------------------------------------------------------

if (problems.length > 0) {
  console.error(`i18n:check — ${problems.length} problem(s):\n`);
  for (const problem of problems.sort()) console.error(`  ${problem}`);
  console.error('');
  process.exit(1);
}

console.log(
  `i18n:check — ok (${allKeys.size} keys x ${locales.length} locales: ${locales.join(', ')})`
);
