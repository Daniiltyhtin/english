/**
 * Terms of an article visible in the list view.
 * @param {{sections: Array<{num: number, terms: Array<object>}>}} article
 * @param {{learned: Set<string>, starred: Set<string>}} marks
 * @param {{query?: string, section?: number|'all', show?: 'all'|'unlearned'|'starred'}} options
 */
export function filterTerms(article, marks, { query = '', section = 'all', show = 'all' } = {}) {
  const needle = query.trim().toLocaleLowerCase('ru');
  return article.sections
    .filter((s) => section === 'all' || s.num === Number(section))
    .flatMap((s) => s.terms)
    .filter((t) => show !== 'unlearned' || !marks.learned.has(t.id))
    .filter((t) => show !== 'starred' || marks.starred.has(t.id))
    .filter(
      (t) =>
        !needle ||
        t.en.toLocaleLowerCase('ru').includes(needle) ||
        t.ru.toLocaleLowerCase('ru').includes(needle),
    );
}
