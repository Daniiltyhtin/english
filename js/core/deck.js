/**
 * Cards for a flashcard session: starred terms of the section if any, otherwise its unlearned terms.
 * @param {{sections: Array<{num: number, terms: Array<{id: string}>}>}} article
 * @param {{learned: Set<string>, starred: Set<string>}} marks
 * @param {number|'all'} section
 */
export function buildDeck(article, marks, section = 'all') {
  const terms = article.sections
    .filter((s) => section === 'all' || s.num === Number(section))
    .flatMap((s) => s.terms);
  const starred = terms.filter((t) => marks.starred.has(t.id));
  return starred.length > 0 ? starred : terms.filter((t) => !marks.learned.has(t.id));
}

function shuffle(items, rng) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Flashcard session over a fixed set of cards.
 * `cards` — the original set (for «Ещё раз»), `errorTerms` — cards that got «Не знаю» (for «Только ошибки»).
 * @param {Array<object>} cards
 * @param {() => number} [rng]
 */
export function createSession(cards, rng = Math.random) {
  const queue = shuffle(cards, rng);
  const errors = new Set();

  return {
    cards: [...cards],
    queue,
    flipped: false,
    get current() {
      return queue[0] ?? null;
    },
    get remaining() {
      return queue.length;
    },
    get done() {
      return queue.length === 0;
    },
    get errorTerms() {
      return cards.filter((t) => errors.has(t));
    },
    get stats() {
      return { known: cards.length, unknown: errors.size };
    },
    flip() {
      if (queue.length > 0) this.flipped = !this.flipped;
    },
    answer(known) {
      if (!this.flipped || queue.length === 0) return;
      const card = queue.shift();
      if (!known) {
        errors.add(card);
        queue.push(card);
      }
      this.flipped = false;
    },
  };
}
