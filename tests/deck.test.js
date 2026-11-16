import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDeck, createSession } from '../js/core/deck.js';
import { loadEtl, allTerms, marks, seededRng } from './helpers.js';

const article = await loadEtl();
const ens = (terms) => terms.map((t) => t.en).sort();

test('starred terms form the deck, including learned ones', () => {
  const m = marks(article, { starred: ['OLAP', 'ETL', 'data mart'], learned: ['ETL'] });
  assert.deepEqual(ens(buildDeck(article, m, 'all')), [
    'ETL — Extract, Transform, Load',
    'OLAP — Online Analytical Processing',
    'data mart',
  ]);
});

test('without stars the deck is all unlearned terms', () => {
  const learned = allTerms(article).slice(0, 60).map((t) => t.en);
  assert.equal(buildDeck(article, marks(article, { learned }), 'all').length, 7);
});

test('section filter applies before the starred rule', () => {
  const m = marks(article, { starred: ['OLAP', 'data mart'] });
  assert.deepEqual(ens(buildDeck(article, m, 2)), ['data mart']);
});

test('section without stars falls back to its unlearned terms even if other sections have stars', () => {
  const m = marks(article, { starred: ['OLAP'] });
  assert.equal(buildDeck(article, m, 4).length, 9);
});

test('everything learned and nothing starred gives an empty deck', () => {
  const learned = allTerms(article).map((t) => t.en);
  assert.deepEqual(buildDeck(article, marks(article, { learned }), 'all'), []);
});

function deckOf(...names) {
  return names.map((en) => allTerms(article).find((t) => t.en === en || t.en.startsWith(`${en} —`)));
}

test('empty session is done immediately', () => {
  const s = createSession([], seededRng(1));
  assert.equal(s.done, true);
  assert.equal(s.current, null);
  assert.equal(s.remaining, 0);
});

test('answer before flip is ignored; unknown goes to the end', () => {
  const s = createSession(deckOf('OLAP', 'ETL', 'data mart'), seededRng(1));
  const first = s.current;
  assert.equal(s.remaining, 3);
  s.answer(false);
  assert.equal(s.current, first);
  assert.equal(s.flipped, false);
  s.flip();
  assert.equal(s.flipped, true);
  s.answer(false);
  assert.equal(s.remaining, 3);
  assert.notEqual(s.current, first);
  assert.equal(s.flipped, false);
  s.flip(); s.answer(true);
  s.flip(); s.answer(true);
  assert.equal(s.current, first);
});

test('stats after one mistake', () => {
  const s = createSession(deckOf('OLAP', 'ETL', 'data mart'), seededRng(2));
  while (!s.done) {
    s.flip();
    const isEtl = s.current.en.startsWith('ETL');
    s.answer(!(isEtl && s.errorTerms.length === 0));
  }
  assert.deepEqual(s.stats, { known: 3, unknown: 1 });
  assert.deepEqual(s.errorTerms.map((t) => t.en), ['ETL — Extract, Transform, Load']);
  assert.equal(s.remaining, 0);
});

test('flawless session has zero unknown', () => {
  const s = createSession(deckOf('OLAP', 'ETL'), seededRng(3));
  while (!s.done) { s.flip(); s.answer(true); }
  assert.deepEqual(s.stats, { known: 2, unknown: 0 });
  assert.deepEqual(s.errorTerms, []);
});

test('repeated mistakes on one card count once', () => {
  const s = createSession(deckOf('OLAP'), seededRng(4));
  s.flip(); s.answer(false);
  s.flip(); s.answer(false);
  s.flip(); s.answer(true);
  assert.deepEqual(s.stats, { known: 1, unknown: 1 });
});

test('session keeps the original card set for a repeat', () => {
  const cards = deckOf('OLAP', 'ETL', 'data mart');
  const s = createSession(cards, seededRng(5));
  assert.deepEqual(ens(s.cards), ens(cards));
});

test('shuffle depends on rng and is reproducible', () => {
  const cards = article.sections[0].terms.slice(0, 10);
  const order = (seed) => createSession(cards, seededRng(seed)).queue.map((t) => t.en).join();
  assert.equal(order(7), order(7));
  const orders = new Set([order(1), order(2), order(3)]);
  assert.ok(orders.size >= 2);
});

test('does not mutate the input array', () => {
  const cards = deckOf('OLAP', 'ETL', 'data mart');
  const copy = [...cards];
  createSession(cards, seededRng(6));
  assert.deepEqual(cards, copy);
});
