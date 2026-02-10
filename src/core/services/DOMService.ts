/**
 * Abstract DOM interaction layer for claude.ai.
 *
 * All CSS selectors targeting the claude.ai UI are centralized here.
 * When claude.ai changes its DOM structure, only this file needs updating.
 *
 * The service provides:
 * - Central selector registry
 * - MutationObserver management
 * - Safe DOM queries with retry logic
 * - Event delegation for injected UI
 */

import DOMPurify from 'dompurify';
import { Logger } from './LoggerService';
import type { ChatMessage, MessageRole } from '@core/types';

const TAG = 'DOM';

// ─── Selector Registry ──────────────────────────────────────────
// These selectors target claude.ai's current DOM structure.
// RISK: claude.ai may change class names, data attributes or structure at any time.
// All selectors are gathered here so updates are isolated to one location.

export const Selectors = {
  /**
   * The React root element.
   * Verified 2025-02: claude.ai uses div.root (no #__next, no #root id)
   */
  reactRoot: '.root',

  /**
   * Main content area containing the chat (right of sidebar).
   * Verified 2025-02: No <main> element exists. The content area is the
   * third child of the layout container: div.w-full.relative.min-w-0
   */
  mainContent: '.root .w-full.relative.min-w-0',

  /** The sidebar containing the conversation list */
  sidebar: 'nav',

  /** Individual conversation items in the sidebar */
  sidebarConversationItem: 'a[href^="/chat/"]',

  /**
   * The container holding all chat messages (the thread).
   * Direct children alternate between user turns, assistant turns, and separators.
   * Verified 2025-02: .flex-1.flex.flex-col.px-4.max-w-3xl
   */
  chatMessageContainer: '.flex-1.flex.flex-col.px-4.max-w-3xl',

  /**
   * Individual message blocks.
   * User messages have data-testid="user-message".
   * Assistant messages have class "font-claude-response".
   * Combined selector to match both types.
   */
  messageBlock: '[data-testid="user-message"], .font-claude-response',

  /**
   * Human message indicator.
   * Verified 2025-02: data-testid="user-message" with class font-user-message
   */
  humanMessageMarker: '[data-testid="user-message"]',

  /**
   * Assistant message indicator.
   * Verified 2025-02: class "font-claude-response"
   */
  assistantMessageMarker: '.font-claude-response',

  /**
   * The text input field (Tiptap ProseMirror contenteditable div).
   * Verified 2025-02: .tiptap.ProseMirror inside [data-testid="chat-input"]
   */
  inputField: '.tiptap.ProseMirror, [contenteditable="true"]',

  /**
   * The send button.
   * NOTE: aria-label is localized (e.g. "Nachricht senden" in German).
   * We use a broader selector to handle all locales.
   */
  sendButton: '[data-testid="chat-input"] button[type="button"]:last-of-type, button[aria-label*="send" i], button[aria-label*="senden" i]',

  /**
   * The conversation title element.
   * Verified 2025-02: [data-testid="chat-title-button"]
   */
  conversationTitle: '[data-testid="chat-title-button"]',

  /** Code blocks within assistant messages */
  codeBlock: 'pre code',

  /** LaTeX / KaTeX rendered formulas */
  renderedFormula: '.katex, .math-display',

  /**
   * The toolbar / header area for injecting custom buttons.
   * Verified 2025-02: [data-testid="page-header"] — sticky header bar
   */
  toolbar: '[data-testid="page-header"]',
} as const;

/** Selector keys type for external references */
export type SelectorKey = keyof typeof Selectors;

// ─── Observer Management ────────────────────────────────────────

interface ObserverEntry {
  observer: MutationObserver;
  target: Node;
}

/** Managed observer registry — allows cleanup on teardown */
const observers = new Map<string, ObserverEntry>();

// ─── DOMService Implementation ──────────────────────────────────

class DOMServiceImpl {
  // ─── Query helpers ──────────────────────────────────────────

  /** Query a single element by selector key. Returns null if not found. */
  query(key: SelectorKey): Element | null {
    try {
      return document.querySelector(Selectors[key]);
    } catch (err) {
      Logger.warn(TAG, `Query failed for "${key}"`, err);
      return null;
    }
  }

  /** Query all elements by selector key */
  queryAll(key: SelectorKey): Element[] {
    try {
      return Array.from(document.querySelectorAll(Selectors[key]));
    } catch (err) {
      Logger.warn(TAG, `QueryAll failed for "${key}"`, err);
      return [];
    }
  }

  /** Query by raw selector string (use sparingly — prefer selector keys) */
  queryRaw(selector: string): Element | null {
    try {
      return document.querySelector(selector);
    } catch {
      return null;
    }
  }

  /** Query all by raw selector */
  queryAllRaw(selector: string): Element[] {
    try {
      return Array.from(document.querySelectorAll(selector));
    } catch {
      return [];
    }
  }

  /**
   * Wait for an element to appear in the DOM, with retry logic.
   * Polls at intervals up to a timeout.
   */
  waitForElement(
    key: SelectorKey,
    options: { timeout?: number; interval?: number } = {},
  ): Promise<Element | null> {
    const { timeout = 10_000, interval = 200 } = options;

    return new Promise((resolve) => {
      const existing = this.query(key);
      if (existing) {
        resolve(existing);
        return;
      }

      const startTime = Date.now();
      const timer = setInterval(() => {
        const el = this.query(key);
        if (el) {
          clearInterval(timer);
          resolve(el);
          return;
        }
        if (Date.now() - startTime > timeout) {
          clearInterval(timer);
          Logger.warn(TAG, `Timeout waiting for "${key}"`);
          resolve(null);
        }
      }, interval);
    });
  }

  /**
   * Wait for an element matching a raw selector.
   */
  waitForSelector(
    selector: string,
    options: { timeout?: number; interval?: number } = {},
  ): Promise<Element | null> {
    const { timeout = 10_000, interval = 200 } = options;

    return new Promise((resolve) => {
      const existing = this.queryRaw(selector);
      if (existing) {
        resolve(existing);
        return;
      }

      const startTime = Date.now();
      const timer = setInterval(() => {
        const el = this.queryRaw(selector);
        if (el) {
          clearInterval(timer);
          resolve(el);
          return;
        }
        if (Date.now() - startTime > timeout) {
          clearInterval(timer);
          resolve(null);
        }
      }, interval);
    });
  }

  // ─── MutationObserver Management ────────────────────────────

  /**
   * Register a named MutationObserver.
   * The name allows later cleanup/replacement.
   */
  observe(
    name: string,
    target: Node,
    callback: MutationCallback,
    options: MutationObserverInit = { childList: true, subtree: true },
  ): void {
    // Clean up existing observer with this name
    this.unobserve(name);

    const observer = new MutationObserver(callback);
    observer.observe(target, options);
    observers.set(name, { observer, target });
    Logger.debug(TAG, `Observer "${name}" registered`);
  }

  /** Disconnect and remove a named observer */
  unobserve(name: string): void {
    const entry = observers.get(name);
    if (entry) {
      entry.observer.disconnect();
      observers.delete(name);
      Logger.debug(TAG, `Observer "${name}" disconnected`);
    }
  }

  /** Disconnect all registered observers (teardown) */
  disconnectAll(): void {
    for (const [name, entry] of observers) {
      entry.observer.disconnect();
      Logger.debug(TAG, `Observer "${name}" disconnected (teardown)`);
    }
    observers.clear();
  }

  // ─── Safe DOM Manipulation ──────────────────────────────────

  /** Sanitize HTML string via DOMPurify before injection */
  sanitize(html: string): string {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'div', 'span', 'p', 'a', 'button', 'input', 'label',
        'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'br', 'hr', 'strong', 'em', 'code', 'pre', 'blockquote',
        'img', 'svg', 'path',
      ],
      ALLOWED_ATTR: [
        'class', 'id', 'style', 'href', 'target', 'rel',
        'type', 'value', 'placeholder', 'title', 'aria-label',
        'data-voyager', 'data-voyager-id',
        'src', 'alt', 'width', 'height',
        'viewBox', 'fill', 'stroke', 'd', 'xmlns',
      ],
    });
  }

  /**
   * Safely inject an HTML string into a parent element.
   * The HTML is sanitized via DOMPurify before insertion.
   */
  injectHTML(parent: Element, html: string, position: InsertPosition = 'beforeend'): void {
    const clean = this.sanitize(html);
    parent.insertAdjacentHTML(position, clean);
  }

  /**
   * Create a DOM element with attributes, safely.
   * Preferred over innerHTML for building UI components.
   */
  createElement<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attrs?: Record<string, string>,
    children?: (Node | string)[],
  ): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [key, value] of Object.entries(attrs)) {
        el.setAttribute(key, value);
      }
    }
    if (children) {
      for (const child of children) {
        if (typeof child === 'string') {
          el.appendChild(document.createTextNode(child));
        } else {
          el.appendChild(child);
        }
      }
    }
    return el;
  }

  /**
   * Inject a <style> tag with scoped CSS into the document head.
   * Uses a data attribute to avoid duplicates.
   */
  injectStyles(id: string, css: string): void {
    const existing = document.querySelector(`style[data-voyager-style="${id}"]`);
    if (existing) {
      existing.textContent = css;
      return;
    }

    const style = document.createElement('style');
    style.setAttribute('data-voyager-style', id);
    style.textContent = css;
    document.head.appendChild(style);
  }

  /** Remove an injected style block */
  removeStyles(id: string): void {
    const el = document.querySelector(`style[data-voyager-style="${id}"]`);
    el?.remove();
  }

  // ─── Event Delegation ───────────────────────────────────────

  /**
   * Set up delegated event handling on a container.
   * Useful for handling clicks on dynamically injected Voyager UI elements.
   *
   * @param container - The ancestor element to listen on
   * @param selector - CSS selector for target elements
   * @param event - Event type (e.g. 'click')
   * @param handler - Callback receiving the matched element and the event
   */
  delegate<E extends Event>(
    container: Element,
    selector: string,
    event: string,
    handler: (target: Element, evt: E) => void,
  ): () => void {
    const listener = (evt: Event) => {
      const target = (evt.target as Element | null)?.closest(selector);
      if (target && container.contains(target)) {
        handler(target, evt as E);
      }
    };
    container.addEventListener(event, listener);
    // Return cleanup function
    return () => container.removeEventListener(event, listener);
  }

  // ─── Chat-specific helpers ──────────────────────────────────

  /** Get the current conversation ID from the URL */
  getConversationId(): string | null {
    const match = /\/chat\/([a-f0-9-]+)/i.exec(window.location.pathname);
    return match?.[1] ?? null;
  }

  /** Check if we are currently on a chat page */
  isChatPage(): boolean {
    return /^\/chat\/[a-f0-9-]+$/i.test(window.location.pathname);
  }

  /** Get the conversation title from the DOM */
  getConversationTitle(): string | null {
    const titleEl = this.query('conversationTitle');
    return titleEl?.textContent?.trim() ?? null;
  }

  /** Get the current user's display name from the sidebar profile area */
  getUserName(): string | null {
    // claude.ai shows the username in the profile button at the bottom of the sidebar nav.
    // The DOM typically has nested spans: one for the avatar initial (single char),
    // one for the name, and one for the plan label. But some parent spans contain
    // all children's text concatenated. We need the leaf-level span with just the name.
    const planPattern = /^(pro|free|team|enterprise|max)([\s\-]?plan)?$/i;

    const profileBtn = document.querySelector('nav button[data-testid="user-menu-button"]');
    if (profileBtn) {
      // Collect all leaf-level text elements (elements with no child elements)
      const allEls = profileBtn.querySelectorAll('*');
      const candidates: string[] = [];
      for (const el of allEls) {
        // Only leaf elements (no child elements, only text nodes)
        if (el.children.length > 0) continue;
        const text = el.textContent?.trim() ?? '';
        if (text.length <= 1) continue; // Skip avatar initial
        if (planPattern.test(text)) continue; // Skip plan labels
        candidates.push(text);
      }
      if (candidates.length > 0) return candidates[0] ?? null;

      // Fallback: parse direct text nodes of the button
      const walker = document.createTreeWalker(profileBtn, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const text = node.textContent?.trim() ?? '';
        if (text.length <= 1) continue;
        if (planPattern.test(text)) continue;
        // Could be "TimPro-Plan" concatenated — try to strip plan suffix
        const stripped = text.replace(/[\s\-]*(pro|free|team|enterprise|max)([\s\-]*plan)?$/i, '').trim();
        if (stripped.length > 0) return stripped;
      }
    }

    return null;
  }

  /**
   * Parse all visible chat messages from the DOM.
   * Returns an ordered array of ChatMessage objects.
   */
  getChatMessages(): ChatMessage[] {
    const container = this.getActiveMessageContainer();
    const blocks = container
      ? Array.from(container.querySelectorAll(Selectors.messageBlock))
      : this.queryAll('messageBlock');
    const messages: ChatMessage[] = [];

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (!block) continue;
      if (!this.isElementVisible(block)) continue;

      const role = this.detectMessageRole(block);
      if (!role) continue;

      messages.push({
        role,
        contentHtml: block.innerHTML,
        contentText: block.textContent?.trim() ?? '',
        index: messages.length,
        element: block,
      });
    }

    return messages;
  }

  private getActiveMessageContainer(): Element | null {
    const main = this.query('mainContent');
    const root = main ?? document;
    const containers = Array.from(root.querySelectorAll(Selectors.chatMessageContainer));
    if (containers.length === 0) return null;

    let best: { container: Element; score: number } | null = null;
    for (const container of containers) {
      if (!this.isElementVisible(container)) continue;
      const visibleBlocks = Array.from(container.querySelectorAll(Selectors.messageBlock))
        .filter((block) => this.isElementVisible(block));
      const score = visibleBlocks.length;
      if (!best || score > best.score) {
        best = { container, score };
      }
    }

    return best?.container ?? containers[0] ?? null;
  }

  private isElementVisible(el: Element): boolean {
    const node = el as HTMLElement;
    if (node.closest('[hidden], [aria-hidden="true"]')) return false;

    const style = window.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return false;

    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  /**
   * Detect whether a message block is human or assistant.
   * Since messageBlock selector directly matches user-message and font-claude-response,
   * the block itself carries the role information.
   */
  private detectMessageRole(block: Element): MessageRole | null {
    // Direct match: the block IS the marker element
    if (block.matches(Selectors.humanMessageMarker)) return 'human';
    if (block.matches(Selectors.assistantMessageMarker)) return 'assistant';

    // Check if the block contains a marker (for nested structures)
    if (block.querySelector(Selectors.humanMessageMarker)) return 'human';
    if (block.querySelector(Selectors.assistantMessageMarker)) return 'assistant';

    return null;
  }
}

/** Singleton DOM service */
export const DOM = new DOMServiceImpl();
