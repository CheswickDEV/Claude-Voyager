/**
 * CSS styles for the Prompt Library feature.
 * Uses claude.ai CSS variables for native integration.
 */

export const PROMPT_CSS = `
  /* ─── Native Toolbar Trigger Button ──────────────────── */
  .voyager-prompt-trigger-native {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: var(--text-300, rgba(232, 228, 222, 0.5));
    cursor: pointer;
    padding: 0;
    transition: color 0.15s, background 0.15s;
    position: relative;
    flex-shrink: 0;
  }

  .voyager-prompt-trigger-native:hover {
    color: var(--text-100, rgba(232, 228, 222, 0.95));
    background: var(--bg-300, rgba(255, 255, 255, 0.06));
  }

  .voyager-prompt-trigger-native svg {
    width: 18px;
    height: 18px;
  }

  /* ─── Floating Trigger Fallback ────────────────────────── */
  .voyager-prompt-trigger {
    position: fixed;
    bottom: 100px;
    right: 60px;
    z-index: 9998;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background-color: #2b2520;
    background-color: var(--bg-100, #2b2520);
    border: 0.5px solid var(--border-200, rgba(255, 255, 255, 0.1));
    color: var(--text-300, rgba(232, 228, 222, 0.4));
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transition: transform 0.15s, background 0.15s, color 0.15s;
  }

  .voyager-prompt-trigger:hover {
    transform: scale(1.1);
    background: var(--bg-200, rgba(255, 255, 255, 0.06));
    color: var(--text-100, rgba(232, 228, 222, 0.95));
  }

  /* ─── Prompt Panel ────────────────────────────────────── */
  .voyager-prompt-panel {
    position: fixed;
    bottom: 145px;
    right: 60px;
    z-index: 50000;
    width: 340px;
    max-height: 450px;
    background-color: #2b2520;
    background-color: var(--bg-100, #2b2520);
    border: 0.5px solid var(--border-200, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(16px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .voyager-prompt-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px 10px;
    border-bottom: 0.5px solid var(--border-100, rgba(255, 255, 255, 0.06));
  }

  .voyager-prompt-panel-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-100, rgba(232, 228, 222, 0.9));
  }

  .voyager-prompt-panel-actions {
    display: flex;
    gap: 2px;
  }

  .voyager-prompt-panel-btn {
    background: none;
    border: none;
    color: var(--text-300, rgba(232, 228, 222, 0.4));
    cursor: pointer;
    font-size: 14px;
    padding: 4px 6px;
    border-radius: 6px;
    line-height: 1;
    transition: color 0.1s, background 0.1s;
  }

  .voyager-prompt-panel-btn:hover {
    color: var(--text-100, rgba(232, 228, 222, 0.9));
    background: var(--bg-200, rgba(255, 255, 255, 0.06));
  }

  /* ─── Search ──────────────────────────────────────────── */
  .voyager-prompt-search {
    padding: 8px 12px;
    border-bottom: 0.5px solid var(--border-100, rgba(255, 255, 255, 0.04));
  }

  .voyager-prompt-search input {
    width: 100%;
    padding: 6px 10px;
    border: 0.5px solid var(--border-200, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    background: var(--bg-000, rgba(20, 18, 15, 0.8));
    color: var(--text-100, rgba(232, 228, 222, 0.9));
    font-size: 12px;
    outline: none;
    transition: border-color 0.15s;
  }

  .voyager-prompt-search input:focus {
    border-color: var(--accent-main, rgba(217, 170, 90, 0.5));
  }

  .voyager-prompt-search input::placeholder {
    color: var(--text-300, rgba(232, 228, 222, 0.3));
  }

  /* ─── Prompt List ─────────────────────────────────────── */
  .voyager-prompt-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.08) transparent;
  }

  .voyager-prompt-item {
    display: flex;
    flex-direction: column;
    padding: 8px 10px;
    cursor: pointer;
    transition: background 0.1s;
    border-radius: 8px;
    margin: 1px 0;
  }

  .voyager-prompt-item:hover {
    background: var(--bg-200, rgba(255, 255, 255, 0.06));
  }

  .voyager-prompt-item-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-200, rgba(232, 228, 222, 0.75));
    margin-bottom: 2px;
  }

  .voyager-prompt-item:hover .voyager-prompt-item-title {
    color: var(--text-100, rgba(232, 228, 222, 0.95));
  }

  .voyager-prompt-item-preview {
    font-size: 11px;
    color: var(--text-300, rgba(232, 228, 222, 0.4));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .voyager-prompt-item-tags {
    display: flex;
    gap: 4px;
    margin-top: 4px;
    flex-wrap: wrap;
  }

  .voyager-prompt-tag {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 8px;
    background: rgba(217, 170, 90, 0.1);
    color: var(--accent-main, rgba(217, 170, 90, 0.7));
  }

  .voyager-prompt-item-actions {
    display: flex;
    gap: 4px;
    margin-top: 4px;
  }

  .voyager-prompt-item-btn {
    background: none;
    border: none;
    font-size: 11px;
    color: var(--text-300, rgba(232, 228, 222, 0.4));
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 6px;
    transition: color 0.1s, background 0.1s;
  }

  .voyager-prompt-item-btn:hover {
    color: var(--text-100, rgba(232, 228, 222, 0.9));
    background: var(--bg-200, rgba(255, 255, 255, 0.06));
  }

  .voyager-prompt-item-btn.voyager-delete-btn:hover {
    color: rgba(220, 90, 70, 0.9);
    background: rgba(220, 90, 70, 0.1);
  }

  /* ─── Add Form ────────────────────────────────────────── */
  .voyager-prompt-form {
    padding: 10px 12px;
    border-top: 0.5px solid var(--border-100, rgba(255, 255, 255, 0.06));
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .voyager-prompt-form input,
  .voyager-prompt-form textarea {
    width: 100%;
    padding: 6px 8px;
    border: 0.5px solid var(--border-200, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    background: var(--bg-000, rgba(20, 18, 15, 0.8));
    color: var(--text-100, rgba(232, 228, 222, 0.9));
    font-size: 12px;
    outline: none;
    font-family: inherit;
  }

  .voyager-prompt-form input:focus,
  .voyager-prompt-form textarea:focus {
    border-color: var(--accent-main, rgba(217, 170, 90, 0.5));
  }

  .voyager-prompt-form textarea {
    min-height: 60px;
    resize: vertical;
  }

  .voyager-prompt-form-btns {
    display: flex;
    gap: 6px;
    justify-content: flex-end;
  }

  .voyager-prompt-form-save {
    padding: 4px 12px;
    border: none;
    border-radius: 6px;
    background: var(--accent-main, rgba(217, 170, 90, 0.7));
    color: #1a1612;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }

  .voyager-prompt-form-save:hover {
    background: var(--accent-main, rgba(217, 170, 90, 0.9));
  }

  .voyager-prompt-form-cancel {
    padding: 4px 12px;
    border: 0.5px solid var(--border-200, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    background: transparent;
    color: var(--text-300, rgba(232, 228, 222, 0.5));
    font-size: 12px;
    cursor: pointer;
    transition: color 0.1s, background 0.1s;
  }

  .voyager-prompt-form-cancel:hover {
    color: var(--text-100, rgba(232, 228, 222, 0.9));
    background: var(--bg-200, rgba(255, 255, 255, 0.06));
  }

  /* ─── Empty ───────────────────────────────────────────── */
  .voyager-prompt-empty {
    text-align: center;
    padding: 24px 12px;
    color: var(--text-300, rgba(232, 228, 222, 0.3));
    font-size: 12px;
  }
`;
