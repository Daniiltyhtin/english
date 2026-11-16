import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, PROGRESS_FORMAT } from '../js/core/store.js';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
}

const A = 'etl-maturity-model';
const B = 'agile-methodologies';

test('marks survive a new store over the same storage', () => {
  const storage = memoryStorage();
  const s1 = createStore(storage);
  s1.toggle(A, '1|BI', 'learned');
  s1.toggle(A, '1|DW', 'learned');
  s1.toggle(A, '1|OLAP', 'starred');
  const m = createStore(storage).getMarks(A);
  assert.deepEqual([...m.learned].sort(), ['1|BI', '1|DW']);
  assert.deepEqual([...m.starred], ['1|OLAP']);
});

test('toggle twice removes the mark; learned and starred are independent', () => {
  const s = createStore(memoryStorage());
  s.toggle(A, '1|OLAP', 'learned');
  s.toggle(A, '1|OLAP', 'starred');
  s.toggle(A, '1|OLAP', 'learned');
  const m = s.getMarks(A);
  assert.equal(m.learned.has('1|OLAP'), false);
  assert.equal(m.starred.has('1|OLAP'), true);
});

test('marks are per article', () => {
  const s = createStore(memoryStorage());
  s.toggle(A, '2|data warehouse', 'learned');
  assert.equal(s.getMarks(B).learned.size, 0);
  assert.equal(s.getMarks(B).starred.size, 0);
});

test('reset clears only the given article', () => {
  const s = createStore(memoryStorage());
  s.toggle(A, '1|BI', 'learned');
  s.toggle(A, '2|data mart', 'starred');
  s.toggle(B, '1|XP', 'learned');
  s.reset(A);
  assert.equal(s.getMarks(A).learned.size, 0);
  assert.equal(s.getMarks(A).starred.size, 0);
  assert.deepEqual([...s.getMarks(B).learned], ['1|XP']);
});

test('export, reset, change, import restores the exported state', () => {
  const s = createStore(memoryStorage());
  for (const id of ['1|BI', '1|DW', '1|ETL', '1|OLAP', '1|KPA']) s.toggle(A, id, 'learned');
  s.toggle(A, '2|data mart', 'starred');
  const exported = s.exportJson();
  assert.equal(JSON.parse(exported).format, PROGRESS_FORMAT);
  s.reset(A);
  s.toggle(A, '4|uptime', 'learned');
  assert.deepEqual(s.importJson(exported), { ok: true });
  const m = s.getMarks(A);
  assert.deepEqual([...m.learned].sort(), ['1|BI', '1|DW', '1|ETL', '1|KPA', '1|OLAP']);
  assert.deepEqual([...m.starred], ['2|data mart']);
});

test('import replaces all progress, dropping articles absent from the file', () => {
  const s = createStore(memoryStorage());
  s.toggle(A, '1|BI', 'learned');
  const exported = s.exportJson();
  s.toggle(B, '1|XP', 'learned');
  s.importJson(exported);
  assert.equal(s.getMarks(B).learned.size, 0);
  assert.equal(s.getMarks(A).learned.has('1|BI'), true);
});

for (const [name, text] of [
  ['plain text', 'hello'],
  ['foreign json', '{"a":1}'],
  ['wrong format tag', JSON.stringify({ format: 'other', articles: {} })],
  ['bad articles shape', JSON.stringify({ format: PROGRESS_FORMAT, articles: [] })],
  ['bad marks shape', JSON.stringify({ format: PROGRESS_FORMAT, articles: { a: { learned: 'x', starred: [] } } })],
  ['non-string ids', JSON.stringify({ format: PROGRESS_FORMAT, articles: { a: { learned: [1], starred: [] } } })],
]) {
  test(`import rejects ${name} and keeps progress`, () => {
    const s = createStore(memoryStorage());
    s.toggle(A, '1|BI', 'learned');
    assert.deepEqual(s.importJson(text), { ok: false, error: 'Файл не подходит: это не экспорт прогресса' });
    assert.equal(s.getMarks(A).learned.has('1|BI'), true);
  });
}

test('prefs round-trip and default to null', () => {
  const storage = memoryStorage();
  const s = createStore(storage);
  assert.equal(s.getPref('theme'), null);
  s.setPref('theme', 'dark');
  s.setPref('article', B);
  assert.equal(createStore(storage).getPref('theme'), 'dark');
  assert.equal(createStore(storage).getPref('article'), B);
});

test('broken storage does not throw and keeps marks in memory', () => {
  const broken = {
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('denied'); },
    removeItem() { throw new Error('denied'); },
  };
  const s = createStore(broken);
  s.toggle(A, '1|BI', 'learned');
  assert.equal(s.getMarks(A).learned.has('1|BI'), true);
  s.setPref('theme', 'dark');
  assert.equal(s.getPref('theme'), 'dark');
});

test('corrupted stored progress is treated as empty', () => {
  const storage = memoryStorage();
  storage.setItem('glossary:progress', '{oops');
  assert.equal(createStore(storage).getMarks(A).learned.size, 0);
});

test('getMarks returns copies that do not leak into the store', () => {
  const s = createStore(memoryStorage());
  s.getMarks(A).learned.add('1|BI');
  assert.equal(s.getMarks(A).learned.size, 0);
});
