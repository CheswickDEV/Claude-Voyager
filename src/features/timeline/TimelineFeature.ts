/**
 * Timeline feature module — mini-map panel.
 *
 * Renders a collapsible sidebar panel on the right edge of the chat showing
 * every message as a compact row with: message number, role label (You/Claude),
 * and a truncated text preview (~40 chars). Supports:
 * - Click to scroll to message
 * - Long-press to star a message
 * - Right-click context menu for assigning star levels (1-3)
 * - Scroll synchronization (active row highlighted as user scrolls)
 * - Toggle tab on the right edge to show/hide the panel
 */

import type { FeatureModule } from '@pages/content/index';
import type { VoyagerSettings, ChatMessage, StarredMessage, Locale } from '@core/types';
import { DOM } from '@core/services/DOMService';
import { Storage } from '@core/services/StorageService';
import { Logger } from '@core/services/LoggerService';
import { debounce, throttle } from '@core/utils';
import { t } from '@i18n/index';
import { TIMELINE_CSS } from './TimelineStyles';

let locale: Locale = 'en';

const TAG = 'Timeline';
const PREVIEW_LENGTH = 40;
const LONG_PRESS_MS = 600;

/** Cached user display name (fetched once per render cycle) */
let cachedUserName: string | null = null;

/** State for the timeline panel */
interface TimelineState {
  messages: ChatMessage[];
  starred: StarredMessage[];
  activeIndex: number;
  panelOpen: boolean;
  toggleBtn: HTMLElement | null;
  panel: HTMLElement | null;
  listEl: HTMLElement | null;
  contextMenu: HTMLElement | null;
  cleanups: (() => void)[];
  longPressTimer: ReturnType<typeof setTimeout> | null;
  conversationId: string | null;
}

function createInitialState(): TimelineState {
  return {
    messages: [],
    starred: [],
    activeIndex: -1,
    panelOpen: false,
    toggleBtn: null,
    panel: null,
    listEl: null,
    contextMenu: null,
    cleanups: [],
    longPressTimer: null,
    conversationId: null,
  };
}

let state: TimelineState = createInitialState();

// ─── Rendering ──────────────────────────────────────────────────

/** Render the full timeline panel and toggle tab into the DOM */
function renderTimeline(): void {
  removeTimeline();

  if (!DOM.isChatPage()) return;

  state.messages = DOM.getChatMessages();
  if (state.messages.length === 0) return;

  // ── Toggle tab (drawer handle) ──
  const toggleBtn = DOM.createElement('div', {
    'data-voyager': 'timeline-toggle',
    'data-voyager-tooltip': t(locale).featureTimeline,
    'data-voyager-tooltip-pos': 'left',
    class: 'voyager-timeline-toggle' + (state.panelOpen ? ' voyager-panel-open' : ''),
  });
  const toggleIcon = DOM.createElement('span', { class: 'voyager-timeline-toggle-icon' }, [
    '\u25C0', // ◀
  ]);
  toggleBtn.appendChild(toggleIcon);

  // ── Panel ──
  const panel = DOM.createElement('div', {
    'data-voyager': 'timeline-panel',
    class: 'voyager-timeline-panel' + (state.panelOpen ? ' voyager-panel-visible' : ''),
  });

  // Cache user name for this render cycle
  cachedUserName = DOM.getUserName();

  // Header with close button
  const header = DOM.createElement('div', { class: 'voyager-timeline-header' });
  const headerLeft = DOM.createElement('div', { class: 'voyager-timeline-header-left' });
  const title = DOM.createElement('span', { class: 'voyager-timeline-title' }, [t(locale).messages]);
  const count = DOM.createElement('span', { class: 'voyager-timeline-count' }, [
    String(state.messages.length),
  ]);
  headerLeft.appendChild(title);
  headerLeft.appendChild(count);

  const closeBtn = DOM.createElement('button', {
    class: 'voyager-timeline-close',
    title: t(locale).closeBtn,
    'aria-label': t(locale).closeTimeline,
  }, ['\u00D7']);

  header.appendChild(headerLeft);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  // Message list
  const list = DOM.createElement('div', { class: 'voyager-timeline-list' });

  for (let i = 0; i < state.messages.length; i++) {
    const msg = state.messages[i];
    if (!msg) continue;

    const starred = getStarredInfo(i);
    const row = buildMessageRow(msg, i, starred);
    list.appendChild(row);
  }

  panel.appendChild(list);

  // ── Context menu (hidden) ──
  const contextMenu = DOM.createElement('div', {
    'data-voyager': 'timeline-context',
    class: 'voyager-timeline-context voyager-hidden',
  });
  const ctxItems = [
    { level: '1', label: t(locale).starLevel1 },
    { level: '2', label: t(locale).starLevel2 },
    { level: '3', label: t(locale).starLevel3 },
    { level: '0', label: t(locale).removeStar, cls: 'voyager-ctx-unstar' },
  ];
  for (const item of ctxItems) {
    const el = DOM.createElement('div', {
      class: 'voyager-ctx-item' + (item.cls ? ' ' + item.cls : ''),
      'data-level': item.level,
    }, [item.label]);
    contextMenu.appendChild(el);
  }

  // Append to DOM
  document.body.appendChild(toggleBtn);
  document.body.appendChild(panel);
  document.body.appendChild(contextMenu);

  state.toggleBtn = toggleBtn;
  state.panel = panel;
  state.listEl = list;
  state.contextMenu = contextMenu;

  setupEventHandlers();
  updateActiveRow();

  Logger.debug(TAG, `Timeline rendered with ${state.messages.length} rows`);
}

/** Build a single message row element */
function buildMessageRow(
  msg: ChatMessage,
  index: number,
  starred: StarredMessage | undefined,
): HTMLElement {
  const roleLabel = msg.role === 'human' ? (cachedUserName ?? t(locale).you) : t(locale).claudeRole;
  const preview = msg.contentText.slice(0, PREVIEW_LENGTH).replace(/\n/g, ' ') +
    (msg.contentText.length > PREVIEW_LENGTH ? '\u2026' : '');

  // Row classes
  let rowClass = 'voyager-timeline-row';
  rowClass += msg.role === 'human' ? ' voyager-row-human' : ' voyager-row-assistant';
  if (starred) {
    rowClass += ` voyager-row-starred voyager-row-level-${starred.level}`;
  }

  const row = DOM.createElement('div', {
    class: rowClass,
    'data-voyager-id': String(index),
  });

  // Message number
  const numEl = DOM.createElement('span', { class: 'voyager-row-number' }, [
    String(index + 1),
  ]);

  // Body (role + preview)
  const body = DOM.createElement('div', { class: 'voyager-row-body' });

  const roleEl = DOM.createElement('span', {
    class: 'voyager-row-role voyager-role-' + msg.role,
  }, [roleLabel]);

  const previewEl = DOM.createElement('span', { class: 'voyager-row-preview' }, [preview]);

  body.appendChild(roleEl);
  body.appendChild(previewEl);

  row.appendChild(numEl);
  row.appendChild(body);

  // Star indicator (if starred)
  if (starred) {
    const starWrap = DOM.createElement('span', { class: 'voyager-row-star' });
    const starIcon = DOM.createElement('span', {
      class: `voyager-star-icon voyager-star-level-${starred.level}`,
    }, ['\u2605']);
    starWrap.appendChild(starIcon);
    row.appendChild(starWrap);
  }

  return row;
}

// ─── Event Handlers ─────────────────────────────────────────────

function setupEventHandlers(): void {
  const { panel, toggleBtn, contextMenu, listEl } = state;

  // Toggle button: open/close panel
  if (toggleBtn) {
    const toggleHandler = () => {
      state.panelOpen = !state.panelOpen;
      toggleBtn.classList.toggle('voyager-panel-open', state.panelOpen);
      panel?.classList.toggle('voyager-panel-visible', state.panelOpen);

      // When opening, scroll the active row into view within the list
      if (state.panelOpen && state.activeIndex >= 0) {
        scrollActiveRowIntoView();
      }
    };
    toggleBtn.addEventListener('click', toggleHandler);
    state.cleanups.push(() => toggleBtn.removeEventListener('click', toggleHandler));
  }

  // Close button inside panel header
  const closeBtn = panel?.querySelector('.voyager-timeline-close');
  if (closeBtn && toggleBtn) {
    const closeHandler = () => {
      state.panelOpen = false;
      toggleBtn?.classList.remove('voyager-panel-open');
      panel?.classList.remove('voyager-panel-visible');
    };
    closeBtn.addEventListener('click', closeHandler);
    state.cleanups.push(() => closeBtn.removeEventListener('click', closeHandler));
  }

  // Click row: scroll to message
  if (listEl) {
    const clickCleanup = DOM.delegate<MouseEvent>(
      listEl,
      '.voyager-timeline-row',
      'click',
      (target) => {
        const idx = Number(target.getAttribute('data-voyager-id'));
        scrollToMessage(idx);
      },
    );
    state.cleanups.push(clickCleanup);

    // Long-press: toggle star
    const downCleanup = DOM.delegate<MouseEvent>(
      listEl,
      '.voyager-timeline-row',
      'mousedown',
      (target) => {
        const idx = Number(target.getAttribute('data-voyager-id'));
        state.longPressTimer = setTimeout(() => {
          toggleStar(idx);
          state.longPressTimer = null;
        }, LONG_PRESS_MS);
      },
    );
    state.cleanups.push(downCleanup);

    // Right-click: context menu
    const ctxCleanup = DOM.delegate<MouseEvent>(
      listEl,
      '.voyager-timeline-row',
      'contextmenu',
      (target, evt) => {
        evt.preventDefault();
        const idx = Number(target.getAttribute('data-voyager-id'));
        showContextMenu(idx, evt);
      },
    );
    state.cleanups.push(ctxCleanup);
  }

  // Cancel long-press on mouseup
  const upHandler = () => {
    if (state.longPressTimer) {
      clearTimeout(state.longPressTimer);
      state.longPressTimer = null;
    }
  };
  document.addEventListener('mouseup', upHandler);
  state.cleanups.push(() => document.removeEventListener('mouseup', upHandler));

  // Context menu item click
  if (contextMenu) {
    const ctxItemCleanup = DOM.delegate<MouseEvent>(
      contextMenu,
      '.voyager-ctx-item',
      'click',
      (target) => {
        const level = Number(target.getAttribute('data-level')) as 0 | 1 | 2 | 3;
        const idx = Number(contextMenu.getAttribute('data-target-idx'));
        if (level === 0) {
          removeStar(idx);
        } else {
          setStarLevel(idx, level);
        }
        hideContextMenu();
      },
    );
    state.cleanups.push(ctxItemCleanup);
  }

  // Close context menu on outside click
  const outsideClick = (evt: Event) => {
    if (contextMenu && !contextMenu.contains(evt.target as Node)) {
      hideContextMenu();
    }
  };
  document.addEventListener('click', outsideClick);
  state.cleanups.push(() => document.removeEventListener('click', outsideClick));

  // Scroll sync: update active row as user scrolls the chat
  // claude.ai uses multiple scrollable containers — listen on all of them
  const scrollHandler = throttle(() => updateActiveRow(), 100);

  // The main content area
  const mainContent = DOM.query('mainContent');
  if (mainContent) {
    mainContent.addEventListener('scroll', scrollHandler, { passive: true });
    state.cleanups.push(() => mainContent.removeEventListener('scroll', scrollHandler));
  }

  // Walk up from a message to find the actual scroll container
  if (state.messages.length > 0 && state.messages[0]) {
    let scrollParent: Element | null = state.messages[0].element.parentElement;
    const seen = new Set<Element>();
    while (scrollParent && scrollParent !== document.body) {
      if (!seen.has(scrollParent)) {
        seen.add(scrollParent);
        const style = window.getComputedStyle(scrollParent);
        const overflow = style.overflow + style.overflowY;
        if (overflow.includes('auto') || overflow.includes('scroll')) {
          scrollParent.addEventListener('scroll', scrollHandler, { passive: true });
          const sp = scrollParent;
          state.cleanups.push(() => sp.removeEventListener('scroll', scrollHandler));
        }
      }
      scrollParent = scrollParent.parentElement;
    }
  }

  // Always listen on window as fallback
  window.addEventListener('scroll', scrollHandler, { passive: true });
  state.cleanups.push(() => window.removeEventListener('scroll', scrollHandler));
}

// ─── Scroll & Navigation ────────────────────────────────────────

/** Smooth-scroll to a message by index */
function scrollToMessage(index: number): void {
  const msg = state.messages[index];
  if (!msg) return;

  msg.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  state.activeIndex = index;
  highlightActiveRow(index);
}

/** Scroll the panel's list so the active row is visible */
function scrollActiveRowIntoView(): void {
  if (!state.listEl) return;
  const activeRow = state.listEl.querySelector('.voyager-row-active') as HTMLElement | null;
  if (activeRow) {
    activeRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

// ─── Active Row Tracking ────────────────────────────────────────

/** Determine which message is closest to the viewport center and highlight it */
function updateActiveRow(): void {
  if (state.messages.length === 0) return;

  const viewportMid = window.innerHeight / 2;
  let closest = 0;
  let closestDist = Infinity;

  for (let i = 0; i < state.messages.length; i++) {
    const msg = state.messages[i];
    if (!msg) continue;

    const rect = msg.element.getBoundingClientRect();
    const dist = Math.abs(rect.top + rect.height / 2 - viewportMid);
    if (dist < closestDist) {
      closestDist = dist;
      closest = i;
    }
  }

  if (closest !== state.activeIndex) {
    state.activeIndex = closest;
    highlightActiveRow(closest);
  }
}

/** Visually highlight the active row and scroll it into view in the panel */
function highlightActiveRow(index: number): void {
  if (!state.listEl) return;

  const rows = state.listEl.querySelectorAll('.voyager-timeline-row');
  for (let i = 0; i < rows.length; i++) {
    rows[i]?.classList.toggle('voyager-row-active', i === index);
  }

  // Keep active row visible in the panel list (if panel is open)
  if (state.panelOpen) {
    const activeRow = rows[index] as HTMLElement | undefined;
    activeRow?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

// ─── Context Menu ───────────────────────────────────────────────

function showContextMenu(index: number, evt: MouseEvent): void {
  if (!state.contextMenu) return;

  state.contextMenu.setAttribute('data-target-idx', String(index));
  state.contextMenu.classList.remove('voyager-hidden');

  // First place off-screen to measure actual size
  state.contextMenu.style.top = '-9999px';
  state.contextMenu.style.left = '-9999px';

  // Force layout to get real dimensions
  const rect = state.contextMenu.getBoundingClientRect();
  const menuWidth = rect.width;
  const menuHeight = rect.height;
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const margin = 4; // small gap from edge

  let left = evt.clientX;
  let top = evt.clientY;

  // Only flip horizontally if menu truly overflows the right edge
  if (left + menuWidth > viewportW - margin) {
    left = evt.clientX - menuWidth;
    if (left < margin) left = margin;
  }

  // Only flip vertically if menu truly overflows the bottom edge
  if (top + menuHeight > viewportH - margin) {
    top = evt.clientY - menuHeight;
    if (top < margin) top = margin;
  }

  state.contextMenu.style.top = `${top}px`;
  state.contextMenu.style.left = `${left}px`;
}

function hideContextMenu(): void {
  state.contextMenu?.classList.add('voyager-hidden');
}

// ─── Star Management ────────────────────────────────────────────

function getStarredInfo(index: number): StarredMessage | undefined {
  return state.starred.find(
    (s) => s.conversationId === state.conversationId && s.messageIndex === index,
  );
}

async function toggleStar(index: number): Promise<void> {
  const existing = getStarredInfo(index);
  if (existing) {
    await removeStar(index);
  } else {
    await addStar(index, 1);
  }
}

async function addStar(index: number, level: 1 | 2 | 3): Promise<void> {
  if (!state.conversationId) return;
  const msg = state.messages[index];
  if (!msg) return;

  const star: StarredMessage = {
    conversationId: state.conversationId,
    messageIndex: index,
    preview: msg.contentText.slice(0, 100),
    starredAt: Date.now(),
    level,
  };

  // Replace any existing star for this index
  state.starred = state.starred.filter(
    (s) => !(s.conversationId === state.conversationId && s.messageIndex === index),
  );
  state.starred.push(star);
  await Storage.setStarred(state.starred);
  renderTimeline();
}

async function removeStar(index: number): Promise<void> {
  state.starred = state.starred.filter(
    (s) => !(s.conversationId === state.conversationId && s.messageIndex === index),
  );
  await Storage.setStarred(state.starred);
  renderTimeline();
}

async function setStarLevel(index: number, level: 1 | 2 | 3): Promise<void> {
  await addStar(index, level);
}

// ─── Teardown ───────────────────────────────────────────────────

function removeTimeline(): void {
  for (const cleanup of state.cleanups) {
    cleanup();
  }

  state.toggleBtn?.remove();
  state.panel?.remove();
  state.contextMenu?.remove();
  state.toggleBtn = null;
  state.panel = null;
  state.listEl = null;
  state.contextMenu = null;
  state.cleanups = [];
}

const debouncedRender = debounce(() => renderTimeline(), 300);

// ─── Feature Module Export ──────────────────────────────────────

export const TimelineFeature: FeatureModule = {
  key: 'timeline',

  init(settings: VoyagerSettings) {
    Logger.info(TAG, 'Initializing timeline feature');
    locale = settings.locale ?? 'en';

    state = createInitialState();
    state.conversationId = DOM.getConversationId();
    DOM.injectStyles('voyager-timeline', TIMELINE_CSS);

    // Render immediately, then load starred data
    renderTimeline();

    Storage.getStarred().then((starred) => {
      state.starred = starred;
      renderTimeline();
    }).catch((err) => {
      Logger.error(TAG, 'Failed to load starred messages', err);
    });
  },

  destroy() {
    Logger.info(TAG, 'Destroying timeline feature');
    removeTimeline();
    DOM.removeStyles('voyager-timeline');
    state = createInitialState();
  },

  onNavigate(conversationId: string | null) {
    state.conversationId = conversationId;
    if (conversationId) {
      renderTimeline();
      // Conversation DOM can hydrate after route change; refresh once more.
      setTimeout(() => {
        if (state.conversationId === conversationId) {
          renderTimeline();
        }
      }, 400);
    } else {
      removeTimeline();
    }
  },

  onMessagesChanged() {
    debouncedRender();
  },
};
