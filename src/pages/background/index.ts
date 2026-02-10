/**
 * Background service worker.
 *
 * Responsibilities:
 * - Handle messages from popup and content scripts
 * - Manage storage operations
 * - Broadcast settings changes to content scripts
 */

import browser from 'webextension-polyfill';
import { Logger } from '@core/services/LoggerService';
import { Storage } from '@core/services/StorageService';
import { Messaging } from '@core/services/MessageService';
import type { VoyagerSettings, FeatureKey } from '@core/types';

const TAG = 'Background';

/** Broadcast settings change to all claude.ai tabs */
async function broadcastSettingsChanged(): Promise<void> {
  try {
    const tabs = await browser.tabs.query({ url: 'https://claude.ai/*' });
    for (const tab of tabs) {
      if (tab.id != null) {
        Messaging.sendToTab(tab.id, { type: 'SETTINGS_CHANGED' }).catch(() => {
          // Tab may not have content script loaded yet — ignore
        });
      }
    }
  } catch (err) {
    Logger.error(TAG, 'Failed to broadcast settings', err);
  }
}

/** Set up message handlers */
function setupHandlers(): void {
  Messaging.on('GET_SETTINGS', async () => {
    const settings = await Storage.getSettings();
    return { success: true, data: settings };
  });

  Messaging.on('UPDATE_SETTINGS', async (message) => {
    const patch = message.payload as Partial<VoyagerSettings>;
    const updated = await Storage.updateSettings(patch);
    await broadcastSettingsChanged();
    return { success: true, data: updated };
  });

  Messaging.on('FEATURE_TOGGLE', async (message) => {
    const { key, enabled } = message.payload as { key: FeatureKey; enabled: boolean };
    await Storage.updateSettingsWith((current) => ({
      ...current,
      features: { ...current.features, [key]: enabled },
    }));

    // Broadcast to content scripts
    const tabs = await browser.tabs.query({ url: 'https://claude.ai/*' });
    for (const tab of tabs) {
      if (tab.id != null) {
        Messaging.sendToTab(tab.id, {
          type: 'FEATURE_TOGGLE',
          payload: { key, enabled },
        }).catch(() => {});
      }
    }

    return { success: true };
  });

  Messaging.listen();
}

// ─── Init ───────────────────────────────────────────────────────

Logger.info(TAG, 'Claude Voyager background worker started');
setupHandlers();

// Listen for extension install/update
browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    Logger.info(TAG, 'Extension installed');
    // Initialize default settings
    Storage.getSettings().then(() => {
      Logger.info(TAG, 'Default settings initialized');
    }).catch((err) => {
      Logger.error(TAG, 'Failed to initialize default settings', err);
    });
  } else if (details.reason === 'update') {
    Logger.info(TAG, `Extension updated to v${browser.runtime.getManifest().version}`);
  }
});
