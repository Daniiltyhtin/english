import { readFile } from 'node:fs/promises';
import { parseGlossary } from '../js/core/parse.js';

export async function loadEtl() {
  const text = await readFile(new URL('../data/etl-maturity-model.md', import.meta.url), 'utf8');
  return parseGlossary(text, 'etl-maturity-model');
}

export function allTerms(article) {
  return article.sections.flatMap((s) => s.terms);
}

export function termId(article, en) {
  const term = allTerms(article).find((t) => t.en === en || t.en.startsWith(`${en} —`));
  if (!term) throw new Error(`no term ${en}`);
  return term.id;
}

export function marks(article, { learned = [], starred = [] } = {}) {
  return {
    learned: new Set(learned.map((en) => termId(article, en))),
    starred: new Set(starred.map((en) => termId(article, en))),
  };
}

export function seededRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}
