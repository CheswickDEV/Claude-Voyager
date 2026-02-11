/**
 * Prompt Library feature module.
 *
 * Floating button + panel for managing prompt templates.
 * - Save prompts with title, content, tags, category
 * - Tag-based search and filtering
 * - One-click insertion into claude.ai input field
 * - Import/Export as JSON
 */

import type { FeatureModule } from '@pages/content/index';
import type { VoyagerSettings, SavedPrompt, Locale } from '@core/types';
import { DOM } from '@core/services/DOMService';
import { Storage } from '@core/services/StorageService';
import { Logger } from '@core/services/LoggerService';
import { uuid } from '@core/utils';
import { t } from '@i18n/index';
import { PROMPT_CSS } from './PromptStyles';

let locale: Locale = 'en';

const TAG = 'Prompts';

interface PromptState {
  prompts: SavedPrompt[];
  searchQuery: string;
  panelOpen: boolean;
  showForm: boolean;
  editingId: string | null;
  trigger: HTMLElement | null;
  panel: HTMLElement | null;
  cleanups: (() => void)[];
}

function createState(): PromptState {
  return {
    prompts: [],
    searchQuery: '',
    panelOpen: false,
    showForm: false,
    editingId: null,
    trigger: null,
    panel: null,
    cleanups: [],
  };
}

let state: PromptState = createState();

// ─── Rendering ──────────────────────────────────────────────────

/** SVG icon for the prompt library button (book/document style, 18x18) */
const PROMPT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><line x1="9" y1="7" x2="17" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/></svg>`;

/**
 * Render the trigger button inside claude.ai's chat input toolbar.
 * Injects next to the voice mode button for a native look.
 * Falls back to a floating button if the toolbar isn't found.
 */
function renderTrigger(): void {
  if (state.trigger) return;

  const btn = document.createElement('button');
  btn.setAttribute('data-voyager', 'prompt-trigger');
  btn.setAttribute('data-voyager-tooltip', t(locale).promptLibrary);
  btn.setAttribute('data-voyager-tooltip-pos', 'left');
  btn.setAttribute('aria-label', t(locale).promptLibrary);
  btn.className = 'voyager-prompt-trigger-native';

  // Parse SVG safely
  try {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(PROMPT_SVG, 'image/svg+xml');
    const svgEl = svgDoc.documentElement;
    btn.appendChild(document.importNode(svgEl, true));
  } catch {
    btn.textContent = '\u{1F4DD}';
  }

  const onTriggerClick = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    togglePanel();
  };
  btn.addEventListener('click', onTriggerClick);
  state.cleanups.push(() => btn.removeEventListener('click', onTriggerClick));

  // Try to inject into the chat input toolbar area
  const injected = injectIntoToolbar(btn);
  if (!injected) {
    // Fallback: floating button
    btn.className = 'voyager-prompt-trigger';
    document.body.appendChild(btn);
  }

  state.trigger = btn;
}

/**
 * Inject the button into claude.ai's chat input bottom toolbar.
 * Looks for the row containing the model selector and voice mode button,
 * then appends our button at the end (right side).
 */
function injectIntoToolbar(btn: HTMLElement): boolean {
  // The chat input area: [data-testid="chat-input"] or the fieldset around it
  // The bottom toolbar row typically contains the model picker and voice button
  // We look for the voice mode button and inject next to it
  const voiceBtn = document.querySelector('button[aria-label*="prachmod" i], button[aria-label*="voice" i]');
  if (voiceBtn?.parentElement) {
    voiceBtn.parentElement.insertBefore(btn, voiceBtn);
    return true;
  }

  // Alternative: find the bottom toolbar row in the chat input area
  const chatInput = document.querySelector('[data-testid="chat-input"]');
  if (chatInput) {
    // The toolbar row is typically the last flex row with buttons
    const rows = chatInput.querySelectorAll('div.flex');
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i] as HTMLElement;
      // Check if this row has buttons (model selector, voice, etc.)
      if (row.querySelector('button') && row.closest('[data-testid="chat-input"]')) {
        row.appendChild(btn);
        return true;
      }
    }
  }

  return false;
}

function togglePanel(): void {
  state.panelOpen = !state.panelOpen;
  if (state.panelOpen) {
    renderPanel();
  } else {
    removePanel();
  }
}

function renderPanel(): void {
  removePanel();

  const panel = DOM.createElement('div', {
    'data-voyager': 'prompt-panel',
    class: 'voyager-prompt-panel',
  });

  // Header
  const header = DOM.createElement('div', { class: 'voyager-prompt-panel-header' });
  const title = DOM.createElement('span', { class: 'voyager-prompt-panel-title' }, [t(locale).promptLibrary]);
  const actions = DOM.createElement('div', { class: 'voyager-prompt-panel-actions' });

  const addBtn = DOM.createElement('button', {
    class: 'voyager-prompt-panel-btn',
    title: t(locale).newPrompt,
  }, ['+']);
  addBtn.addEventListener('click', () => {
    state.showForm = true;
    state.editingId = null;
    renderPanel();
  });

  const importBtn = DOM.createElement('button', {
    class: 'voyager-prompt-panel-btn',
    title: t(locale).importBtn,
  }, ['\u2B07']);
  importBtn.addEventListener('click', handleImport);

  const exportBtn = DOM.createElement('button', {
    class: 'voyager-prompt-panel-btn',
    title: t(locale).exportBtn,
  }, ['\u2B06']);
  exportBtn.addEventListener('click', handleExport);

  const closeBtn = DOM.createElement('button', {
    class: 'voyager-prompt-panel-btn',
    title: t(locale).closeBtn,
  }, ['\u2715']);
  closeBtn.addEventListener('click', () => {
    state.panelOpen = false;
    removePanel();
  });

  actions.append(addBtn, importBtn, exportBtn, closeBtn);
  header.append(title, actions);
  panel.appendChild(header);

  // Search
  const searchWrap = DOM.createElement('div', { class: 'voyager-prompt-search' });
  const searchInput = DOM.createElement('input', {
    type: 'text',
    placeholder: t(locale).searchPrompts,
    value: state.searchQuery,
  });
  searchInput.addEventListener('input', (e) => {
    state.searchQuery = (e.target as HTMLInputElement).value;
    renderPromptList(listEl);
  });
  searchWrap.appendChild(searchInput);
  panel.appendChild(searchWrap);

  // List
  const listEl = DOM.createElement('div', { class: 'voyager-prompt-list' });
  renderPromptList(listEl);
  panel.appendChild(listEl);

  // Add/Edit form
  if (state.showForm) {
    panel.appendChild(renderForm());
  }

  document.body.appendChild(panel);
  state.panel = panel;
}

function renderPromptList(listEl: HTMLElement): void {
  listEl.innerHTML = '';

  const filtered = filterPrompts();
  if (filtered.length === 0) {
    const empty = DOM.createElement('div', { class: 'voyager-prompt-empty' }, [
      state.searchQuery ? t(locale).noPromptsFound : t(locale).noPromptsSaved,
    ]);
    listEl.appendChild(empty);
    return;
  }

  for (const prompt of filtered) {
    const item = DOM.createElement('div', {
      class: 'voyager-prompt-item',
      'data-voyager-id': prompt.id,
    });

    const titleEl = DOM.createElement('div', { class: 'voyager-prompt-item-title' }, [prompt.title]);
    const preview = DOM.createElement('div', { class: 'voyager-prompt-item-preview' }, [
      prompt.content.slice(0, 80) + (prompt.content.length > 80 ? '...' : ''),
    ]);

    item.append(titleEl, preview);

    if (prompt.tags.length > 0) {
      const tagsEl = DOM.createElement('div', { class: 'voyager-prompt-item-tags' });
      for (const tag of prompt.tags) {
        tagsEl.appendChild(DOM.createElement('span', { class: 'voyager-prompt-tag' }, [tag]));
      }
      item.appendChild(tagsEl);
    }

    // Action buttons
    const actionsEl = DOM.createElement('div', { class: 'voyager-prompt-item-actions' });

    const insertBtn = DOM.createElement('button', { class: 'voyager-prompt-item-btn' }, [t(locale).insertBtn]);
    insertBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      void insertPrompt(prompt);
    });

    const editBtn = DOM.createElement('button', { class: 'voyager-prompt-item-btn' }, [t(locale).editBtn]);
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.editingId = prompt.id;
      state.showForm = true;
      renderPanel();
    });

    const delBtn = DOM.createElement('button', { class: 'voyager-prompt-item-btn voyager-delete-btn' }, [t(locale).deleteBtn]);
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deletePrompt(prompt.id);
    });

    actionsEl.append(insertBtn, editBtn, delBtn);
    item.appendChild(actionsEl);

    // Click on item also inserts
    item.addEventListener('click', () => {
      void insertPrompt(prompt);
    });

    listEl.appendChild(item);
  }
}

function renderForm(): HTMLElement {
  const editing = state.editingId
    ? state.prompts.find((p) => p.id === state.editingId)
    : undefined;

  const form = DOM.createElement('div', { class: 'voyager-prompt-form' });

  const titleInput = DOM.createElement('input', {
    type: 'text',
    placeholder: t(locale).promptTitle,
    value: editing?.title ?? '',
  });

  const contentInput = DOM.createElement('textarea', {
    placeholder: t(locale).promptContent,
  });
  (contentInput as HTMLTextAreaElement).value = editing?.content ?? '';

  const tagsInput = DOM.createElement('input', {
    type: 'text',
    placeholder: t(locale).tagsSeparated,
    value: editing?.tags.join(', ') ?? '',
  });

  const categoryInput = DOM.createElement('input', {
    type: 'text',
    placeholder: t(locale).categoryLabel,
    value: editing?.category ?? '',
  });

  const btns = DOM.createElement('div', { class: 'voyager-prompt-form-btns' });
  const cancelBtn = DOM.createElement('button', { class: 'voyager-prompt-form-cancel' }, [t(locale).cancel]);
  cancelBtn.addEventListener('click', () => {
    state.showForm = false;
    state.editingId = null;
    renderPanel();
  });

  const saveBtn = DOM.createElement('button', { class: 'voyager-prompt-form-save' }, [t(locale).save]);
  saveBtn.addEventListener('click', async () => {
    const title = (titleInput as HTMLInputElement).value.trim();
    const content = (contentInput as HTMLTextAreaElement).value.trim();
    const tags = (tagsInput as HTMLInputElement).value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    const category = (categoryInput as HTMLInputElement).value.trim();

    if (!title || !content) return;

    const previousPrompts = clonePrompts(state.prompts);
    const nextPrompts = clonePrompts(state.prompts);

    if (editing) {
      const index = nextPrompts.findIndex((p) => p.id === editing.id);
      if (index === -1) return;
      const existing = nextPrompts[index];
      if (!existing) return;

      nextPrompts[index] = {
        ...existing,
        title,
        content,
        tags,
        category,
        updatedAt: Date.now(),
      };
    } else {
      const newPrompt: SavedPrompt = {
        id: uuid(),
        title,
        content,
        tags,
        category,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      nextPrompts.push(newPrompt);
    }

    state.prompts = nextPrompts;
    try {
      await savePrompts();
    } catch (err) {
      state.prompts = previousPrompts;
      Logger.error(TAG, 'Failed to save prompt changes', err);
      window.alert(t(locale).failedSavePrompt);
      return;
    }

    state.showForm = false;
    state.editingId = null;
    renderPanel();
  });

  btns.append(cancelBtn, saveBtn);
  form.append(titleInput, contentInput, tagsInput, categoryInput, btns);
  return form;
}

// ─── Logic ──────────────────────────────────────────────────────

function filterPrompts(): SavedPrompt[] {
  const q = state.searchQuery.toLowerCase();
  if (!q) return state.prompts;

  return state.prompts.filter(
    (p) =>
      p.title.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q)) ||
      p.category.toLowerCase().includes(q),
  );
}

/**
 * Insert prompt content into the claude.ai input field.
 * Uses InputEvent to work with ProseMirror's content model.
 */
function tryInsertText(inputEl: HTMLElement, text: string): boolean {
  inputEl.focus();

  try {
    if (document.execCommand('insertText', false, text)) {
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
  } catch (err) {
    Logger.warn(TAG, 'execCommand insertText failed', err);
  }

  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    if (inputEl.contains(range.commonAncestorContainer)) {
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
  }

  try {
    inputEl.textContent = `${inputEl.textContent ?? ''}${text}`;
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  } catch (err) {
    Logger.warn(TAG, 'Input textContent fallback failed', err);
    return false;
  }
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for clipboard API failures.
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const copied = document.execCommand('copy');
      ta.remove();
      return copied;
    } catch (err) {
      Logger.warn(TAG, 'Fallback clipboard copy failed', err);
      return false;
    }
  }
}

async function insertPrompt(prompt: SavedPrompt): Promise<void> {
  const inputEl = DOM.query('inputField') as HTMLElement | null;
  if (!inputEl) {
    Logger.warn(TAG, 'Input field not found');
    return;
  }

  const inserted = tryInsertText(inputEl, prompt.content);
  if (!inserted) {
    const copied = await copyToClipboard(prompt.content);
    window.alert(
      copied
        ? t(locale).promptCopiedFallback
        : t(locale).promptInsertFailed,
    );
    return;
  }

  Logger.info(TAG, `Prompt "${prompt.title}" inserted`);

  // Close panel after insertion
  state.panelOpen = false;
  removePanel();
}

async function deletePrompt(id: string): Promise<void> {
  const previousPrompts = clonePrompts(state.prompts);
  state.prompts = state.prompts.filter((p) => p.id !== id);
  try {
    await savePrompts();
  } catch (err) {
    state.prompts = previousPrompts;
    Logger.error(TAG, 'Failed to delete prompt', err);
    window.alert(t(locale).failedDeletePrompt);
  }
  renderPanel();
}

function clonePrompts(prompts: SavedPrompt[]): SavedPrompt[] {
  return prompts.map((prompt) => ({
    ...prompt,
    tags: [...prompt.tags],
  }));
}

async function savePrompts(): Promise<void> {
  await Storage.setPrompts(state.prompts);
}

// ─── Import / Export ────────────────────────────────────────────

function handleExport(): void {
  const data = JSON.stringify(state.prompts, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `claude-voyager-prompts-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeTagList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const tags = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    tags.add(trimmed);
  }
  return [...tags];
}

function normalizeTimestamp(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  return fallback;
}

function normalizeImportedPrompt(raw: unknown): SavedPrompt | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const data = raw as Record<string, unknown>;

  const title = normalizeNonEmptyString(data.title);
  const content = normalizeNonEmptyString(data.content);
  if (!title || !content) return null;

  const now = Date.now();
  const createdAt = normalizeTimestamp(data.createdAt, now);
  const updatedAt = normalizeTimestamp(data.updatedAt, createdAt);

  return {
    id: normalizeNonEmptyString(data.id) ?? uuid(),
    title,
    content,
    tags: normalizeTagList(data.tags),
    category: normalizeNonEmptyString(data.category) ?? '',
    createdAt,
    updatedAt,
  };
}

function handleImport(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const imported = JSON.parse(reader.result as string) as unknown;
        if (!Array.isArray(imported)) {
          window.alert(t(locale).importFailedPromptArray);
          return;
        }

        const existingIds = new Set(state.prompts.map((p) => p.id));
        const seenImportedIds = new Set<string>();
        const newPrompts: SavedPrompt[] = [];
        let invalidCount = 0;
        let duplicateCount = 0;

        for (const raw of imported) {
          const normalized = normalizeImportedPrompt(raw);
          if (!normalized) {
            invalidCount += 1;
            continue;
          }
          if (existingIds.has(normalized.id) || seenImportedIds.has(normalized.id)) {
            duplicateCount += 1;
            continue;
          }
          seenImportedIds.add(normalized.id);
          newPrompts.push(normalized);
        }

        const previousPrompts = clonePrompts(state.prompts);
        state.prompts.push(...newPrompts);
        try {
          await savePrompts();
        } catch (err) {
          state.prompts = previousPrompts;
          Logger.error(TAG, 'Failed to persist imported prompts', err);
          window.alert(t(locale).failedPersistPrompts);
          return;
        }
        renderPanel();

        window.alert(
          `Prompt import finished.\nAdded: ${newPrompts.length}\nSkipped duplicates: ${duplicateCount}\nSkipped invalid: ${invalidCount}`,
        );
        Logger.info(
          TAG,
          `Prompt import summary: added=${newPrompts.length}, duplicates=${duplicateCount}, invalid=${invalidCount}`,
        );
      } catch (err) {
        Logger.error(TAG, 'Import error', err);
        window.alert(t(locale).importFailedPromptJson);
      }
    };
    reader.readAsText(file);
  });
  input.click();
}

// ─── Cleanup ────────────────────────────────────────────────────

function removePanel(): void {
  state.panel?.remove();
  state.panel = null;
}

function removeTrigger(): void {
  state.trigger?.remove();
  state.trigger = null;
}

function fullCleanup(): void {
  for (const cleanup of state.cleanups) cleanup();
  state.cleanups = [];
  removePanel();
  removeTrigger();
}

// ─── Feature Module Export ──────────────────────────────────────

export const PromptFeature: FeatureModule = {
  key: 'prompts',

  init(_settings: VoyagerSettings) {
    Logger.info(TAG, 'Initializing prompt library');
    locale = _settings.locale ?? 'en';
    state = createState();
    DOM.injectStyles('voyager-prompts', PROMPT_CSS);

    // Delay initial render to let chat input load
    const tryInject = (attempts: number) => {
      if (state.trigger) return;
      renderTrigger();
      if (!state.trigger && attempts > 0) {
        setTimeout(() => tryInject(attempts - 1), 500);
      }
    };
    tryInject(10);

    Storage.getPrompts().then((prompts) => {
      state.prompts = prompts;
      Logger.debug(TAG, `Loaded ${prompts.length} prompts from storage`);
    }).catch((err) => {
      Logger.error(TAG, 'Failed to load prompts', err);
    });
  },

  destroy() {
    Logger.info(TAG, 'Destroying prompt library');
    fullCleanup();
    DOM.removeStyles('voyager-prompts');
    state = createState();
  },

  onNavigate() {
    // Re-inject trigger if it was removed (SPA navigation rebuilds chat input)
    if (!document.querySelector('[data-voyager="prompt-trigger"]')) {
      removeTrigger();
      const tryInject = (attempts: number) => {
        if (state.trigger) return;
        renderTrigger();
        if (!state.trigger && attempts > 0) {
          setTimeout(() => tryInject(attempts - 1), 500);
        }
      };
      setTimeout(() => tryInject(10), 300);
    }
  },
};
