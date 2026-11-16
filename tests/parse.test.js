import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseGlossary, GlossaryParseError } from '../js/core/parse.js';

const read = (name) => readFile(new URL(`../data/${name}`, import.meta.url), 'utf8');

const HEADER = '| Термин (EN) | Транскрипция | Перевод (RU) |\n|---|---|---|';

test('ETL glossary: title, sections, counts, first and last term', async () => {
  const article = parseGlossary(await read('etl-maturity-model.md'), 'etl-maturity-model');
  assert.equal(article.id, 'etl-maturity-model');
  assert.equal(article.title, 'ETL Maturity Model for Data Warehouse Systems: A CMMI Compliant Framework');
  assert.deepEqual(
    article.sections.map((s) => [s.num, s.name, s.terms.length]),
    [
      [1, 'Сокращения и аббревиатуры', 31],
      [2, 'Хранилища данных и ETL', 16],
      [3, 'Модели зрелости и CMMI', 11],
      [4, 'Методология исследования и оценки', 9],
    ],
  );
  const first = article.sections[0].terms[0];
  assert.deepEqual(first, {
    id: '1|BI — Business Intelligence',
    en: 'BI — Business Intelligence',
    ipa: "[bi:'aɪ] — ['bɪznɪs ɪn'telɪʤ(ə)ns]",
    ru: 'бизнес-аналитика',
    sectionNum: 1,
  });
  const last = article.sections[3].terms.at(-1);
  assert.equal(last.en, 'robustness');
  assert.equal(last.ipa, "[rə'bʌstnɪs]");
  assert.equal(last.ru, 'устойчивость, робастность');
});

test('Agile glossary: 10 sections, 69 terms', async () => {
  const article = parseGlossary(await read('agile-methodologies.md'), 'agile-methodologies');
  assert.equal(article.title, 'Empirical Study of Agile Software Development Methodologies: A Comparative Analysis');
  assert.equal(article.sections.length, 10);
  assert.equal(article.sections.reduce((n, s) => n + s.terms.length, 0), 69);
});

test('keeps slash-style transcription as is', () => {
  const md = `# Словарь к статье «T»\n\n## 1. A\n\n${HEADER}\n| SDLC | /ˌes diː el ˈsiː/ | жизненный цикл |\n`;
  assert.equal(parseGlossary(md, 'x').sections[0].terms[0].ipa, '/ˌes diː el ˈsiː/');
});

test('same EN term in different sections gets different ids', () => {
  const md = `# «T»\n## 1. A\n${HEADER}\n| data | [d] | данные |\n## 2. B\n${HEADER}\n| data | [d] | данные |\n`;
  const ids = parseGlossary(md, 'x').sections.map((s) => s.terms[0].id);
  assert.deepEqual(ids, ['1|data', '2|data']);
});

test('ignores tables with other headers, rows before first section and italic notes', () => {
  const md = [
    '# Словарь «T»',
    '*Термин — транскрипция — перевод.*',
    HEADER,
    '| stray | [s] | лишнее |',
    '## 1. A',
    '| Other | Cols | Here |',
    '|---|---|---|',
    '| skip | [s] | пропуск |',
    '',
    HEADER,
    '| keep | [k] | оставить |',
  ].join('\n');
  const article = parseGlossary(md, 'x');
  assert.deepEqual(article.sections[0].terms.map((t) => t.en), ['keep']);
});

test('drops sections without terms', () => {
  const md = `# «T»\n## 1. Empty\ntext\n## 2. Full\n${HEADER}\n| a | [a] | а |\n`;
  assert.deepEqual(parseGlossary(md, 'x').sections.map((s) => s.num), [2]);
});

test('throws GlossaryParseError when there are no terms', () => {
  assert.throws(() => parseGlossary('', 'x'), GlossaryParseError);
  assert.throws(() => parseGlossary('# «T»\n## 1. A\nnothing here', 'x'), GlossaryParseError);
});

test('handles CRLF line endings', () => {
  const md = `# «T»\r\n## 1. A\r\n${HEADER.replace('\n', '\r\n')}\r\n| a | [a] | а |\r\n`;
  assert.equal(parseGlossary(md, 'x').sections[0].terms[0].ru, 'а');
});
