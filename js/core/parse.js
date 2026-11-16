export class GlossaryParseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GlossaryParseError';
  }
}

const TERM_HEADER = ['Термин (EN)', 'Транскрипция', 'Перевод (RU)'];
const SECTION_RE = /^##\s+(\d+)\.\s+(.+?)\s*$/;
const TITLE_RE = /«(.+)»/;
const SEPARATOR_RE = /^\|(\s*:?-+:?\s*\|)+\s*$/;

function splitRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
  return trimmed.slice(1, -1).split('|').map((cell) => cell.trim());
}

function isTermHeader(cells) {
  return cells?.length === TERM_HEADER.length && cells.every((cell, i) => cell === TERM_HEADER[i]);
}

/**
 * Parses a glossary markdown file into an article.
 * @param {string} text markdown source
 * @param {string} articleId id from data/articles.json
 * @returns {{id: string, title: string, sections: Array<{num: number, name: string, terms: Array<{id: string, en: string, ipa: string, ru: string, sectionNum: number}>}>}}
 * @throws {GlossaryParseError} when no term rows are found
 */
export function parseGlossary(text, articleId) {
  let title = '';
  const sections = [];
  let section = null;
  let tableState = 'none';

  for (const line of text.split(/\r?\n/)) {
    if (!title && line.startsWith('# ')) {
      title = line.match(TITLE_RE)?.[1] ?? line.slice(2).trim();
      continue;
    }
    const sectionMatch = line.match(SECTION_RE);
    if (sectionMatch) {
      section = { num: Number(sectionMatch[1]), name: sectionMatch[2], terms: [] };
      sections.push(section);
      tableState = 'none';
      continue;
    }
    const cells = splitRow(line);
    if (!cells) {
      tableState = 'none';
      continue;
    }
    if (tableState === 'none') {
      tableState = section && isTermHeader(cells) ? 'header' : 'other';
    } else if (tableState === 'header') {
      tableState = SEPARATOR_RE.test(line.trim()) ? 'rows' : 'other';
    } else if (tableState === 'rows' && cells.length === TERM_HEADER.length) {
      const [en, ipa, ru] = cells;
      if (en) section.terms.push({ id: `${section.num}|${en}`, en, ipa, ru, sectionNum: section.num });
    }
  }

  const filled = sections.filter((s) => s.terms.length > 0);
  if (filled.length === 0) throw new GlossaryParseError('В словаре не найдено ни одной строки таблицы терминов');
  return { id: articleId, title, sections: filled };
}
