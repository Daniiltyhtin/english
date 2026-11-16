import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterTerms } from '../js/core/filter.js';
import { loadEtl, allTerms, marks } from './helpers.js';

const article = await loadEtl();
const none = marks(article);
const ALL = { query: '', section: 'all', show: 'all' };

test('no filters returns all terms in source order', () => {
  assert.deepEqual(filterTerms(article, none, ALL), allTerms(article));
});

test('search is case-insensitive over EN and RU', () => {
  const found = filterTerms(article, none, { ...ALL, query: 'ХРАНИЛИЩ' }).map((t) => t.en);
  assert.ok(found.includes('DW — Data Warehouse'));
  assert.ok(found.includes('data warehouse'));
  assert.ok(!found.includes('data mart'));
  const byEn = filterTerms(article, none, { ...ALL, query: 'likert' }).map((t) => t.en);
  assert.deepEqual(byEn, ['Likert scale']);
});

test('search ignores surrounding whitespace', () => {
  assert.equal(filterTerms(article, none, { ...ALL, query: '  likert ' }).length, 1);
});

test('section filter keeps only that section', () => {
  const terms = filterTerms(article, none, { ...ALL, section: 2 });
  assert.equal(terms.length, 16);
  assert.ok(terms.every((t) => t.sectionNum === 2));
});

test('unlearned in a fully learned section is empty', () => {
  const methodology = article.sections.find((s) => s.num === 4).terms.map((t) => t.en);
  const m = marks(article, { learned: methodology });
  assert.deepEqual(filterTerms(article, m, { ...ALL, section: 4, show: 'unlearned' }), []);
});

test('starred filter includes learned starred terms', () => {
  const m = marks(article, { learned: ['OLAP'], starred: ['OLAP'] });
  assert.deepEqual(filterTerms(article, m, { ...ALL, show: 'starred' }).map((t) => t.en), [
    'OLAP — Online Analytical Processing',
  ]);
});

test('filters combine', () => {
  const m = marks(article, { starred: ['data mart', 'OLAP'] });
  const terms = filterTerms(article, m, { query: 'витрин', section: 2, show: 'starred' });
  assert.deepEqual(terms.map((t) => t.en), ['data mart']);
});
