import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseGlossary } from '../js/core/parse.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const FORBIDDEN = /даня|даниил|danya|dania|соня|sonya|sonia/i;

test('every article in articles.json exists and parses', async () => {
  const articles = JSON.parse(await readFile(path.join(root, 'data/articles.json'), 'utf8'));
  assert.ok(articles.length >= 1);
  assert.equal(new Set(articles.map((a) => a.id)).size, articles.length);
  for (const { id, file } of articles) {
    const article = parseGlossary(await readFile(path.join(root, file), 'utf8'), id);
    assert.ok(article.title, `${file} has a title`);
  }
});

test('no student names in file paths or contents', async () => {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(entry.parentPath, entry.name);
    const rel = path.relative(root, full);
    if (rel.startsWith('.git') || rel.startsWith('node_modules')) continue;
    assert.doesNotMatch(rel, FORBIDDEN, `path ${rel}`);
    if (entry.isFile() && rel !== path.join('tests', 'data.test.js')) {
      assert.doesNotMatch(await readFile(full, 'utf8'), FORBIDDEN, `content of ${rel}`);
    }
  }
});
