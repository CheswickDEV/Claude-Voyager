/**
 * CSS styles for the Folder Organization feature.
 * The toggle button is a native sidebar item (uses claude.ai's own classes).
 * The panel uses claude.ai's CSS variables for native look.
 */

export const FOLDER_CSS = `
  /* Active state for the native sidebar item */
  .voyager-folder-nav-active {
    background: var(--bg-300, rgba(255, 255, 255, 0.06)) !important;
  }

  /* Native tooltip rechts neben dem Icon (nur im eingeklappten Zustand) */
  .voyager-folder-native-tooltip {
    position: fixed;
    left: var(--voyager-folder-tooltip-left, 0px);
    top: var(--voyager-folder-tooltip-top, 0px);
    transform: translateY(-50%) scale(0.96);
    opacity: 0;
    pointer-events: none;
    z-index: 70000;
    padding: 5px 10px;
    border-radius: 8px;
    background: #000;
    color: #fff;
    font-size: 12px;
    font-weight: 400;
    line-height: 1.25;
    white-space: nowrap;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55);
    transition:
      opacity 120ms cubic-bezier(0.165, 0.85, 0.45, 1),
      transform 120ms cubic-bezier(0.165, 0.85, 0.45, 1);
  }

  .voyager-folder-native-tooltip.voyager-folder-native-tooltip-open {
    opacity: 1;
    transform: translateY(-50%) scale(1);
  }

  /* Folder panel - matches claude.ai popover style */
  .voyager-folder-panel {
    position: fixed;
    top: 100px;
    left: 260px;
    z-index: 50000;
    width: 300px;
    min-height: 120px;
    max-height: 70vh;
    overflow-y: auto;
    background-color: #2b2520;
    background-color: var(--bg-100, #2b2520);
    border: 0.5px solid var(--border-200, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.55);
    padding: 0;
    font-size: 13px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.08) transparent;
    backdrop-filter: blur(16px);
  }

  /* Header */
  .voyager-folder-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px 10px;
    border-bottom: 0.5px solid var(--border-100, rgba(255, 255, 255, 0.06));
  }

  .voyager-folder-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-100, rgba(232, 228, 222, 0.9));
  }

  .voyager-folder-actions {
    display: flex;
    gap: 2px;
  }

  .voyager-folder-btn {
    background: none;
    border: none;
    color: var(--text-300, rgba(232, 228, 222, 0.4));
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 6px;
    font-size: 14px;
    line-height: 1;
    transition: color 0.1s, background 0.1s;
  }

  .voyager-folder-btn:hover {
    color: var(--text-100, rgba(232, 228, 222, 0.9));
    background: var(--bg-200, rgba(255, 255, 255, 0.06));
  }

  /* Folder list */
  .voyager-folder-list {
    padding: 4px;
  }

  .voyager-folder {
    margin: 1px 0;
  }

  .voyager-folder-row {
    display: flex;
    align-items: center;
    padding: 7px 10px;
    cursor: pointer;
    border-radius: 8px;
    gap: 8px;
    user-select: none;
    transition: background 0.1s;
    color: var(--text-200, rgba(232, 228, 222, 0.75));
  }

  .voyager-folder-row:hover {
    background: var(--bg-200, rgba(255, 255, 255, 0.06));
    color: var(--text-100, rgba(232, 228, 222, 0.95));
  }

  .voyager-folder-row.voyager-folder-selected {
    background: var(--bg-300, rgba(255, 255, 255, 0.1));
  }

  .voyager-folder-icon {
    font-size: 11px;
    flex-shrink: 0;
    width: 16px;
    text-align: center;
    color: var(--text-300, rgba(232, 228, 222, 0.4));
    transition: transform 0.15s;
  }

  .voyager-folder-icon.voyager-folder-open {
    transform: rotate(90deg);
  }

  .voyager-folder-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
  }

  .voyager-folder-name-input {
    flex: 1;
    background: var(--bg-000, rgba(20, 18, 15, 0.8));
    border: 0.5px solid var(--border-200, rgba(255, 255, 255, 0.15));
    border-radius: 6px;
    color: var(--text-100, rgba(232, 228, 222, 0.9));
    font-size: 13px;
    padding: 3px 8px;
    outline: none;
  }

  .voyager-folder-name-input:focus {
    border-color: var(--accent-main, rgba(217, 170, 90, 0.5));
  }

  .voyager-folder-count {
    font-size: 11px;
    color: var(--text-300, rgba(232, 228, 222, 0.35));
    flex-shrink: 0;
  }

  /* Subfolder / conversations */
  .voyager-folder-children {
    padding-left: 16px;
  }

  .voyager-folder-conv {
    display: flex;
    align-items: center;
    padding: 5px 10px;
    font-size: 12px;
    color: var(--text-300, rgba(232, 228, 222, 0.55));
    border-radius: 6px;
    cursor: pointer;
    gap: 8px;
    transition: background 0.1s;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .voyager-folder-conv:hover {
    background: var(--bg-200, rgba(255, 255, 255, 0.06));
    color: var(--text-100, rgba(232, 228, 222, 0.9));
  }

  .voyager-folder-conv-icon {
    font-size: 10px;
    opacity: 0.5;
    flex-shrink: 0;
  }

  /* Resize handle */
  .voyager-folder-resize {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 6px;
    cursor: ns-resize;
    border-radius: 0 0 12px 12px;
    background: transparent;
    transition: background 0.15s;
  }

  .voyager-folder-resize:hover,
  .voyager-folder-resize.voyager-resizing {
    background: var(--accent-main, rgba(217, 170, 90, 0.2));
  }

  /* Drag and drop */
  .voyager-folder-drop-target {
    outline: 1.5px dashed var(--accent-main, rgba(217, 170, 90, 0.5));
    outline-offset: -2px;
    background: rgba(217, 170, 90, 0.04);
  }

  .voyager-folder-dragging {
    opacity: 0.5;
  }

  /* Empty state */
  .voyager-folder-empty {
    text-align: center;
    padding: 24px 16px;
    color: var(--text-300, rgba(232, 228, 222, 0.3));
    font-size: 13px;
  }

  /* Delete button (hidden by default, visible on hover) */
  .voyager-folder-del {
    display: none;
    background: none;
    border: none;
    color: var(--text-300, rgba(232, 228, 222, 0.3));
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 4px;
    font-size: 11px;
    line-height: 1;
    flex-shrink: 0;
    transition: color 0.1s, background 0.1s;
    margin-left: auto;
  }

  .voyager-folder-row:hover .voyager-folder-del {
    display: inline-flex;
  }

  .voyager-folder-del:hover {
    color: rgba(220, 90, 70, 0.9);
    background: rgba(220, 90, 70, 0.1);
  }

  /* Folder reorder drop indicator */
  .voyager-folder-reorder-target {
    outline: 1.5px solid var(--accent-main, rgba(217, 170, 90, 0.6));
    outline-offset: -1px;
    background: rgba(217, 170, 90, 0.06);
  }

  /* Drag reorder indicator line between folders */
  .voyager-folder-reorder-line {
    height: 2px;
    background: var(--accent-main, rgba(217, 170, 90, 0.7));
    border-radius: 1px;
    margin: 0 8px;
    pointer-events: none;
  }

  .voyager-folder-row[draggable="true"] {
    cursor: grab;
  }

  .voyager-folder-row[draggable="true"]:active {
    cursor: grabbing;
  }

  .voyager-folder-row.voyager-folder-dragging-row {
    opacity: 0.4;
  }
`;

