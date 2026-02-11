/**
 * Chat Export feature module.
 *
 * Injects a native-looking "Export" button next to the "Teilen" button
 * in the page header, matching claude.ai's Button_secondary style.
 * Supports export as:
 * - Structured JSON (full conversation data)
 * - Markdown (clean formatting)
 * - PDF (via Blob URL print approach — Firefox compatible)
 */

import type { FeatureModule } from '@pages/content/index';
import type { VoyagerSettings, ChatMessage, Locale } from '@core/types';
import { DOM } from '@core/services/DOMService';
import { Logger } from '@core/services/LoggerService';
import { t } from '@i18n/index';

let locale: Locale = 'en';

const TAG = 'Export';

// Native claude.ai button classes (from the "Teilen" button)
const NATIVE_BTN_CLASSES = [
  'inline-flex', 'items-center', 'justify-center', 'relative', 'shrink-0',
  'can-focus', 'select-none',
  'disabled:pointer-events-none', 'disabled:opacity-50',
  'disabled:shadow-none', 'disabled:drop-shadow-none',
  'font-base-bold', 'border-0.5', 'relative', 'overflow-hidden',
  'transition', 'duration-100', 'backface-hidden',
  'h-8', 'rounded-md', 'px-3', 'min-w-[4rem]',
  'active:scale-[0.985]', 'whitespace-nowrap', '!text-xs',
  'Button_secondary__Teecd',
].join(' ');

const EXPORT_CSS = `
  .voyager-export-menu {
    position: fixed;
    z-index: 10001;
    min-width: 200px;
    background: var(--bg-100, #2a2520);
    border: 0.5px solid var(--border-200, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
    padding: 4px;
    backdrop-filter: blur(12px);
  }

  .voyager-export-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-200, rgba(232, 228, 222, 0.75));
    border-radius: 8px;
    transition: background 0.1s;
  }

  .voyager-export-item:hover {
    background: var(--bg-200, rgba(255, 255, 255, 0.06));
    color: var(--text-100, rgba(232, 228, 222, 0.95));
  }

  .voyager-export-item-icon {
    font-size: 15px;
    width: 20px;
    text-align: center;
    flex-shrink: 0;
  }

  .voyager-export-item-label {
    flex: 1;
  }
`;

interface ExportState {
  button: HTMLElement | null;
  menu: HTMLElement | null;
  cleanups: (() => void)[];
}

function createState(): ExportState {
  return { button: null, menu: null, cleanups: [] };
}

let state: ExportState = createState();

// ─── Rendering ──────────────────────────────────────────────────

/** Find the actions container in the page header and inject our button */
function renderButton(): void {
  removeUI();

  if (!DOM.isChatPage()) return;

  // Find the actions container (where Teilen/Share button lives)
  const actionsContainer = document.querySelector('[data-testid="wiggle-controls-actions"]');
  if (!actionsContainer) {
    // Retry if not found yet
    setTimeout(() => {
      if (!state.button) renderButton();
    }, 500);
    return;
  }

  // Create a native-looking button matching the "Teilen" style
  const btn = document.createElement('button');
  btn.className = NATIVE_BTN_CLASSES;
  btn.type = 'button';
  btn.setAttribute('data-voyager', 'export-btn');
  btn.textContent = t(locale).exportBtn;

  btn.addEventListener('click', toggleMenu);
  state.cleanups.push(() => btn.removeEventListener('click', toggleMenu));

  // Insert before the first child of the actions container (before the sidebar toggle)
  actionsContainer.insertBefore(btn, actionsContainer.firstChild);
  state.button = btn;
}

function toggleMenu(): void {
  if (state.menu) {
    removeMenu();
    return;
  }

  const menu = document.createElement('div');
  menu.className = 'voyager-export-menu';
  menu.setAttribute('data-voyager', 'export-menu');

  // Position menu below the export button
  if (state.button) {
    const btnRect = state.button.getBoundingClientRect();
    menu.style.top = `${btnRect.bottom + 6}px`;
    menu.style.right = `${window.innerWidth - btnRect.right}px`;
  }

  const options: Array<{ icon: string; label: string; handler: () => void }> = [
    { icon: '{ }', label: t(locale).exportAsJson, handler: exportJSON },
    { icon: '#', label: t(locale).exportAsMarkdown, handler: exportMarkdown },
    { icon: '\u{1F5B6}', label: t(locale).exportAsPdf, handler: exportPDF },
  ];

  for (const opt of options) {
    const item = document.createElement('div');
    item.className = 'voyager-export-item';

    const icon = document.createElement('span');
    icon.className = 'voyager-export-item-icon';
    icon.textContent = opt.icon;

    const label = document.createElement('span');
    label.className = 'voyager-export-item-label';
    label.textContent = opt.label;

    item.append(icon, label);
    item.addEventListener('click', () => {
      opt.handler();
      removeMenu();
    });
    menu.appendChild(item);
  }

  document.body.appendChild(menu);
  state.menu = menu;

  // Close on outside click
  const outsideClick = (e: Event) => {
    if (!state.menu?.contains(e.target as Node) && e.target !== state.button) {
      removeMenu();
      document.removeEventListener('click', outsideClick);
    }
  };
  setTimeout(() => document.addEventListener('click', outsideClick), 0);
  state.cleanups.push(() => document.removeEventListener('click', outsideClick));
}

function removeMenu(): void {
  state.menu?.remove();
  state.menu = null;
}

// ─── Export Functions ───────────────────────────────────────────

function getConversationData(): { title: string; id: string; messages: ChatMessage[] } {
  const messages = DOM.getChatMessages();
  const title = DOM.getConversationTitle() ?? t(locale).untitledConversation;
  const id = DOM.getConversationId() ?? 'unknown';
  return { title, id, messages };
}

function exportJSON(): void {
  const data = getConversationData();

  const exportObj = {
    title: data.title,
    conversationId: data.id,
    exportedAt: new Date().toISOString(),
    messageCount: data.messages.length,
    messages: data.messages.map((m) => ({
      role: m.role,
      content: m.contentText,
      index: m.index,
    })),
  };

  downloadFile(
    JSON.stringify(exportObj, null, 2),
    `${sanitizeFilename(data.title)}.json`,
    'application/json',
  );
  Logger.info(TAG, `Exported ${data.messages.length} messages as JSON`);
}

function exportMarkdown(): void {
  const data = getConversationData();

  let md = `# ${data.title}\n\n`;
  md += `*Exported on ${new Date().toLocaleString()}*\n\n---\n\n`;

  for (const msg of data.messages) {
    const label = msg.role === 'human' ? `**${t(locale).you}:**` : `**${t(locale).claudeRole}:**`;
    md += `${label}\n\n${msg.contentText}\n\n---\n\n`;
  }

  downloadFile(
    md,
    `${sanitizeFilename(data.title)}.md`,
    'text/markdown',
  );
  Logger.info(TAG, `Exported ${data.messages.length} messages as Markdown`);
}

function exportPDF(): void {
  const data = getConversationData();

  let html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>${escapeHtml(data.title)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; }
  h1 { font-size: 24px; border-bottom: 2px solid #6366f1; padding-bottom: 8px; }
  .meta { color: #888; font-size: 12px; margin-bottom: 20px; }
  .message { margin: 16px 0; padding: 12px; border-radius: 8px; }
  .human { background: #f0f0f5; }
  .assistant { background: #f5f0ff; }
  .role { font-weight: 700; font-size: 13px; margin-bottom: 6px; color: #6366f1; }
  .content { white-space: pre-wrap; font-size: 14px; line-height: 1.6; }
  pre { background: #f5f5f5; padding: 12px; border-radius: 6px; overflow-x: auto; }
  code { font-family: 'SF Mono', Consolas, monospace; font-size: 13px; }
</style></head><body>`;

  html += `<h1>${escapeHtml(data.title)}</h1>`;
  html += `<div class="meta">Exported on ${new Date().toLocaleString()} | ${data.messages.length} messages</div>`;

  for (const msg of data.messages) {
    const roleLabel = msg.role === 'human' ? t(locale).you : t(locale).claudeRole;
    html += `<div class="message ${msg.role}">`;
    html += `<div class="role">${roleLabel}</div>`;
    html += `<div class="content">${escapeHtml(msg.contentText)}</div>`;
    html += `</div>`;
  }

  html += `<script>window.onload = function() { window.print(); };<\/script>`;
  html += `</body></html>`;

  // Use Blob URL instead of window.open('', '_blank') — Firefox compatible
  const blob = new Blob([html], { type: 'text/html' });
  const blobUrl = URL.createObjectURL(blob);
  const printWindow = window.open(blobUrl, '_blank');

  if (!printWindow) {
    Logger.warn(TAG, 'Could not open print window — popup may be blocked');
    // Fallback: download as HTML file for manual printing
    downloadFile(html, `${sanitizeFilename(data.title)}.html`, 'text/html');
    Logger.info(TAG, 'Fallback: downloaded HTML file for manual printing');
  }

  // Clean up blob URL after a delay
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);

  Logger.info(TAG, 'Opened print dialog for PDF export');
}

// ─── Helpers ────────────────────────────────────────────────────

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9\-_ ]/g, '').trim().slice(0, 60) || 'conversation';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Cleanup ────────────────────────────────────────────────────

function removeUI(): void {
  for (const cleanup of state.cleanups) cleanup();
  state.cleanups = [];
  removeMenu();
  state.button?.remove();
  state.button = null;
}

// ─── Feature Module Export ──────────────────────────────────────

export const ExportFeature: FeatureModule = {
  key: 'export',

  init(_settings: VoyagerSettings) {
    Logger.info(TAG, 'Initializing export feature');
    locale = _settings.locale ?? 'en';
    state = createState();
    DOM.injectStyles('voyager-export', EXPORT_CSS);
    renderButton();
  },

  destroy() {
    Logger.info(TAG, 'Destroying export feature');
    removeUI();
    DOM.removeStyles('voyager-export');
    state = createState();
  },

  onNavigate() {
    renderButton();
  },
};
