/**
 * CSS styles for the Timeline mini-map panel.
 * Uses claude.ai CSS variables for native integration.
 * Exported as a string constant for injection via DOMService.injectStyles().
 */

export const TIMELINE_CSS = `
  /* ─── Toggle Tab (right-edge drawer handle) ────────────── */
  .voyager-timeline-toggle {
    position: fixed;
    right: 0;
    top: 45%;
    transform: translateY(-50%);
    z-index: 9998;
    width: 24px;
    height: 64px;
    background-color: #2b2520;
    background-color: var(--bg-100, #2b2520);
    border: 0.5px solid var(--border-200, rgba(255, 255, 255, 0.08));
    border-right: none;
    border-radius: 8px 0 0 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s, width 0.2s;
  }

  .voyager-timeline-toggle:hover {
    background: var(--bg-200, rgba(255, 255, 255, 0.06));
    width: 28px;
  }

  .voyager-timeline-toggle-icon {
    color: var(--text-300, rgba(232, 228, 222, 0.4));
    font-size: 11px;
    line-height: 1;
    transition: transform 0.2s, color 0.2s;
    user-select: none;
  }

  .voyager-timeline-toggle:hover .voyager-timeline-toggle-icon {
    color: var(--text-100, rgba(232, 228, 222, 0.9));
  }

  .voyager-timeline-toggle.voyager-panel-open .voyager-timeline-toggle-icon {
    transform: rotate(180deg);
  }

  /* ─── Panel Container ──────────────────────────────────── */
  .voyager-timeline-panel {
    position: fixed;
    right: 0;
    top: 45%;
    transform: translateY(-50%) translateX(100%);
    z-index: 9999;
    width: 260px;
    max-height: 60vh;
    background-color: #2b2520;
    background-color: var(--bg-100, #2b2520);
    border: 0.5px solid var(--border-200, rgba(255, 255, 255, 0.1));
    border-right: none;
    border-radius: 12px 0 0 12px;
    backdrop-filter: blur(16px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    opacity: 0;
    transition: transform 0.25s ease, opacity 0.25s ease;
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.4);
  }

  .voyager-timeline-panel.voyager-panel-visible {
    transform: translateY(-50%) translateX(0);
    max-height: 70vh;
    opacity: 1;
  }

  /* ─── Panel Header ─────────────────────────────────────── */
  .voyager-timeline-header {
    padding: 10px 14px 8px;
    border-bottom: 0.5px solid var(--border-100, rgba(255, 255, 255, 0.06));
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }

  .voyager-timeline-title {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-300, rgba(232, 228, 222, 0.4));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .voyager-timeline-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .voyager-timeline-count {
    font-size: 10px;
    color: var(--text-300, rgba(232, 228, 222, 0.35));
    font-variant-numeric: tabular-nums;
  }

  .voyager-timeline-close {
    background: none;
    border: none;
    color: var(--text-300, rgba(232, 228, 222, 0.4));
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    padding: 2px 4px;
    border-radius: 4px;
    transition: color 0.15s, background 0.15s;
  }

  .voyager-timeline-close:hover {
    color: var(--text-100, rgba(232, 228, 222, 0.9));
    background: var(--bg-200, rgba(255, 255, 255, 0.08));
  }

  /* ─── Message List (scrollable) ────────────────────────── */
  .voyager-timeline-list {
    overflow-y: auto;
    overflow-x: hidden;
    flex: 1;
    padding: 4px 0;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
  }

  .voyager-timeline-list::-webkit-scrollbar {
    width: 4px;
  }

  .voyager-timeline-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .voyager-timeline-list::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
  }

  /* ─── Message Row ──────────────────────────────────────── */
  .voyager-timeline-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 6px 14px;
    cursor: pointer;
    transition: background 0.12s;
    border-left: 2px solid transparent;
    min-height: 32px;
  }

  .voyager-timeline-row:hover {
    background: var(--bg-200, rgba(255, 255, 255, 0.04));
  }

  /* Human message rows */
  .voyager-row-human {
    background: transparent;
  }

  .voyager-row-human:hover {
    background: var(--bg-200, rgba(255, 255, 255, 0.06));
  }

  /* Assistant message rows */
  .voyager-row-assistant {
    background: transparent;
  }

  .voyager-row-assistant:hover {
    background: var(--bg-200, rgba(255, 255, 255, 0.06));
  }

  /* Active (currently visible) row */
  .voyager-row-active {
    border-left-color: var(--accent-main, rgba(217, 170, 90, 0.5));
    background: rgba(217, 170, 90, 0.08) !important;
  }

  .voyager-row-active:hover {
    background: rgba(217, 170, 90, 0.12) !important;
  }

  /* ─── Row Components ───────────────────────────────────── */
  .voyager-row-number {
    font-size: 9px;
    color: var(--text-300, rgba(232, 228, 222, 0.25));
    min-width: 16px;
    text-align: right;
    padding-top: 2px;
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
    line-height: 1.4;
  }

  .voyager-row-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .voyager-row-role {
    font-size: 10px;
    font-weight: 600;
    line-height: 1.3;
    flex-shrink: 0;
  }

  .voyager-role-human {
    color: var(--text-200, rgba(232, 228, 222, 0.7));
  }

  .voyager-role-assistant {
    color: var(--accent-main, rgba(217, 170, 90, 0.7));
  }

  .voyager-row-preview {
    font-size: 11px;
    color: var(--text-300, rgba(232, 228, 222, 0.4));
    line-height: 1.35;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }

  .voyager-row-active .voyager-row-preview {
    color: var(--text-200, rgba(232, 228, 222, 0.6));
  }

  .voyager-row-active .voyager-row-role {
    color: var(--text-100, rgba(232, 228, 222, 0.9));
  }

  .voyager-row-active .voyager-role-assistant {
    color: var(--accent-main, rgba(217, 170, 90, 0.9));
  }

  /* ─── Star Indicator ───────────────────────────────────── */
  .voyager-row-star {
    flex-shrink: 0;
    padding-top: 2px;
  }

  .voyager-star-icon {
    font-size: 10px;
    line-height: 1;
  }

  .voyager-star-level-1 {
    color: var(--accent-main, rgba(217, 170, 90, 0.7));
  }

  .voyager-star-level-2 {
    color: rgba(230, 150, 60, 0.8);
  }

  .voyager-star-level-3 {
    color: rgba(220, 90, 70, 0.85);
  }

  /* ─── Starred row accent ───────────────────────────────── */
  .voyager-row-starred {
    border-left-color: rgba(217, 170, 90, 0.3);
  }

  .voyager-row-starred.voyager-row-level-2 {
    border-left-color: rgba(230, 150, 60, 0.4);
  }

  .voyager-row-starred.voyager-row-level-3 {
    border-left-color: rgba(220, 90, 70, 0.4);
  }

  /* Active overrides starred border */
  .voyager-row-active.voyager-row-starred {
    border-left-color: var(--accent-main, rgba(217, 170, 90, 0.6));
  }

  /* ─── Context Menu ─────────────────────────────────────── */
  .voyager-timeline-context {
    position: fixed;
    z-index: 50001;
    min-width: 130px;
    padding: 4px;
    background-color: #2b2520;
    background-color: var(--bg-100, #2b2520);
    border: 0.5px solid var(--border-200, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(16px);
  }

  .voyager-ctx-item {
    padding: 7px 12px;
    font-size: 12px;
    color: var(--text-200, rgba(232, 228, 222, 0.75));
    cursor: pointer;
    border-radius: 8px;
    transition: background 0.1s;
  }

  .voyager-ctx-item:hover {
    background: var(--bg-200, rgba(255, 255, 255, 0.06));
    color: var(--text-100, rgba(232, 228, 222, 0.95));
  }

  .voyager-ctx-unstar {
    border-top: 0.5px solid var(--border-100, rgba(255, 255, 255, 0.06));
    color: rgba(220, 90, 70, 0.8);
  }

  .voyager-ctx-unstar:hover {
    background: rgba(220, 90, 70, 0.1);
    color: rgba(220, 90, 70, 1);
  }

  /* ─── Utility ──────────────────────────────────────────── */
  .voyager-hidden {
    display: none !important;
  }
`;
