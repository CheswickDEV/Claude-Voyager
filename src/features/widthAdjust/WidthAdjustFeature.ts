/**
 * Adjustable Chat Width feature.
 *
 * Applies a custom max-width to the chat container based on user settings.
 * The width is configured via the popup settings slider.
 */

import type { FeatureModule } from '@pages/content/index';
import type { VoyagerSettings } from '@core/types';
import { DOM, Selectors } from '@core/services/DOMService';
import { Logger } from '@core/services/LoggerService';
import browser from 'webextension-polyfill';

const TAG = 'WidthAdjust';
const STYLE_ID = 'voyager-width';

let storageListener: ((changes: Record<string, browser.Storage.StorageChange>) => void) | null = null;

function applyWidth(width: number): void {
  const css = `
    /* Voyager: Override chat container max-width */
    ${Selectors.chatMessageContainer} {
      max-width: ${width}px !important;
    }
    /* Also target common Tailwind max-width containers in the chat area */
    .max-w-3xl, .max-w-4xl, .max-w-2xl {
      max-width: ${width}px !important;
    }
  `;
  DOM.injectStyles(STYLE_ID, css);
  Logger.debug(TAG, `Chat width set to ${width}px`);
}

export const WidthAdjustFeature: FeatureModule = {
  key: 'widthAdjust',

  init(settings: VoyagerSettings) {
    Logger.info(TAG, 'Initializing width adjust');
    applyWidth(settings.chatWidth);

    // Listen for storage changes to update width live when slider moves
    storageListener = (changes: Record<string, browser.Storage.StorageChange>) => {
      if (changes['voyager_settings']?.newValue) {
        const newSettings = changes['voyager_settings'].newValue as VoyagerSettings;
        if (newSettings.chatWidth) {
          applyWidth(newSettings.chatWidth);
        }
      }
    };
    browser.storage.onChanged.addListener(storageListener);
  },

  destroy() {
    Logger.info(TAG, 'Destroying width adjust');
    DOM.removeStyles(STYLE_ID);
    if (storageListener) {
      browser.storage.onChanged.removeListener(storageListener);
      storageListener = null;
    }
  },
};
