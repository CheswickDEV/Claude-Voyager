/**
 * Content script entry point.
 * Injected into https://claude.ai/* pages.
 *
 * Responsibilities:
 * - Initialize core services
 * - Set up MutationObservers for dynamic content
 * - Load and initialize enabled feature modules
 * - Handle navigation changes (SPA route transitions)
 */

import { Logger } from '@core/services/LoggerService';
import { Storage } from '@core/services/StorageService';
import { DOM } from '@core/services/DOMService';
import { Messaging } from '@core/services/MessageService';
import { debounce } from '@core/utils';
import type { VoyagerSettings, FeatureKey } from '@core/types';

// â”€â”€â”€ Feature Imports â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import { TimelineFeature } from '@features/timeline/TimelineFeature';
import { FolderFeature } from '@features/folder/FolderFeature';
import { PromptFeature } from '@features/prompt/PromptFeature';
import { ExportFeature } from '@features/export/ExportFeature';
import { WidthAdjustFeature } from '@features/widthAdjust/WidthAdjustFeature';
import { TabTitleSyncFeature } from '@features/tabTitleSync/TabTitleSyncFeature';
import { FormulaCopyFeature } from '@features/formulaCopy/FormulaCopyFeature';

const TAG = 'Content';

/** Feature module interface â€” each feature implements this */
export interface FeatureModule {
  /** Unique feature key */
  key: FeatureKey;
  /** Initialize the feature (called once) */
  init(settings: VoyagerSettings): void;
  /** Tear down the feature (remove UI, observers, etc.) */
  destroy(): void;
  /** Called when navigating to a new chat */
  onNavigate?(conversationId: string | null): void;
  /** Called when new messages appear in the DOM */
  onMessagesChanged?(container: Element): void;
}

/** Registry of loaded feature modules */
const features = new Map<FeatureKey, FeatureModule>();

/** Currently active feature instances */
const activeFeatures = new Set<FeatureKey>();

/** Last known URL path â€” for detecting SPA navigation */
let lastPath = window.location.pathname;
let messageObserverRetryTimer: ReturnType<typeof setTimeout> | null = null;
let navigationListenerReady = false;
let sidebarPinRetryTimer: ReturnType<typeof setInterval> | null = null;
let sidebarPinningEnabled = false;
let pinnedSidebarNav: HTMLElement | null = null;
const sidebarStyleSnapshots = new Map<HTMLElement, string | null>();
interface SidebarPromotedItem {
  href: string;
  node: HTMLElement;
  placeholder: Comment;
  sourceParent: HTMLElement;
}
const sidebarPromotedItems: SidebarPromotedItem[] = [];

const MESSAGE_OBSERVER_MAX_RETRIES = 6;

// â”€â”€â”€ Feature Registration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Register a feature module. Called by each feature's entry file.
 * Features are not initialized until explicitly activated based on settings.
 */
export function registerFeature(module: FeatureModule): void {
  features.set(module.key, module);
  Logger.debug(TAG, `Feature registered: ${module.key}`);
}

// â”€â”€â”€ Lifecycle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Activate a feature if it's registered and not already active */
function activateFeature(key: FeatureKey, settings: VoyagerSettings): void {
  if (activeFeatures.has(key)) return;
  const module = features.get(key);
  if (!module) {
    Logger.debug(TAG, `Feature "${key}" not registered yet`);
    return;
  }
  try {
    module.init(settings);
    activeFeatures.add(key);
    Logger.info(TAG, `Feature activated: ${key}`);
  } catch (err) {
    Logger.error(TAG, `Failed to activate feature "${key}"`, err);
  }
}

/** Deactivate a feature */
function deactivateFeature(key: FeatureKey): void {
  if (!activeFeatures.has(key)) return;
  const module = features.get(key);
  if (module) {
    try {
      module.destroy();
    } catch (err) {
      Logger.error(TAG, `Error destroying feature "${key}"`, err);
    }
  }
  activeFeatures.delete(key);
  Logger.info(TAG, `Feature deactivated: ${key}`);
}

/** Sync active features with current settings */
async function syncFeatures(): Promise<void> {
  const settings = await Storage.getSettings();
  const featureKeys = Object.keys(settings.features) as FeatureKey[];

  for (const key of featureKeys) {
    if (settings.features[key]) {
      activateFeature(key, settings);
    } else {
      deactivateFeature(key);
    }
  }

  // Nur bei aktivierter Ordner-Funktion die Nav-Items in den oberen Sticky-Bereich heben.
  setSidebarPinningEnabled(settings.features.folders);
}

// â”€â”€â”€ Navigation Detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Detect SPA navigation by polling the URL path.
 * claude.ai uses pushState for navigation without full page reloads.
 */
function checkNavigation(): void {
  const currentPath = window.location.pathname;
  if (currentPath === lastPath) return;

  lastPath = currentPath;
  const conversationId = DOM.getConversationId();
  Logger.info(TAG, `Navigation detected: ${currentPath}`, { conversationId });

  // Notify all active features
  for (const key of activeFeatures) {
    const module = features.get(key);
    module?.onNavigate?.(conversationId);
  }

  // Sidebar wird bei SPA-Navigation häufig neu aufgebaut.
  // Deshalb Promotion erneut anwenden, solange Ordner aktiv ist.
  if (sidebarPinningEnabled) {
    applySidebarPinning();
    setTimeout(applySidebarPinning, 250);
  }

  // Re-establish the message observer on the new chat container.
  // claude.ai replaces the main content element on SPA navigation,
  // which orphans the old MutationObserver. Wait briefly for React
  // to render the new container before reconnecting.
  setTimeout(() => setupMessageObserver(), 300);
}

// â”€â”€â”€ Message Observer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Set up observer for new messages appearing in the chat */
function setupMessageObserver(retryCount = 0): void {
  const container = DOM.query('mainContent');
  if (!container) {
    if (retryCount >= MESSAGE_OBSERVER_MAX_RETRIES) {
      Logger.error(TAG, 'Main content container not found after retries. Observer disabled.');
      return;
    }

    const delay = Math.min(1000 * 2 ** retryCount, 10_000);
    Logger.warn(TAG, `Main content container not found, retrying in ${delay}ms`, {
      retry: retryCount + 1,
      maxRetries: MESSAGE_OBSERVER_MAX_RETRIES,
    });
    messageObserverRetryTimer = setTimeout(() => setupMessageObserver(retryCount + 1), delay);
    return;
  }

  if (messageObserverRetryTimer) {
    clearTimeout(messageObserverRetryTimer);
    messageObserverRetryTimer = null;
  }

  const onMutation = debounce(() => {
    for (const key of activeFeatures) {
      const module = features.get(key);
      module?.onMessagesChanged?.(container);
    }
  }, 150);

  DOM.observe('messages', container, onMutation, {
    childList: true,
    subtree: true,
  });

  Logger.info(TAG, 'Message observer initialized');
}

// â”€â”€â”€ Message Handling â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function setupMessageHandlers(): void {
  Messaging.on('SETTINGS_CHANGED', async () => {
    await syncFeatures();
    return { success: true };
  });

  Messaging.on('FEATURE_TOGGLE', async (message) => {
    const { key, enabled } = message.payload as { key: FeatureKey; enabled: boolean };
    if (enabled) {
      const settings = await Storage.getSettings();
      activateFeature(key, settings);
    } else {
      deactivateFeature(key);
    }
    if (key === 'folders') {
      setSidebarPinningEnabled(enabled);
    }
    return { success: true };
  });

  Messaging.listen();
}

function setupNavigationListeners(): void {
  if (navigationListenerReady) return;

  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  try {
    history.pushState = ((...args: Parameters<History['pushState']>) => {
      const result = originalPushState(...args);
      setTimeout(checkNavigation, 0);
      return result;
    }) as History['pushState'];

    history.replaceState = ((...args: Parameters<History['replaceState']>) => {
      const result = originalReplaceState(...args);
      setTimeout(checkNavigation, 0);
      return result;
    }) as History['replaceState'];
  } catch (err) {
    Logger.warn(TAG, 'Failed to hook history API, using polling fallback', err);
    setInterval(checkNavigation, 1000);
  }

  window.addEventListener('popstate', checkNavigation);
  window.addEventListener('hashchange', checkNavigation);
  navigationListenerReady = true;
}

// â”€â”€â”€ Main Entry Point â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function main(): Promise<void> {
  Logger.info(TAG, 'Claude Voyager content script loaded');

  // Set up message handlers for communication with popup/background
  setupMessageHandlers();

  // Wait for the main UI to be ready
  const mainEl = await DOM.waitForElement('mainContent', { timeout: 15_000 });
  if (!mainEl) {
    Logger.error(TAG, 'claude.ai main content not found after timeout. Extension inactive.');
    return;
  }

  Logger.info(TAG, 'claude.ai UI detected, initializing features');

  // Sync and activate features based on stored settings
  await syncFeatures();

  // Set up message observer for dynamic content
  setupMessageObserver();

  // Listen for SPA navigation changes
  setupNavigationListeners();

  // Safety net in case site scripts overwrite history hooks.
  setInterval(checkNavigation, 1000);

  // Inject base styles for Voyager UI elements
  DOM.injectStyles('voyager-base', VOYAGER_BASE_CSS);

  // Force re-sync after 1.5s if features didn't render properly on first load.
  // This handles cases where the DOM wasn't fully ready during initial init.
  setTimeout(() => {
    const hasVisibleFeature = !!document.querySelector('[data-voyager]');
    if (!hasVisibleFeature && activeFeatures.size > 0) {
      Logger.info(TAG, 'Features not visible after init — forcing re-sync');
      void syncFeatures();
    }
  }, 1500);

  Logger.info(TAG, 'Initialization complete');
}

function findSidebarNav(): HTMLElement | null {
  const profileBtn = document.querySelector('[data-testid="user-menu-button"]');
  if (!profileBtn) return null;
  return profileBtn.closest('nav') as HTMLElement | null;
}

function findSidebarTopGroup(nav: HTMLElement): HTMLElement | null {
  return nav.querySelector(':scope > div.flex.flex-col.px-2.gap-px') as HTMLElement | null;
}

function findSidebarScrollShell(nav: HTMLElement): HTMLElement | null {
  return (
    nav.querySelector(':scope > div.flex.flex-grow.flex-col.overflow-y-auto.overflow-x-hidden') as HTMLElement | null
  ) ?? (
    nav.querySelector(':scope > div.flex.flex-grow.flex-col.overflow-y-auto') as HTMLElement | null
  );
}

function findSidebarScrollableNavGroup(scrollShell: HTMLElement): HTMLElement | null {
  return scrollShell.querySelector(':scope > div.flex.flex-col.px-2.gap-px') as HTMLElement | null;
}

function findDirectChildContainer(parent: HTMLElement, descendant: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = descendant;
  while (current && current.parentElement !== parent) {
    current = current.parentElement;
  }
  return current?.parentElement === parent ? current : null;
}

function restoreSidebarPinning(): void {
  if (sidebarPinRetryTimer) {
    clearInterval(sidebarPinRetryTimer);
    sidebarPinRetryTimer = null;
  }

  // Bereits verschobene Nav-Items exakt an ihre Originalpositionen zurücksetzen.
  while (sidebarPromotedItems.length > 0) {
    const promoted = sidebarPromotedItems.pop();
    if (!promoted) continue;
    promoted.node.removeAttribute('data-voyager-sidebar-promoted');
    if (promoted.placeholder.parentNode) {
      promoted.placeholder.parentNode.insertBefore(promoted.node, promoted.placeholder);
      promoted.placeholder.remove();
      continue;
    }
    if (promoted.sourceParent.isConnected) {
      promoted.sourceParent.appendChild(promoted.node);
    }
  }

  if (pinnedSidebarNav?.isConnected) {
    pinnedSidebarNav.removeAttribute('data-voyager-sidebar-pinned');
  }

  // Fallback cleanup für bereits neu aufgebaute Sidebar-Knoten.
  const staleNavs = document.querySelectorAll('nav[data-voyager-sidebar-pinned]');
  for (const node of staleNavs) {
    (node as HTMLElement).removeAttribute('data-voyager-sidebar-pinned');
  }
  const stalePromoted = document.querySelectorAll('[data-voyager-sidebar-promoted]');
  for (const node of stalePromoted) {
    (node as HTMLElement).removeAttribute('data-voyager-sidebar-promoted');
  }

  // Legacy-Cleanup: alte Marker/Styles aus früherer Scroll-Pinning-Version entfernen.
  const staleShells = document.querySelectorAll('[data-voyager-sidebar-scroll-shell]');
  for (const node of staleShells) {
    const shell = node as HTMLElement;
    shell.style.removeProperty('display');
    shell.style.removeProperty('flex-direction');
    shell.style.removeProperty('min-height');
    shell.style.removeProperty('flex');
    shell.style.removeProperty('overflow');
    for (let i = 0; i < shell.children.length; i++) {
      const child = shell.children[i] as HTMLElement | undefined;
      child?.style.removeProperty('flex-shrink');
    }
    shell.removeAttribute('data-voyager-sidebar-scroll-shell');
  }
  const staleRecents = document.querySelectorAll('[data-voyager-recents-scroll]');
  for (const node of staleRecents) {
    const recents = node as HTMLElement;
    recents.style.removeProperty('overflow-y');
    recents.style.removeProperty('overflow-x');
    recents.style.removeProperty('min-height');
    recents.style.removeProperty('flex');
    recents.removeAttribute('data-voyager-recents-scroll');
  }

  pinnedSidebarNav = null;
  sidebarStyleSnapshots.clear();
}

function applySidebarPinning(): void {
  if (!sidebarPinningEnabled) {
    restoreSidebarPinning();
    return;
  }

  const TARGET_HREFS = ['/recents', '/projects', '/artifacts', '/code'] as const;

  const applyOnce = (): boolean => {
    const nav = findSidebarNav();
    if (!nav) return false;

    const topGroup = findSidebarTopGroup(nav);
    if (!topGroup) return false;

    const scrollShell = findSidebarScrollShell(nav);
    if (!scrollShell) return false;

    const scrollNavGroup = findSidebarScrollableNavGroup(scrollShell);
    if (!scrollNavGroup) return false;

    if (pinnedSidebarNav && pinnedSidebarNav !== nav) {
      restoreSidebarPinning();
    }

    const availableHrefs = TARGET_HREFS.filter(
      (href) => !!nav.querySelector(`a[data-dd-action-name="sidebar-nav-item"][href="${href}"]`),
    );
    if (availableHrefs.length === 0) return false;

    for (const href of availableHrefs) {
      const sourceLink = scrollNavGroup.querySelector(
        `a[data-dd-action-name="sidebar-nav-item"][href="${href}"]`,
      ) as HTMLElement | null;
      if (!sourceLink) continue;

      const itemRoot = findDirectChildContainer(scrollNavGroup, sourceLink);
      if (!itemRoot) continue;

      const placeholder = document.createComment(`voyager-promoted-nav:${href}`);
      scrollNavGroup.insertBefore(placeholder, itemRoot);
      itemRoot.setAttribute('data-voyager-sidebar-promoted', href);
      sidebarPromotedItems.push({
        href,
        node: itemRoot,
        placeholder,
        sourceParent: scrollNavGroup,
      });
      topGroup.appendChild(itemRoot);
    }

    const allAvailablePromoted = availableHrefs.every(
      (href) => !!topGroup.querySelector(`a[data-dd-action-name="sidebar-nav-item"][href="${href}"]`),
    );
    if (!allAvailablePromoted) return false;

    nav.setAttribute('data-voyager-sidebar-pinned', 'true');
    pinnedSidebarNav = nav;
    return true;
  };

  if (applyOnce()) {
    if (sidebarPinRetryTimer) {
      clearInterval(sidebarPinRetryTimer);
      sidebarPinRetryTimer = null;
    }
    return;
  }

  if (sidebarPinRetryTimer) return;
  let attempts = 0;
  sidebarPinRetryTimer = setInterval(() => {
    if (!sidebarPinningEnabled) {
      restoreSidebarPinning();
      return;
    }
    if (applyOnce() || ++attempts > 30) {
      if (sidebarPinRetryTimer) {
        clearInterval(sidebarPinRetryTimer);
        sidebarPinRetryTimer = null;
      }
    }
  }, 500);
}

function setSidebarPinningEnabled(enabled: boolean): void {
  if (sidebarPinningEnabled === enabled) {
    if (enabled) applySidebarPinning();
    return;
  }

  sidebarPinningEnabled = enabled;
  if (enabled) {
    applySidebarPinning();
    return;
  }

  restoreSidebarPinning();
}
const VOYAGER_BASE_CSS = `
  /* Claude Voyager base styles */
  [data-voyager] {
    font-family: inherit;
    box-sizing: border-box;
  }

  .voyager-panel {
    position: fixed;
    z-index: 10000;
    background: var(--bg-300, #1a1a2e);
    border: 1px solid var(--border-300, #333);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    color: var(--text-100, #e0e0e0);
    font-size: 13px;
  }

  .voyager-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border: 1px solid var(--border-300, #444);
    border-radius: 6px;
    background: var(--bg-200, #2a2a40);
    color: var(--text-200, #ccc);
    cursor: pointer;
    font-size: 12px;
    transition: background 0.15s, border-color 0.15s;
  }

  .voyager-btn:hover {
    background: var(--bg-100, #3a3a55);
    border-color: var(--accent-main-100, #6366f1);
  }

  .voyager-hidden {
    display: none !important;
  }

  /* â”€â”€â”€ Native-looking Tooltip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  /* Matches claude.ai's dark tooltip overlay style */
  [data-voyager-tooltip] {
    position: relative;
  }

  [data-voyager-tooltip]::after {
    content: attr(data-voyager-tooltip);
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%) scale(0.95);
    padding: 5px 10px;
    border-radius: 8px;
    background: var(--bg-500, #0e0c0b);
    color: var(--text-100, rgba(232, 228, 222, 0.95));
    font-size: 12px;
    font-weight: 400;
    line-height: 1.4;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s ease, transform 0.15s ease;
    z-index: 60000;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  }

  [data-voyager-tooltip]::before {
    content: '';
    position: absolute;
    bottom: calc(100% + 2px);
    left: 50%;
    transform: translateX(-50%);
    border: 5px solid transparent;
    border-top-color: var(--bg-500, #0e0c0b);
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s ease;
    z-index: 60001;
  }

  [data-voyager-tooltip]:hover::after {
    opacity: 1;
    transform: translateX(-50%) scale(1);
  }

  [data-voyager-tooltip]:hover::before {
    opacity: 1;
  }

  /* Tooltip below variant */
  [data-voyager-tooltip-pos="bottom"]::after {
    bottom: auto;
    top: calc(100% + 8px);
  }

  [data-voyager-tooltip-pos="bottom"]::before {
    bottom: auto;
    top: calc(100% + 2px);
    border-top-color: transparent;
    border-bottom-color: var(--bg-500, #0e0c0b);
  }

  /* Tooltip rechts (wie in der Sidebar), bewusst mit vollschwarzem Hintergrund */
  [data-voyager-tooltip-pos="right"]::after {
    top: 50%;
    left: calc(100% + 10px);
    bottom: auto;
    transform: translateY(-50%) scale(0.95);
    background: #000;
    color: #fff;
  }

  [data-voyager-tooltip-pos="right"]::before {
    top: 50%;
    left: calc(100% + 2px);
    bottom: auto;
    transform: translateY(-50%);
    border-top-color: transparent;
    border-right-color: #000;
  }

  [data-voyager-tooltip-pos="right"]:hover::after {
    transform: translateY(-50%) scale(1);
  }

  /* Tooltip links (for elements near the right edge) */
  [data-voyager-tooltip-pos="left"]::after {
    top: 50%;
    right: calc(100% + 10px);
    left: auto;
    bottom: auto;
    transform: translateY(-50%) scale(0.95);
    background: #000;
    color: #fff;
  }

  [data-voyager-tooltip-pos="left"]::before {
    top: 50%;
    right: calc(100% + 2px);
    left: auto;
    bottom: auto;
    transform: translateY(-50%);
    border-top-color: transparent;
    border-left-color: #000;
    border-right-color: transparent;
  }

  [data-voyager-tooltip-pos="left"]:hover::after {
    transform: translateY(-50%) scale(1);
  }
`;

// â”€â”€â”€ Feature Registration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

registerFeature(TimelineFeature);
registerFeature(FolderFeature);
registerFeature(PromptFeature);
registerFeature(ExportFeature);
registerFeature(WidthAdjustFeature);
registerFeature(TabTitleSyncFeature);
registerFeature(FormulaCopyFeature);

// â”€â”€â”€ Bootstrap â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

main().catch((err) => {
  Logger.error(TAG, 'Fatal initialization error', err);
});

