/**
 * Folder Organization feature module.
 *
 * Injects a native-looking sidebar nav item between "Projekte" and "Artefakte".
 * Clicking it opens a floating overlay folder panel.
 * Supports:
 * - Two-level hierarchy (folders and subfolders)
 * - Drag-and-drop conversations into folders
 * - Double-click to rename
 * - Long-press for multi-select
 * - Import/Export as JSON
 * - Resizable panel via drag handle
 */

import type { FeatureModule } from '@pages/content/index';
import type { VoyagerSettings, Folder, Locale } from '@core/types';
import { DOM } from '@core/services/DOMService';
import { Storage } from '@core/services/StorageService';
import { Logger } from '@core/services/LoggerService';
import { uuid } from '@core/utils';
import { t } from '@i18n/index';
import { FOLDER_CSS } from './FolderStyles';

let locale: Locale = 'en';

const TAG = 'Folders';
const LONG_PRESS_MS = 500;

// SVG icon for the folder nav item (matches claude.ai's 20x20 icon style)
const FOLDER_SVG = `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0" aria-hidden="true"><path d="M2 5.5C2 4.11929 3.11929 3 4.5 3H7.17157C7.70201 3 8.21071 3.21071 8.58579 3.58579L9.91421 4.91421C10.0391 5.03914 10.2087 5.10957 10.3856 5.10957H15.5C16.8807 5.10957 18 6.22886 18 7.60957V14.5C18 15.8807 16.8807 17 15.5 17H4.5C3.11929 17 2 15.8807 2 14.5V5.5ZM4.5 4C3.67157 4 3 4.67157 3 5.5V14.5C3 15.3284 3.67157 16 4.5 16H15.5C16.3284 16 17 15.3284 17 14.5V7.60957C17 6.78114 16.3284 6.10957 15.5 6.10957H10.3856C9.94314 6.10957 9.51886 5.93386 9.20711 5.62211L7.87868 4.29368C7.69114 4.10614 7.437 4 7.17157 4H4.5Z"/></svg>`;

interface FolderState {
  folders: Folder[];
  openFolders: Set<string>;
  selectedFolders: Set<string>;
  renamingId: string | null;
  panelOpen: boolean;
  panel: HTMLElement | null;
  toggleBtn: HTMLElement | null;
  toggleCleanups: (() => void)[];
  tooltipEl: HTMLElement | null;
  tooltipAnchor: HTMLElement | null;
  cleanups: (() => void)[];
  longPressTimer: ReturnType<typeof setTimeout> | null;
  sidebarObserver: MutationObserver | null;
}

function createState(): FolderState {
  return {
    folders: [],
    openFolders: new Set(),
    selectedFolders: new Set(),
    renamingId: null,
    panelOpen: false,
    panel: null,
    toggleBtn: null,
    toggleCleanups: [],
    tooltipEl: null,
    tooltipAnchor: null,
    cleanups: [],
    longPressTimer: null,
    sidebarObserver: null,
  };
}

let state: FolderState = createState();

// ─── Native Sidebar Item ────────────────────────────────────────

/** Find the sidebar nav container that holds the nav items */
function findNavContainer(): Element | null {
  // Try multiple strategies to find the container
  // Strategy 1: container with sidebar-nav-item links
  const navLinks = document.querySelectorAll('a[data-dd-action-name="sidebar-nav-item"]');
  if (navLinks.length > 0) {
    // Find the common parent container that holds all nav items
    const firstLink = navLinks[0];
    // Walk up from the first link: link → .relative.group → container
    const wrapper = firstLink?.closest('div.relative.group');
    if (wrapper?.parentElement) {
      const slot = wrapper.parentElement;
      if (slot.classList.contains('px-2') && slot.parentElement) {
        return slot.parentElement;
      }
      return slot;
    }
  }
  // Strategy 2: look for the flex-col container inside nav
  const candidates = document.querySelectorAll('nav div.flex.flex-col');
  for (const c of candidates) {
    if (c.querySelector('a[href="/recents"], a[href="/projects"]')) {
      return c;
    }
  }
  return null;
}

function getNavItemRoot(link: Element): Element | null {
  const wrapper = link.closest('div.relative.group');
  if (wrapper) {
    const slot = wrapper.parentElement;
    if (slot?.classList.contains('px-2')) return slot;
    return wrapper;
  }
  return link.parentElement;
}

function getNavLink(item: Element): HTMLElement | null {
  if (item.matches('a[data-dd-action-name="sidebar-nav-item"]')) {
    return item as HTMLElement;
  }
  return item.querySelector('a[data-dd-action-name="sidebar-nav-item"]') as HTMLElement | null;
}

function ensureNativeTooltip(): HTMLElement {
  if (state.tooltipEl?.isConnected) return state.tooltipEl;
  const tooltip = DOM.createElement('div', {
    class: 'voyager-folder-native-tooltip',
    role: 'tooltip',
    'aria-hidden': 'true',
  }, [t(locale).folder]);
  document.body.appendChild(tooltip);
  state.tooltipEl = tooltip;
  return tooltip;
}

function positionNativeTooltip(anchor: HTMLElement): void {
  const tooltip = ensureNativeTooltip();
  const rect = anchor.getBoundingClientRect();
  tooltip.style.setProperty('--voyager-folder-tooltip-left', `${Math.round(rect.right + 10)}px`);
  tooltip.style.setProperty('--voyager-folder-tooltip-top', `${Math.round(rect.top + rect.height / 2)}px`);
}

function hideNativeTooltip(clearAnchor = true): void {
  if (state.tooltipEl) {
    state.tooltipEl.classList.remove('voyager-folder-native-tooltip-open');
    state.tooltipEl.setAttribute('aria-hidden', 'true');
  }
  if (clearAnchor) {
    state.tooltipAnchor = null;
  }
}

function showNativeTooltip(anchor: HTMLElement): void {
  if (!isSidebarCollapsed()) {
    hideNativeTooltip();
    return;
  }
  const tooltip = ensureNativeTooltip();
  state.tooltipAnchor = anchor;
  positionNativeTooltip(anchor);
  tooltip.classList.add('voyager-folder-native-tooltip-open');
  tooltip.setAttribute('aria-hidden', 'false');
}

function refreshNativeTooltipPosition(): void {
  if (!state.tooltipAnchor || !state.tooltipAnchor.isConnected) {
    hideNativeTooltip();
    return;
  }
  if (!isSidebarCollapsed()) {
    hideNativeTooltip();
    return;
  }
  positionNativeTooltip(state.tooltipAnchor);
}

function teardownToggleInteractions(): void {
  for (const cleanup of state.toggleCleanups) {
    cleanup();
  }
  state.toggleCleanups = [];
  hideNativeTooltip();
  if (state.tooltipEl) {
    state.tooltipEl.remove();
    state.tooltipEl = null;
  }
}

/** Find the "Projekte" nav item to insert after it */
function findProjekteItem(container: Element): Element | null {
  // Look for the link with href="/projects" or aria-label containing "Projekte"/"Projects"
  const links = container.querySelectorAll('a[data-dd-action-name="sidebar-nav-item"]');
  for (const link of links) {
    const href = link.getAttribute('href') ?? '';
    if (href === '/projects') {
      return getNavItemRoot(link);
    }
  }
  return null;
}

function findTemplateNavItem(container: Element): Element | null {
  const links = container.querySelectorAll('a[data-dd-action-name="sidebar-nav-item"]');
  for (const link of links) {
    const href = link.getAttribute('href') ?? '';
    if (!href || href.startsWith('#voyager-')) continue;
    const wrapper = getNavItemRoot(link);
    if (wrapper) return wrapper;
  }
  return null;
}

/** Create a native-looking sidebar nav item for Folders */
function createNativeSidebarItem(templateItem: Element | null): HTMLElement | null {
  // Prefer cloning a real native sidebar item to preserve exact spacing/hover behavior.
  if (templateItem) {
    const wrapper = templateItem.cloneNode(true) as HTMLElement;
    wrapper.setAttribute('data-voyager', 'folder-nav-item');
    const titledNodes = wrapper.querySelectorAll('[title]');
    for (const node of titledNodes) {
      (node as HTMLElement).removeAttribute('title');
    }

    const link = getNavLink(wrapper);
    if (link) {
      link.setAttribute('aria-label', t(locale).folder);
      link.setAttribute('href', '#voyager-folders');
      link.setAttribute('data-voyager', 'folder-toggle');
      link.removeAttribute('title');
      link.classList.remove('voyager-folder-nav-active');

      const label = link.querySelector('span.truncate') as HTMLElement | null;
      const labelInner = label?.querySelector('div') as HTMLElement | null;
      if (labelInner) {
        labelInner.textContent = t(locale).folder;
      } else if (label) {
        label.textContent = t(locale).folder;
      }
      const srOnly = link.querySelector('.sr-only');
      if (srOnly) srOnly.textContent = t(locale).folder;

      // Remove search shortcut badge cloned from "Suchen".
      const shortcutHints = link.querySelectorAll('span');
      for (const hint of shortcutHints) {
        const text = (hint.textContent ?? '').trim().toLowerCase();
        if (text.includes('ctrl+k')) {
          hint.closest('span')?.remove();
        }
      }

      const existingSvg = link.querySelector('svg');
      if (existingSvg?.parentElement) {
        try {
          const parser = new DOMParser();
          const svgDoc = parser.parseFromString(FOLDER_SVG, 'image/svg+xml');
          const svgEl = document.importNode(svgDoc.documentElement, true);
          existingSvg.parentElement.replaceChild(svgEl, existingSvg);
        } catch {
          // Keep native icon as fallback if SVG parsing fails.
        }
      }
    }

    return wrapper;
  }

  return null;
}

/** Render the sidebar toggle button as a native nav item */
function renderToggleButton(): void {
  removeToggleButton();

  const navContainer = findNavContainer();
  if (!navContainer) {
    Logger.warn(TAG, 'Could not find sidebar nav container — will retry on navigate');
    return;
  }

  const projekteItem = findProjekteItem(navContainer);
  const templateItem = projekteItem ?? findTemplateNavItem(navContainer);
  const navItem = createNativeSidebarItem(templateItem);
  if (!navItem) {
    Logger.warn(TAG, 'Could not build folder nav item from a native template');
    return;
  }

  // Insert after "Projekte" if found, otherwise after template item.
  if (projekteItem && projekteItem.nextSibling) {
    navContainer.insertBefore(navItem, projekteItem.nextSibling);
  } else if (projekteItem) {
    navContainer.appendChild(navItem);
  } else if (templateItem?.parentElement === navContainer && templateItem.nextSibling) {
    navContainer.insertBefore(navItem, templateItem.nextSibling);
  } else if (templateItem?.parentElement === navContainer) {
    navContainer.appendChild(navItem);
  } else {
    // Fallback: append at the end
    navContainer.appendChild(navItem);
  }

  // Prevent default link navigation, use as toggle
  const link = getNavLink(navItem);
  if (!link) {
    Logger.warn(TAG, 'Folder nav item has no clickable link node');
    navItem.remove();
    return;
  }
  const onClick = (e: MouseEvent) => {
    e.preventDefault();
    hideNativeTooltip();
    handleToggle();
  };
  const onMouseEnter = () => {
    syncFolderTooltipState();
    showNativeTooltip(link);
  };
  const onMouseLeave = () => {
    hideNativeTooltip();
  };
  const onFocusIn = () => {
    syncFolderTooltipState();
    showNativeTooltip(link);
  };
  const onFocusOut = () => {
    hideNativeTooltip();
  };
  const onWindowLayoutChange = () => {
    syncFolderTooltipState();
  };

  link.addEventListener('click', onClick);
  link.addEventListener('mouseenter', onMouseEnter);
  link.addEventListener('mouseleave', onMouseLeave);
  link.addEventListener('focusin', onFocusIn);
  link.addEventListener('focusout', onFocusOut);
  window.addEventListener('resize', onWindowLayoutChange);
  window.addEventListener('scroll', onWindowLayoutChange, true);
  state.toggleCleanups.push(() => link.removeEventListener('click', onClick));
  state.toggleCleanups.push(() => link.removeEventListener('mouseenter', onMouseEnter));
  state.toggleCleanups.push(() => link.removeEventListener('mouseleave', onMouseLeave));
  state.toggleCleanups.push(() => link.removeEventListener('focusin', onFocusIn));
  state.toggleCleanups.push(() => link.removeEventListener('focusout', onFocusOut));
  state.toggleCleanups.push(() => window.removeEventListener('resize', onWindowLayoutChange));
  state.toggleCleanups.push(() => window.removeEventListener('scroll', onWindowLayoutChange, true));

  state.toggleBtn = navItem;
  // Beim Hovern/Fokus den Collapsed-Zustand frisch prüfen.
  updateToggleActive();
  syncFolderTooltipState();
  Logger.debug(TAG, 'Folder nav item injected into sidebar');
}

function removeToggleButton(): void {
  teardownToggleInteractions();
  if (state.toggleBtn) {
    state.toggleBtn.remove();
    state.toggleBtn = null;
  }
  // Also clean up any stale duplicates
  const stale = document.querySelectorAll('[data-voyager="folder-nav-item"]');
  for (const node of stale) node.remove();
}

function isSidebarCollapsed(): boolean {
  const sidebar = DOM.query('sidebar') as HTMLElement | null;
  if (!sidebar) return true;
  return sidebar.getBoundingClientRect().width <= 80;
}

function syncFolderTooltipState(): void {
  if (!isSidebarCollapsed()) {
    hideNativeTooltip();
    return;
  }
  refreshNativeTooltipPosition();
}

function stopSidebarObserver(): void {
  if (state.sidebarObserver) {
    state.sidebarObserver.disconnect();
    state.sidebarObserver = null;
  }
}

function observeSidebarMutations(): void {
  stopSidebarObserver();
  const sidebar = DOM.query('sidebar');
  if (!sidebar) return;
  state.sidebarObserver = new MutationObserver(() => {
    const hasToggle = !!document.querySelector('[data-voyager="folder-nav-item"]');
    if (!hasToggle) {
      ensureToggleButtonInjected(3);
      return;
    }
    syncFolderTooltipState();
  });
  state.sidebarObserver.observe(sidebar, {
    childList: true,
    subtree: true,
  });
}

function ensureToggleButtonInjected(retries = 8): void {
  const existing = document.querySelector('[data-voyager="folder-nav-item"]');
  if (existing) return;

  renderToggleButton();

  if (retries <= 0) return;
  setTimeout(() => {
    ensureToggleButtonInjected(retries - 1);
  }, 350);
}

function updateToggleActive(): void {
  if (!state.toggleBtn) return;
  const link = getNavLink(state.toggleBtn);
  if (!link) return;
  if (state.panelOpen) {
    link.classList.add('voyager-folder-nav-active');
  } else {
    link.classList.remove('voyager-folder-nav-active');
  }
}

function handleToggle(): void {
  state.panelOpen = !state.panelOpen;
  updateToggleActive();

  if (state.panelOpen) {
    renderPanel();
  } else {
    removePanel();
  }
}

// ─── Panel Rendering ────────────────────────────────────────────

/** Render the floating overlay panel */
function renderPanel(): void {
  removePanel();

  if (!state.panelOpen) return;

  const panel = DOM.createElement('div', {
    'data-voyager': 'folder-panel',
    class: 'voyager-folder-panel',
  });

  // Header
  const header = DOM.createElement('div', { class: 'voyager-folder-header' });
  const title = DOM.createElement('span', { class: 'voyager-folder-title' }, [t(locale).folder]);
  const actions = DOM.createElement('div', { class: 'voyager-folder-actions' });

  const addBtn = DOM.createElement('button', {
    class: 'voyager-folder-btn',
    title: t(locale).newFolder,
    'aria-label': t(locale).newFolder,
  }, ['+']);

  const importBtn = DOM.createElement('button', {
    class: 'voyager-folder-btn',
    title: t(locale).importBtn,
    'aria-label': t(locale).importBtn,
  }, ['\u2B07']);

  const exportBtn = DOM.createElement('button', {
    class: 'voyager-folder-btn',
    title: t(locale).exportBtn,
    'aria-label': t(locale).exportBtn,
  }, ['\u2B06']);

  const closeBtn = DOM.createElement('button', {
    class: 'voyager-folder-btn',
    title: t(locale).closeBtn,
    'aria-label': t(locale).closeBtn,
  }, ['\u00D7']);

  actions.append(addBtn, importBtn, exportBtn, closeBtn);
  header.append(title, actions);
  panel.appendChild(header);

  // Folder list
  const list = DOM.createElement('div', { class: 'voyager-folder-list' });
  const topLevel = state.folders
    .filter((f) => f.parentId === null)
    .sort((a, b) => a.order - b.order);

  if (topLevel.length === 0) {
    const empty = DOM.createElement('div', { class: 'voyager-folder-empty' }, [
      t(locale).noFoldersYet,
    ]);
    list.appendChild(empty);
  } else {
    for (const folder of topLevel) {
      list.appendChild(renderFolder(folder));
    }
  }

  panel.appendChild(list);

  // Resize handle
  const resizeHandle = DOM.createElement('div', { class: 'voyager-folder-resize' });
  panel.appendChild(resizeHandle);

  // Position panel next to the sidebar item
  if (state.toggleBtn) {
    const btnRect = state.toggleBtn.getBoundingClientRect();
    const sidebar = DOM.query('sidebar');
    const sidebarRight = sidebar ? sidebar.getBoundingClientRect().right : btnRect.right;
    panel.style.left = `${sidebarRight + 4}px`;
    panel.style.top = `${btnRect.top}px`;
  }

  // Append to body as floating overlay
  document.body.appendChild(panel);
  state.panel = panel;

  // Event handlers
  addBtn.addEventListener('click', handleAddFolder);
  state.cleanups.push(() => addBtn.removeEventListener('click', handleAddFolder));

  importBtn.addEventListener('click', handleImport);
  state.cleanups.push(() => importBtn.removeEventListener('click', handleImport));

  exportBtn.addEventListener('click', handleExport);
  state.cleanups.push(() => exportBtn.removeEventListener('click', handleExport));

  closeBtn.addEventListener('click', handleToggle);
  state.cleanups.push(() => closeBtn.removeEventListener('click', handleToggle));

  // Delegated events on the list
  const clickCleanup = DOM.delegate<MouseEvent>(
    list,
    '.voyager-folder-row',
    'click',
    handleFolderClick,
  );
  state.cleanups.push(clickCleanup);

  const dblClickCleanup = DOM.delegate<MouseEvent>(
    list,
    '.voyager-folder-row',
    'dblclick',
    handleFolderDblClick,
  );
  state.cleanups.push(dblClickCleanup);

  const convClickCleanup = DOM.delegate<MouseEvent>(
    list,
    '.voyager-folder-conv',
    'click',
    handleConvClick,
  );
  state.cleanups.push(convClickCleanup);

  // Long-press for multi-select
  const downCleanup = DOM.delegate<MouseEvent>(
    list,
    '.voyager-folder-row',
    'mousedown',
    (target) => {
      const folderId = target.getAttribute('data-voyager-id');
      if (!folderId) return;
      state.longPressTimer = setTimeout(() => {
        toggleSelect(folderId);
        state.longPressTimer = null;
      }, LONG_PRESS_MS);
    },
  );
  state.cleanups.push(downCleanup);

  const upHandler = () => {
    if (state.longPressTimer) {
      clearTimeout(state.longPressTimer);
      state.longPressTimer = null;
    }
  };
  document.addEventListener('mouseup', upHandler);
  state.cleanups.push(() => document.removeEventListener('mouseup', upHandler));

  // Drag-and-drop from sidebar conversations
  setupDragDrop(list);

  // Folder reorder via drag & drop
  setupFolderReorder(list);

  // Resize handling
  setupResize(panel, resizeHandle);

  // Panel stays open until manually closed via close button or toggle
  // (no click-outside-to-close — user needs panel open to drag conversations into folders)

  Logger.debug(TAG, `Folder panel rendered with ${state.folders.length} folders`);
}

/** Render a single folder element */
function renderFolder(folder: Folder): HTMLElement {
  const el = DOM.createElement('div', {
    class: 'voyager-folder',
    'data-voyager-id': folder.id,
  });

  const isOpen = state.openFolders.has(folder.id);
  const isSelected = state.selectedFolders.has(folder.id);
  const subfolders = state.folders.filter((f) => f.parentId === folder.id);
  const hasChildren = subfolders.length > 0 || folder.conversationIds.length > 0;

  // Row
  const row = DOM.createElement('div', {
    class: `voyager-folder-row${isSelected ? ' voyager-folder-selected' : ''}`,
    'data-voyager-id': folder.id,
    draggable: 'true',
  });

  const icon = DOM.createElement('span', {
    class: `voyager-folder-icon${isOpen ? ' voyager-folder-open' : ''}`,
  }, [hasChildren ? '\u25B6' : '\u25CB']);

  if (state.renamingId === folder.id) {
    const input = DOM.createElement('input', {
      class: 'voyager-folder-name-input',
      type: 'text',
      value: folder.name,
    });
    row.append(icon, input);

    // Auto-focus after append
    setTimeout(() => {
      (input as HTMLInputElement).focus();
      (input as HTMLInputElement).select();
    }, 0);

    let renameCommitted = false;
    const finishRename = async () => {
      if (renameCommitted) return;
      renameCommitted = true;

      const newName = (input as HTMLInputElement).value.trim();
      if (newName && newName !== folder.name) {
        const previousFolders = cloneFolders(state.folders);
        folder.name = newName;
        const saved = await persistFoldersWithRollback(previousFolders, 'Failed to rename folder');
        if (!saved) {
          state.renamingId = null;
          renderPanel();
          return;
        }
      }
      state.renamingId = null;
      renderPanel();
    };

    input.addEventListener('blur', () => {
      void finishRename();
    });
    input.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') {
        void finishRename();
      }
      if ((e as KeyboardEvent).key === 'Escape') {
        state.renamingId = null;
        renderPanel();
      }
    });
  } else {
    const name = DOM.createElement('span', { class: 'voyager-folder-name' }, [folder.name]);
    const count = DOM.createElement('span', { class: 'voyager-folder-count' }, [
      String(folder.conversationIds.length),
    ]);
    const delBtn = DOM.createElement('button', {
      class: 'voyager-folder-del',
      title: t(locale).deleteFolder,
      'aria-label': t(locale).deleteFolder,
    }, ['\u2715']);
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      void handleDeleteFolder(folder.id);
    });
    row.append(icon, name, count, delBtn);
  }

  el.appendChild(row);

  // Children (subfolders + conversations) — shown when open
  if (isOpen && hasChildren) {
    const children = DOM.createElement('div', { class: 'voyager-folder-children' });

    for (const sub of subfolders.sort((a, b) => a.order - b.order)) {
      children.appendChild(renderFolder(sub));
    }

    for (const convId of folder.conversationIds) {
      const conv = DOM.createElement('div', {
        class: 'voyager-folder-conv',
        'data-voyager-id': convId,
      });
      const convIcon = DOM.createElement('span', { class: 'voyager-folder-conv-icon' }, ['\u{1F4AC}']);
      const convName = DOM.createElement('span', {}, [convId.slice(0, 12) + '...']);
      conv.append(convIcon, convName);
      children.appendChild(conv);
    }

    el.appendChild(children);
  }

  return el;
}

// ─── Resize Handling ────────────────────────────────────────────

function setupResize(panel: HTMLElement, handle: HTMLElement): void {
  let startY = 0;
  let startHeight = 0;

  const onMouseMove = (e: MouseEvent) => {
    const delta = e.clientY - startY;
    const newHeight = Math.max(200, startHeight + delta);
    panel.style.maxHeight = newHeight + 'px';
    panel.style.height = newHeight + 'px';
  };

  const onMouseUp = () => {
    handle.classList.remove('voyager-resizing');
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  const onMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    startY = e.clientY;
    startHeight = panel.getBoundingClientRect().height;
    handle.classList.add('voyager-resizing');
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  handle.addEventListener('mousedown', onMouseDown);
  state.cleanups.push(() => {
    handle.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  });
}

// ─── Event Handlers ─────────────────────────────────────────────

function handleFolderClick(target: Element): void {
  const folderId = target.getAttribute('data-voyager-id');
  if (!folderId) return;

  // Toggle open/closed
  if (state.openFolders.has(folderId)) {
    state.openFolders.delete(folderId);
  } else {
    state.openFolders.add(folderId);
  }
  renderPanel();
}

function handleFolderDblClick(target: Element): void {
  const folderId = target.getAttribute('data-voyager-id');
  if (!folderId) return;
  state.renamingId = folderId;
  renderPanel();
}

function handleConvClick(target: Element): void {
  const convId = target.getAttribute('data-voyager-id');
  if (!convId) return;
  // Navigate to the conversation
  window.location.href = `/chat/${convId}`;
}

function toggleSelect(folderId: string): void {
  if (state.selectedFolders.has(folderId)) {
    state.selectedFolders.delete(folderId);
  } else {
    state.selectedFolders.add(folderId);
  }
  renderPanel();
}

async function handleDeleteFolder(folderId: string): Promise<void> {
  if (!window.confirm(t(locale).deleteFolderConfirm)) return;

  const previousFolders = cloneFolders(state.folders);
  const idsToDelete = new Set<string>();
  function collectIds(id: string): void {
    idsToDelete.add(id);
    for (const f of state.folders) {
      if (f.parentId === id) collectIds(f.id);
    }
  }
  collectIds(folderId);

  state.folders = state.folders.filter((f) => !idsToDelete.has(f.id));
  state.openFolders = new Set([...state.openFolders].filter((id) => !idsToDelete.has(id)));
  state.selectedFolders = new Set([...state.selectedFolders].filter((id) => !idsToDelete.has(id)));

  const saved = await persistFoldersWithRollback(previousFolders, 'Failed to delete folder');
  if (!saved) return;
  renderPanel();
}

async function handleAddFolder(): Promise<void> {
  const previousFolders = cloneFolders(state.folders);
  const folder: Folder = {
    id: uuid(),
    name: t(locale).newFolder,
    parentId: null,
    conversationIds: [],
    createdAt: Date.now(),
    order: state.folders.filter((f) => f.parentId === null).length,
  };
  state.folders.push(folder);
  state.renamingId = folder.id;
  const saved = await persistFoldersWithRollback(previousFolders, 'Failed to create folder');
  if (!saved) return;
  renderPanel();
}

// ─── Drag & Drop ────────────────────────────────────────────────

function setupDragDrop(list: HTMLElement): void {
  // Make sidebar conversation items draggable
  const convItems = DOM.queryAll('sidebarConversationItem');
  for (const item of convItems) {
    (item as HTMLElement).draggable = true;
    const dragStartHandler = (e: Event) => {
      const de = e as DragEvent;
      const href = item.getAttribute('href') ?? '';
      const convId = /\/chat\/([a-f0-9-]+)/i.exec(href)?.[1];
      if (convId && de.dataTransfer) {
        de.dataTransfer.setData('text/plain', convId);
        de.dataTransfer.effectAllowed = 'move';
        (item as HTMLElement).classList.add('voyager-folder-dragging');
      }
    };
    item.addEventListener('dragstart', dragStartHandler);
    state.cleanups.push(() => item.removeEventListener('dragstart', dragStartHandler));

    const dragEndHandler = () => {
      (item as HTMLElement).classList.remove('voyager-folder-dragging');
    };
    item.addEventListener('dragend', dragEndHandler);
    state.cleanups.push(() => item.removeEventListener('dragend', dragEndHandler));
  }

  // Drop targets on folders (only for conversation drops, not folder reorder)
  const dragOverHandler = (e: Event) => {
    const de = e as DragEvent;
    // Skip if this is a folder reorder drag
    if (de.dataTransfer?.types.includes('application/x-voyager-folder')) return;
    const target = (de.target as Element | null)?.closest('.voyager-folder-row');
    if (target) {
      de.preventDefault();
      if (de.dataTransfer) de.dataTransfer.dropEffect = 'move';
      target.classList.add('voyager-folder-drop-target');
    }
  };
  list.addEventListener('dragover', dragOverHandler);
  state.cleanups.push(() => list.removeEventListener('dragover', dragOverHandler));

  const dragLeaveHandler = (e: Event) => {
    const target = (e.target as Element | null)?.closest('.voyager-folder-row');
    target?.classList.remove('voyager-folder-drop-target');
  };
  list.addEventListener('dragleave', dragLeaveHandler);
  state.cleanups.push(() => list.removeEventListener('dragleave', dragLeaveHandler));

  const dropHandler = async (e: Event) => {
    const de = e as DragEvent;
    de.preventDefault();
    const target = (de.target as Element | null)?.closest('.voyager-folder-row');
    target?.classList.remove('voyager-folder-drop-target');

    const convId = de.dataTransfer?.getData('text/plain');
    const folderId = target?.getAttribute('data-voyager-id');
    if (!convId || !folderId) return;

    const folder = state.folders.find((f) => f.id === folderId);
    if (folder && !folder.conversationIds.includes(convId)) {
      const previousFolders = cloneFolders(state.folders);
      // Remove from other folders first
      for (const f of state.folders) {
        f.conversationIds = f.conversationIds.filter((id) => id !== convId);
      }
      folder.conversationIds.push(convId);

      const saved = await persistFoldersWithRollback(
        previousFolders,
        'Failed to move conversation into folder',
      );
      if (!saved) {
        renderPanel();
        return;
      }

      renderPanel();
      Logger.info(TAG, `Conversation ${convId.slice(0, 8)} added to folder "${folder.name}"`);
    }
  };
  list.addEventListener('drop', dropHandler);
  state.cleanups.push(() => list.removeEventListener('drop', dropHandler));
}

// ─── Folder Reorder (Drag & Drop) ───────────────────────────────

function setupFolderReorder(list: HTMLElement): void {
  let draggedFolderId: string | null = null;

  const rows = list.querySelectorAll('.voyager-folder-row[draggable="true"]');
  for (const row of rows) {
    const htmlRow = row as HTMLElement;
    const folderId = htmlRow.getAttribute('data-voyager-id');
    if (!folderId) continue;

    const onDragStart = (e: Event) => {
      const de = e as DragEvent;
      draggedFolderId = folderId;
      if (de.dataTransfer) {
        de.dataTransfer.setData('application/x-voyager-folder', folderId);
        de.dataTransfer.effectAllowed = 'move';
      }
      htmlRow.classList.add('voyager-folder-dragging-row');
    };

    const onDragEnd = () => {
      htmlRow.classList.remove('voyager-folder-dragging-row');
      draggedFolderId = null;
      // Remove all reorder indicators
      list.querySelectorAll('.voyager-folder-reorder-target').forEach((el) =>
        el.classList.remove('voyager-folder-reorder-target'),
      );
    };

    htmlRow.addEventListener('dragstart', onDragStart);
    htmlRow.addEventListener('dragend', onDragEnd);
    state.cleanups.push(() => htmlRow.removeEventListener('dragstart', onDragStart));
    state.cleanups.push(() => htmlRow.removeEventListener('dragend', onDragEnd));
  }

  // Dragover on folder rows — show reorder indicator
  const onDragOver = (e: Event) => {
    const de = e as DragEvent;
    if (!draggedFolderId) return;
    // Only handle folder-to-folder reorder, not conversation drops
    if (!de.dataTransfer?.types.includes('application/x-voyager-folder')) return;

    const target = (de.target as Element | null)?.closest('.voyager-folder-row') as HTMLElement | null;
    if (!target || target.getAttribute('data-voyager-id') === draggedFolderId) return;

    de.preventDefault();
    if (de.dataTransfer) de.dataTransfer.dropEffect = 'move';

    // Clear previous indicators
    list.querySelectorAll('.voyager-folder-reorder-target').forEach((el) =>
      el.classList.remove('voyager-folder-reorder-target'),
    );
    target.classList.add('voyager-folder-reorder-target');
  };

  const onDragLeave = (e: Event) => {
    const target = (e.target as Element | null)?.closest('.voyager-folder-row');
    target?.classList.remove('voyager-folder-reorder-target');
  };

  const onDrop = async (e: Event) => {
    const de = e as DragEvent;
    if (!draggedFolderId) return;

    const sourceFolderId = de.dataTransfer?.getData('application/x-voyager-folder');
    if (!sourceFolderId) return;

    de.preventDefault();
    const targetRow = (de.target as Element | null)?.closest('.voyager-folder-row');
    targetRow?.classList.remove('voyager-folder-reorder-target');

    const targetFolderId = targetRow?.getAttribute('data-voyager-id');
    if (!targetFolderId || targetFolderId === sourceFolderId) return;

    const sourceFolder = state.folders.find((f) => f.id === sourceFolderId);
    const targetFolder = state.folders.find((f) => f.id === targetFolderId);
    if (!sourceFolder || !targetFolder) return;

    // Only reorder within the same parent level
    if (sourceFolder.parentId !== targetFolder.parentId) return;

    const previousFolders = cloneFolders(state.folders);
    const siblings = state.folders
      .filter((f) => f.parentId === sourceFolder.parentId)
      .sort((a, b) => a.order - b.order);

    // Remove source from current position and insert at target position
    const withoutSource = siblings.filter((f) => f.id !== sourceFolderId);
    const targetIndex = withoutSource.findIndex((f) => f.id === targetFolderId);
    withoutSource.splice(targetIndex + 1, 0, sourceFolder);

    // Update order values
    withoutSource.forEach((f, i) => {
      f.order = i;
    });

    const saved = await persistFoldersWithRollback(previousFolders, 'Failed to reorder folders');
    if (!saved) return;

    draggedFolderId = null;
    renderPanel();
    Logger.info(TAG, `Reordered folder "${sourceFolder.name}" after "${targetFolder.name}"`);
  };

  list.addEventListener('dragover', onDragOver);
  list.addEventListener('dragleave', onDragLeave);
  list.addEventListener('drop', onDrop);
  state.cleanups.push(() => list.removeEventListener('dragover', onDragOver));
  state.cleanups.push(() => list.removeEventListener('dragleave', onDragLeave));
  state.cleanups.push(() => list.removeEventListener('drop', onDrop));
}

// ─── Import / Export ────────────────────────────────────────────

function handleExport(): void {
  const data = JSON.stringify(state.folders, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `claude-voyager-folders-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    ids.add(trimmed);
  }
  return [...ids];
}

function normalizeTimestamp(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  return fallback;
}

function normalizeOrder(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  return fallback;
}

function normalizeImportedFolder(raw: unknown, fallbackOrder: number): Folder | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const data = raw as Record<string, unknown>;

  const parsedId = normalizeNonEmptyString(data.id);
  const parsedName = normalizeNonEmptyString(data.name);
  if (!parsedId && !parsedName) return null;

  const now = Date.now();
  return {
    id: parsedId ?? uuid(),
    name: parsedName ?? t(locale).importedFolder,
    parentId: normalizeNonEmptyString(data.parentId),
    conversationIds: normalizeStringList(data.conversationIds),
    createdAt: normalizeTimestamp(data.createdAt, now),
    order: normalizeOrder(data.order, fallbackOrder),
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
          window.alert(t(locale).importFailedArray);
          return;
        }

        const normalized: Folder[] = [];
        const seenIds = new Set<string>();
        let invalidCount = 0;
        let duplicateCount = 0;

        imported.forEach((raw, index) => {
          const folder = normalizeImportedFolder(raw, index);
          if (!folder) {
            invalidCount += 1;
            return;
          }
          if (seenIds.has(folder.id)) {
            duplicateCount += 1;
            return;
          }
          seenIds.add(folder.id);
          normalized.push(folder);
        });

        const validIds = new Set(normalized.map((f) => f.id));
        for (const folder of normalized) {
          if (folder.parentId === folder.id) {
            folder.parentId = null;
            continue;
          }
          if (folder.parentId !== null && !validIds.has(folder.parentId)) {
            folder.parentId = null;
          }
        }

        const byParent = new Map<string | null, Folder[]>();
        for (const folder of normalized) {
          const siblings = byParent.get(folder.parentId) ?? [];
          siblings.push(folder);
          byParent.set(folder.parentId, siblings);
        }
        for (const siblings of byParent.values()) {
          siblings
            .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
            .forEach((folder, index) => {
              folder.order = index;
            });
        }

        const previousFolders = cloneFolders(state.folders);
        state.folders = normalized;
        state.openFolders.clear();
        state.selectedFolders.clear();
        try {
          await saveFolders();
        } catch (err) {
          state.folders = previousFolders;
          Logger.error(TAG, 'Failed to persist imported folders', err);
          window.alert(t(locale).importFailedPersist);
          return;
        }
        renderPanel();

        window.alert(
          `${t(locale).importFinished}\nImported: ${normalized.length}\nSkipped duplicates: ${duplicateCount}\nSkipped invalid: ${invalidCount}`,
        );
        Logger.info(
          TAG,
          `Folder import summary: imported=${normalized.length}, duplicates=${duplicateCount}, invalid=${invalidCount}`,
        );
      } catch (err) {
        Logger.error(TAG, 'Import parse error', err);
        window.alert(t(locale).importFailedJson);
      }
    };
    reader.readAsText(file);
  });
  input.click();
}

// ─── Persistence ────────────────────────────────────────────────

function cloneFolders(folders: Folder[]): Folder[] {
  return folders.map((folder) => ({
    ...folder,
    conversationIds: [...folder.conversationIds],
  }));
}

async function persistFoldersWithRollback(previousFolders: Folder[], context: string): Promise<boolean> {
  try {
    await saveFolders();
    return true;
  } catch (err) {
    state.folders = previousFolders;
    Logger.error(TAG, context, err);
    window.alert(t(locale).failedSaveFolders);
    return false;
  }
}

async function saveFolders(): Promise<void> {
  await Storage.setFolders(state.folders);
}

// ─── Cleanup ────────────────────────────────────────────────────

function removePanel(): void {
  for (const cleanup of state.cleanups) {
    cleanup();
  }
  state.cleanups = [];
  state.panel?.remove();
  state.panel = null;
}

// ─── Feature Module Export ──────────────────────────────────────

export const FolderFeature: FeatureModule = {
  key: 'folders',

  init(_settings: VoyagerSettings) {
    Logger.info(TAG, 'Initializing folder feature');
    locale = _settings.locale ?? 'en';
    state = createState();
    DOM.injectStyles('voyager-folders', FOLDER_CSS);

    // Bei langsamen Sidebar-Rebuilds mehrfach versuchen.
    ensureToggleButtonInjected(12);
    observeSidebarMutations();

    Storage.getFolders().then((folders) => {
      state.folders = folders;
      // If panel is already open, re-render with loaded data
      if (state.panelOpen) {
        renderPanel();
      }
      Logger.debug(TAG, `Loaded ${folders.length} folders from storage`);
    }).catch((err) => {
      Logger.error(TAG, 'Failed to load folders', err);
    });
  },

  destroy() {
    Logger.info(TAG, 'Destroying folder feature');
    stopSidebarObserver();
    removePanel();
    removeToggleButton();
    DOM.removeStyles('voyager-folders');
    state = createState();
  },

  onNavigate() {
    // Re-inject sidebar item if it was removed (SPA navigation can rebuild the nav)
    ensureToggleButtonInjected(8);
    observeSidebarMutations();
    syncFolderTooltipState();
    setTimeout(syncFolderTooltipState, 250);
    // Re-render panel to update drag targets (new sidebar items may have loaded)
    if (state.panelOpen) {
      renderPanel();
    }
  },
};
