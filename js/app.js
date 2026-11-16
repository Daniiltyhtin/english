import { parseGlossary } from './core/parse.js';
import { filterTerms } from './core/filter.js';
import { buildDeck, createSession } from './core/deck.js';
import { createStore } from './core/store.js';
import { createSpeaker } from './speech.js';

const $ = (id) => document.getElementById(id);

const ui = {
  listView: $('list-view'),
  themeSelect: $('theme-select'),
  lookToggle: $('look-toggle'),
  articleSelect: $('article-select'),
  loading: $('loading'),
  loadError: $('load-error'),
  articleView: $('article-view'),
  progressText: $('progress-text'),
  progressBar: $('progress-bar'),
  progressFill: $('progress-fill'),
  search: $('search'),
  sectionSelect: $('section-select'),
  showSelect: $('show-select'),
  hideMode: $('hide-mode'),
  direction: $('direction'),
  startCards: $('start-cards'),
  terms: $('terms'),
  emptyList: $('empty-list'),
  exportBtn: $('export'),
  importBtn: $('import'),
  importFile: $('import-file'),
  resetBtn: $('reset'),
  notice: $('notice'),
  cardsView: $('cards-view'),
  toList: $('to-list'),
  directionLabel: $('direction-label'),
  remaining: $('remaining'),
  cardStage: $('card-stage'),
  card: $('card'),
  cardFront: $('card-front'),
  cardBack: $('card-back'),
  cardHint: $('card-hint'),
  answerRow: $('answer-row'),
  btnUnknown: $('btn-unknown'),
  btnKnown: $('btn-known'),
  cardsEmpty: $('cards-empty'),
  cardsDone: $('cards-done'),
  doneText: $('done-text'),
  again: $('again'),
  errorsOnly: $('errors-only'),
  resetDialog: $('reset-dialog'),
  resetText: $('reset-text'),
};

function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const store = createStore(browserStorage());
const speaker = createSpeaker();

const state = {
  entries: [],
  entry: null,
  marks: { learned: new Set(), starred: new Set() },
  termsById: new Map(),
  query: '',
  section: 'all',
  show: 'all',
  hideMode: 'none',
  revealed: new Set(),
  direction: store.getPref('direction') === 'ru-en' ? 'ru-en' : 'en-ru',
  session: null,
  cardsOpen: false,
  lookOn: true,
};

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  node.append(...children.filter((c) => c != null));
  return node;
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  else delete root.dataset.theme;
  ui.themeSelect.value = theme === 'light' || theme === 'dark' ? theme : 'system';
}

function applyLook() {
  const look = state.entry?.look;
  ui.lookToggle.hidden = !look;
  ui.lookToggle.setAttribute('aria-pressed', String(state.lookOn));
  if (look && state.lookOn) document.documentElement.dataset.look = look;
  else delete document.documentElement.dataset.look;
}

function applySpeechAvailability() {
  document.documentElement.classList.toggle('has-speech', speaker.available);
}

function speakButton(text, extraClass = '') {
  return el('button', {
    type: 'button',
    class: `speak ${extraClass}`.trim(),
    'aria-label': `Произнести: ${text}`,
    title: 'Произнести',
    dataset: { say: text },
    text: '🔊',
  });
}

async function fetchText(url) {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function loadEntries() {
  const list = JSON.parse(await fetchText('data/articles.json'));
  if (!Array.isArray(list)) throw new Error('articles.json');
  const valid = list.filter((item) => typeof item?.id === 'string' && typeof item?.file === 'string');
  return Promise.all(
    valid.map(async ({ id, file, look }) => {
      const lookName = typeof look === 'string' ? look : null;
      try {
        return { id, look: lookName, article: parseGlossary(await fetchText(file), id) };
      } catch {
        return { id, look: lookName, article: null };
      }
    }),
  );
}

function setPressed(group, attr, value) {
  for (const button of group.querySelectorAll(`[data-${attr}]`)) {
    button.setAttribute('aria-pressed', String(button.dataset[attr] === value));
  }
}

function showLoadError() {
  ui.loading.hidden = true;
  ui.articleView.hidden = true;
  ui.loadError.hidden = false;
}

function selectArticle(id) {
  const entry = state.entries.find((e) => e.id === id) ?? state.entries[0];
  state.entry = entry;
  state.lookOn = true;
  applyLook();
  ui.articleSelect.value = entry.id;
  ui.loading.hidden = true;
  state.section = 'all';
  state.revealed.clear();
  ui.notice.textContent = '';

  if (!entry.article) {
    showLoadError();
    return;
  }

  ui.loadError.hidden = true;
  ui.articleView.hidden = false;
  state.termsById = new Map(
    entry.article.sections.flatMap((s) => s.terms).map((t) => [t.id, t]),
  );
  ui.sectionSelect.replaceChildren(
    el('option', { value: 'all', text: 'Все разделы' }),
    ...entry.article.sections.map((s) => el('option', { value: String(s.num), text: `${s.num}. ${s.name}` })),
  );
  ui.sectionSelect.value = 'all';
  refreshMarks();
}

function refreshMarks() {
  state.marks = store.getMarks(state.entry.id);
  renderProgress();
  renderList();
}

function renderProgress() {
  const total = state.termsById.size;
  let learned = 0;
  for (const id of state.termsById.keys()) if (state.marks.learned.has(id)) learned++;
  ui.progressText.textContent = `Выучено: ${learned} из ${total}`;
  ui.progressBar.setAttribute('aria-valuemax', String(total));
  ui.progressBar.setAttribute('aria-valuenow', String(learned));
  ui.progressFill.style.width = total ? `${(learned / total) * 100}%` : '0';
}

function markButton(term, kind) {
  const on = state.marks[kind].has(term.id);
  const learned = kind === 'learned';
  return el('button', {
    type: 'button',
    class: `mark mark-${kind}`,
    'aria-pressed': String(on),
    'aria-label': `${learned ? 'Выучил' : 'В повторение'}: ${term.en}`,
    title: learned ? 'Выучил' : 'В повторение',
    dataset: { id: term.id, kind },
    text: learned ? '✓' : on ? '★' : '☆',
  });
}

function plaque(term, label) {
  return el('button', {
    type: 'button',
    class: 'plaque',
    'aria-label': label,
    dataset: { reveal: term.id },
    text: 'показать',
  });
}

function termRow(term) {
  const hidden = !state.revealed.has(term.id);
  const row = el(
    'tr',
    { class: 'term-row', dataset: { id: term.id } },
    el('td', { class: 'c-learned' }, markButton(term, 'learned')),
    el('td', { class: 'c-star' }, markButton(term, 'starred')),
  );
  if (state.hideMode === 'term' && hidden) {
    row.append(el('td', { class: 'c-term-plaque', colspan: 2 }, plaque(term, 'Показать термин')));
  } else {
    row.append(
      el('td', { class: 'c-en' }, el('span', { class: 'en-text', text: term.en }), ' ', speakButton(term.en)),
      el('td', { class: 'c-ipa', text: term.ipa }),
    );
  }
  if (state.hideMode === 'ru' && hidden) {
    row.append(el('td', { class: 'c-ru c-ru-plaque' }, plaque(term, 'Показать перевод')));
  } else {
    row.append(el('td', { class: 'c-ru', text: term.ru }));
  }
  return row;
}

function renderList() {
  const article = state.entry.article;
  const visible = new Set(
    filterTerms(article, state.marks, { query: state.query, section: state.section, show: state.show }).map(
      (t) => t.id,
    ),
  );
  const bodies = [];
  for (const section of article.sections) {
    const terms = section.terms.filter((t) => visible.has(t.id));
    if (terms.length === 0) continue;
    bodies.push(
      el(
        'tbody',
        { class: 'section' },
        el(
          'tr',
          { class: 'section-row' },
          el('th', { colspan: 5, scope: 'colgroup', text: `${section.num}. ${section.name}` }),
        ),
        ...terms.map(termRow),
      ),
    );
  }
  for (const body of ui.terms.querySelectorAll('tbody')) body.remove();
  ui.terms.append(...bodies);
  ui.terms.hidden = bodies.length === 0;
  ui.emptyList.hidden = bodies.length > 0;
}

function focusMark(id, kind) {
  for (const button of ui.terms.querySelectorAll('.mark')) {
    if (button.dataset.id === id && button.dataset.kind === kind) {
      button.focus();
      return;
    }
  }
}

function onTermsClick(event) {
  const mark = event.target.closest('.mark');
  if (mark) {
    const { id, kind } = mark.dataset;
    store.toggle(state.entry.id, id, kind);
    refreshMarks();
    focusMark(id, kind);
    return;
  }
  const reveal = event.target.closest('.plaque');
  if (reveal) {
    const id = reveal.dataset.reveal;
    state.revealed.add(id);
    const row = reveal.closest('tr');
    const term = state.termsById.get(id);
    if (row && term) row.replaceWith(termRow(term));
  }
}

function showNotice(text, kind) {
  ui.notice.textContent = text;
  ui.notice.dataset.kind = kind;
}

function exportProgress() {
  const blob = new Blob([store.exportJson()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const link = el('a', { href: url, download: `glossary-progress-${date}.json` });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importProgress() {
  const file = ui.importFile.files?.[0];
  ui.importFile.value = '';
  if (!file) return;
  let text = '';
  try {
    text = await file.text();
  } catch {
    text = '';
  }
  const result = store.importJson(text);
  if (!result.ok) {
    showNotice(result.error, 'error');
    return;
  }
  showNotice('Прогресс загружен из файла', 'ok');
  if (state.entry?.article) refreshMarks();
}

function askReset() {
  if (!state.entry?.article) return;
  ui.resetText.textContent = `Сбросить отметки ✓ и ☆ для статьи «${state.entry.article.title}»?`;
  ui.resetDialog.returnValue = '';
  ui.resetDialog.showModal();
}

function onResetClose() {
  if (ui.resetDialog.returnValue !== 'confirm' || !state.entry?.article) return;
  store.reset(state.entry.id);
  ui.notice.textContent = '';
  refreshMarks();
}

function openCards() {
  const deck = buildDeck(state.entry.article, state.marks, state.section);
  state.session = deck.length > 0 ? createSession(deck) : null;
  state.cardsOpen = true;
  ui.cardsView.hidden = false;
  ui.listView.inert = true;
  document.documentElement.classList.add('cards-open');
  ui.directionLabel.textContent = state.direction === 'en-ru' ? 'EN→RU' : 'RU→EN';
  renderCards();
  ui.toList.focus();
}

function closeCards() {
  state.session = null;
  state.cardsOpen = false;
  ui.cardsView.hidden = true;
  ui.listView.inert = false;
  document.documentElement.classList.remove('cards-open');
  ui.startCards.focus();
}

function startSession(cards) {
  state.session = createSession(cards);
  renderCards();
}

function cardSides(term) {
  const en = [
    el('p', { class: 'card-en', text: term.en }),
    el('p', { class: 'card-ipa', text: term.ipa }),
    speakButton(term.en, 'speak-lg'),
  ];
  const ru = [el('p', { class: 'card-ru', text: term.ru })];
  return state.direction === 'en-ru' ? [en, ru] : [ru, en];
}

function renderCards() {
  const session = state.session;
  const empty = session === null;
  const done = !empty && session.done;
  const active = !empty && !done;

  ui.cardsEmpty.hidden = !empty;
  ui.cardsDone.hidden = !done;
  ui.cardStage.hidden = !active;
  ui.answerRow.hidden = !active;
  ui.remaining.hidden = !active;
  ui.directionLabel.hidden = !active;

  if (done) {
    const { known, unknown } = session.stats;
    ui.doneText.textContent = `Готово: знаю — ${known}, не знаю — ${unknown}`;
    ui.errorsOnly.hidden = unknown === 0;
    ui.again.focus();
    return;
  }
  if (!active) return;

  const [front, back] = cardSides(session.current);
  ui.remaining.textContent = `Осталось: ${session.remaining}`;
  ui.cardFront.replaceChildren(...front);
  ui.cardBack.replaceChildren(...back);
  ui.cardBack.hidden = !session.flipped;
  ui.cardHint.hidden = session.flipped;
  ui.card.classList.toggle('is-flipped', session.flipped);
  ui.card.scrollTop = 0;
  ui.btnKnown.disabled = !session.flipped;
  ui.btnUnknown.disabled = !session.flipped;
}

function flipCard() {
  const session = state.session;
  if (!session || session.done || session.flipped) return;
  session.flip();
  renderCards();
}

function answerCard(known) {
  const session = state.session;
  if (!session || session.done || !session.flipped) return;
  session.answer(known);
  renderCards();
}

function isTypingTarget(target) {
  return target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]') !== null;
}

function onKeyDown(event) {
  if (!state.cardsOpen || !state.session || state.session.done) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (isTypingTarget(event.target)) return;
  if (event.key === ' ' || event.key === 'Spacebar') {
    event.preventDefault();
    flipCard();
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    answerCard(true);
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    answerCard(false);
  }
}

function bindEvents() {
  ui.themeSelect.addEventListener('change', () => {
    store.setPref('theme', ui.themeSelect.value);
    applyTheme(ui.themeSelect.value);
  });

  ui.lookToggle.addEventListener('click', () => {
    state.lookOn = !state.lookOn;
    applyLook();
  });

  ui.articleSelect.addEventListener('change', () => {
    store.setPref('article', ui.articleSelect.value);
    selectArticle(ui.articleSelect.value);
  });

  ui.search.addEventListener('input', () => {
    state.query = ui.search.value;
    renderList();
  });

  ui.sectionSelect.addEventListener('change', () => {
    state.section = ui.sectionSelect.value === 'all' ? 'all' : Number(ui.sectionSelect.value);
    renderList();
  });

  ui.showSelect.addEventListener('change', () => {
    state.show = ui.showSelect.value;
    renderList();
  });

  ui.hideMode.addEventListener('click', (event) => {
    const button = event.target.closest('[data-mode]');
    if (!button) return;
    state.hideMode = button.dataset.mode;
    state.revealed.clear();
    setPressed(ui.hideMode, 'mode', state.hideMode);
    renderList();
  });

  ui.direction.addEventListener('click', (event) => {
    const button = event.target.closest('[data-direction]');
    if (!button) return;
    state.direction = button.dataset.direction;
    store.setPref('direction', state.direction);
    setPressed(ui.direction, 'direction', state.direction);
  });

  ui.terms.addEventListener('click', onTermsClick);

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('.speak');
    if (button) speaker.speak(button.dataset.say);
  });

  ui.exportBtn.addEventListener('click', exportProgress);
  ui.importBtn.addEventListener('click', () => ui.importFile.click());
  ui.importFile.addEventListener('change', importProgress);
  ui.resetBtn.addEventListener('click', askReset);
  ui.resetDialog.addEventListener('close', onResetClose);

  ui.startCards.addEventListener('click', openCards);
  ui.toList.addEventListener('click', closeCards);
  ui.card.addEventListener('click', (event) => {
    if (event.target.closest('.speak')) return;
    flipCard();
  });
  ui.btnKnown.addEventListener('click', () => answerCard(true));
  ui.btnUnknown.addEventListener('click', () => answerCard(false));
  ui.again.addEventListener('click', () => startSession(state.session.cards));
  ui.errorsOnly.addEventListener('click', () => startSession(state.session.errorTerms));

  document.addEventListener('keydown', onKeyDown);
}

async function init() {
  applyTheme(store.getPref('theme'));
  applySpeechAvailability();
  speaker.onChange(applySpeechAvailability);
  setPressed(ui.direction, 'direction', state.direction);
  bindEvents();

  try {
    state.entries = await loadEntries();
  } catch {
    state.entries = [];
  }
  if (state.entries.length === 0) {
    ui.articleSelect.disabled = true;
    showLoadError();
    return;
  }

  ui.articleSelect.replaceChildren(
    ...state.entries.map((e) => el('option', { value: e.id, text: e.article?.title ?? e.id })),
  );
  selectArticle(store.getPref('article'));
}

init();
