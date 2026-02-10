/**
 * Tab Title Sync feature.
 *
 * Keeps the browser tab title in sync with the current conversation title.
 */

import type { FeatureModule } from '@pages/content/index';
import type { VoyagerSettings } from '@core/types';
import { DOM } from '@core/services/DOMService';
import { Logger } from '@core/services/LoggerService';

const TAG = 'TabTitle';
const ORIGINAL_TITLE = document.title;

let intervalId: ReturnType<typeof setInterval> | null = null;

function syncTitle(): void {
  if (!DOM.isChatPage()) return;

  const convTitle = DOM.getConversationTitle();
  if (convTitle && document.title !== convTitle) {
    document.title = convTitle;
  }
}

export const TabTitleSyncFeature: FeatureModule = {
  key: 'tabTitleSync',

  init(_settings: VoyagerSettings) {
    Logger.info(TAG, 'Initializing tab title sync');
    syncTitle();
    intervalId = setInterval(syncTitle, 1500);
  },

  destroy() {
    Logger.info(TAG, 'Destroying tab title sync');
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    document.title = ORIGINAL_TITLE;
  },

  onNavigate() {
    // Immediate sync on navigation
    setTimeout(syncTitle, 500);
  },
};
