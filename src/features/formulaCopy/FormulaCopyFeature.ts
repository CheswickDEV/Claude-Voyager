/**
 * Formula Copy feature.
 *
 * Adds a copy button to rendered KaTeX/LaTeX formulas.
 * Clicking copies the original LaTeX source code to clipboard.
 */

import type { FeatureModule } from '@pages/content/index';
import type { VoyagerSettings, Locale } from '@core/types';
import { DOM } from '@core/services/DOMService';
import { Logger } from '@core/services/LoggerService';
import { debounce } from '@core/utils';
import { t } from '@i18n/index';

let locale: Locale = 'en';

const TAG = 'FormulaCopy';

const FORMULA_COPY_CSS = `
  .voyager-formula-wrap {
    position: relative;
    display: inline-block;
  }
  .voyager-formula-copy {
    position: absolute;
    top: -4px;
    right: -4px;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    background: rgba(99, 102, 241, 0.8);
    border: none;
    color: #fff;
    font-size: 11px;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 5;
  }
  .voyager-formula-wrap:hover .voyager-formula-copy {
    opacity: 1;
  }
  .voyager-formula-copy:hover {
    background: rgba(99, 102, 241, 1);
  }
  .voyager-formula-copy.voyager-copied {
    background: rgba(34, 197, 94, 0.8);
  }
  .voyager-formula-copy.voyager-copy-failed {
    background: rgba(220, 38, 38, 0.85);
  }
`;

let cleanups: (() => void)[] = [];

function markCopySuccess(copyBtn: HTMLElement): void {
  copyBtn.classList.remove('voyager-copy-failed');
  copyBtn.classList.add('voyager-copied');
  copyBtn.textContent = '\u2713';
  setTimeout(() => {
    copyBtn.classList.remove('voyager-copied');
    copyBtn.textContent = '\u{1F4CB}';
  }, 1500);
}

function markCopyFailed(copyBtn: HTMLElement): void {
  copyBtn.classList.remove('voyager-copied');
  copyBtn.classList.add('voyager-copy-failed');
  copyBtn.textContent = '!';
  setTimeout(() => {
    copyBtn.classList.remove('voyager-copy-failed');
    copyBtn.textContent = '\u{1F4CB}';
  }, 1800);
}

async function copyText(text: string): Promise<boolean> {
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

function processFormulas(): void {
  const formulas = DOM.queryAll('renderedFormula');

  for (const formula of formulas) {
    // Skip already processed
    if (formula.closest('.voyager-formula-wrap')) continue;

    // Try to find the LaTeX source from KaTeX annotation
    const annotation = formula.querySelector('annotation[encoding="application/x-tex"]');
    const latex = annotation?.textContent?.trim();
    if (!latex) continue;

    // Wrap the formula
    const wrapper = DOM.createElement('span', { class: 'voyager-formula-wrap' });
    formula.parentNode?.insertBefore(wrapper, formula);
    wrapper.appendChild(formula);

    // Add copy button
    const copyBtn = DOM.createElement('button', {
      class: 'voyager-formula-copy',
      title: t(locale).copyLatex,
      'aria-label': t(locale).copyLatexSource,
    }, ['\u{1F4CB}']);

    copyBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const copied = await copyText(latex);
      if (copied) {
        markCopySuccess(copyBtn);
      } else {
        Logger.warn(TAG, 'Failed to copy LaTeX to clipboard');
        markCopyFailed(copyBtn);
      }
    });

    wrapper.appendChild(copyBtn);
  }
}

const debouncedProcess = debounce(processFormulas, 300);

export const FormulaCopyFeature: FeatureModule = {
  key: 'formulaCopy',

  init(_settings: VoyagerSettings) {
    locale = _settings.locale ?? 'en';
    Logger.info(TAG, 'Initializing formula copy');
    DOM.injectStyles('voyager-formula', FORMULA_COPY_CSS);
    processFormulas();
  },

  destroy() {
    Logger.info(TAG, 'Destroying formula copy');
    for (const c of cleanups) c();
    cleanups = [];
    // Remove wrappers (unwrap formulas)
    const wrappers = document.querySelectorAll('.voyager-formula-wrap');
    for (const w of wrappers) {
      const formula = w.querySelector('.katex, .math-display');
      if (formula && w.parentNode) {
        w.parentNode.insertBefore(formula, w);
        w.remove();
      }
    }
    DOM.removeStyles('voyager-formula');
  },

  onMessagesChanged() {
    debouncedProcess();
  },
};
