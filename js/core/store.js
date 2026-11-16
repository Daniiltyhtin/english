export const PROGRESS_FORMAT = 'glossary-progress/v1';
const PROGRESS_KEY = 'glossary:progress';
const PREF_PREFIX = 'glossary:';
const IMPORT_ERROR = 'Файл не подходит: это не экспорт прогресса';

function safeGet(storage, key) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSet(storage, key, value) {
  try {
    storage?.setItem(key, value);
  } catch {}
}

function isIdList(value) {
  return Array.isArray(value) && value.every((id) => typeof id === 'string');
}

function isArticlesMap(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.values(value).every(
      (m) => m !== null && typeof m === 'object' && isIdList(m.learned) && isIdList(m.starred),
    )
  );
}

function parseArticles(text) {
  try {
    const value = JSON.parse(text);
    return isArticlesMap(value) ? value : {};
  } catch {
    return {};
  }
}

/**
 * Progress (✓ learned / ☆ starred per article) and UI prefs backed by a Storage-like object.
 * @param {{getItem(k: string): string|null, setItem(k: string, v: string): void}} storage
 */
export function createStore(storage) {
  let articles = parseArticles(safeGet(storage, PROGRESS_KEY) ?? '{}');
  const prefs = new Map();

  const save = () => safeSet(storage, PROGRESS_KEY, JSON.stringify(articles));

  return {
    getMarks(articleId) {
      const m = articles[articleId];
      return { learned: new Set(m?.learned ?? []), starred: new Set(m?.starred ?? []) };
    },

    toggle(articleId, termId, kind) {
      const m = (articles[articleId] ??= { learned: [], starred: [] });
      const list = m[kind];
      const at = list.indexOf(termId);
      if (at >= 0) list.splice(at, 1);
      else list.push(termId);
      save();
    },

    reset(articleId) {
      delete articles[articleId];
      save();
    },

    exportJson() {
      return JSON.stringify({ format: PROGRESS_FORMAT, articles }, null, 2);
    },

    importJson(text) {
      let value;
      try {
        value = JSON.parse(text);
      } catch {
        return { ok: false, error: IMPORT_ERROR };
      }
      if (value?.format !== PROGRESS_FORMAT || !isArticlesMap(value.articles)) {
        return { ok: false, error: IMPORT_ERROR };
      }
      articles = structuredClone(value.articles);
      save();
      return { ok: true };
    },

    getPref(key) {
      return prefs.has(key) ? prefs.get(key) : safeGet(storage, PREF_PREFIX + key);
    },

    setPref(key, value) {
      prefs.set(key, value);
      safeSet(storage, PREF_PREFIX + key, value);
    },
  };
}
