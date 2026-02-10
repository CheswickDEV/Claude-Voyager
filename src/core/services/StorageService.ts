/**
 * Central persistence layer using browser.storage APIs.
 * Provides typed get/set operations and schema migration support.
 */

import browser from 'webextension-polyfill';
import { Logger } from './LoggerService';
import {
  type VoyagerSettings,
  type FeatureToggles,
  type Folder,
  type SavedPrompt,
  type StarredMessage,
  DEFAULT_SETTINGS,
  CURRENT_SCHEMA_VERSION,
  STORAGE_KEYS,
} from '@core/types';

const TAG = 'Storage';

/** Migration function signature */
type MigrationFn = (data: Record<string, unknown>) => Record<string, unknown>;

/** Registry of migrations indexed by target schema version */
const migrations: Record<number, MigrationFn> = {
  // Example: version 2 migration would go here
  // 2: (data) => { ... return data; }
};

class StorageServiceImpl {
  private settingsUpdateQueue: Promise<void> = Promise.resolve();

  private runSerializedSettingsUpdate<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.settingsUpdateQueue.then(operation, operation);
    this.settingsUpdateQueue = run.then(() => undefined, () => undefined);
    return run;
  }

  // ─── Generic helpers ──────────────────────────────────────────

  /** Read a typed value from local storage */
  async getLocal<T>(key: string, fallback: T): Promise<T> {
    try {
      const result = await browser.storage.local.get(key);
      const value = result[key] as T | undefined;
      return value ?? fallback;
    } catch (err) {
      Logger.error(TAG, `Failed to read key "${key}"`, err);
      return fallback;
    }
  }

  /** Write a typed value to local storage */
  async setLocal<T>(key: string, value: T): Promise<void> {
    try {
      await browser.storage.local.set({ [key]: value });
    } catch (err) {
      Logger.error(TAG, `Failed to write key "${key}"`, err);
      throw err;
    }
  }

  /** Read a typed value from sync storage */
  async getSync<T>(key: string, fallback: T): Promise<T> {
    try {
      const result = await browser.storage.sync.get(key);
      const value = result[key] as T | undefined;
      return value ?? fallback;
    } catch (err) {
      Logger.warn(TAG, `Sync storage read failed for "${key}", using fallback`, err);
      return fallback;
    }
  }

  /** Write a typed value to sync storage */
  async setSync<T>(key: string, value: T): Promise<void> {
    try {
      await browser.storage.sync.set({ [key]: value });
    } catch (err) {
      Logger.error(TAG, `Sync storage write failed for "${key}"`, err);
    }
  }

  /** Remove a key from local storage */
  async removeLocal(key: string): Promise<void> {
    try {
      await browser.storage.local.remove(key);
    } catch (err) {
      Logger.error(TAG, `Failed to remove key "${key}"`, err);
      throw err;
    }
  }

  // ─── Settings ─────────────────────────────────────────────────

  /** Load extension settings, applying migrations if needed */
  async getSettings(): Promise<VoyagerSettings> {
    const settings = await this.getLocal<VoyagerSettings>(
      STORAGE_KEYS.SETTINGS,
      DEFAULT_SETTINGS,
    );
    const migrated = await this.migrateIfNeeded(settings);
    const normalized = this.normalizeSettings(migrated);

    if (!this.settingsEqual(migrated, normalized)) {
      await this.setSettings(normalized);
    }

    return normalized;
  }

  /** Persist extension settings */
  async setSettings(settings: VoyagerSettings): Promise<void> {
    await this.setLocal(STORAGE_KEYS.SETTINGS, settings);
    // Also sync a subset for cross-device consistency
    await this.setSync(STORAGE_KEYS.SETTINGS, {
      locale: settings.locale,
      features: settings.features,
      chatWidth: settings.chatWidth,
    });
  }

  /** Update a single settings field */
  async updateSettings(patch: Partial<VoyagerSettings>): Promise<VoyagerSettings> {
    return this.updateSettingsWith((current) => ({ ...current, ...patch }));
  }

  /** Atomically derive and persist settings from current state */
  async updateSettingsWith(
    updater: (current: VoyagerSettings) => VoyagerSettings,
  ): Promise<VoyagerSettings> {
    return this.runSerializedSettingsUpdate(async () => {
      const current = await this.getSettings();
      const updated = updater(current);
      await this.setSettings(updated);
      return updated;
    });
  }

  // ─── Folders ──────────────────────────────────────────────────

  /** Get all folders */
  async getFolders(): Promise<Folder[]> {
    return this.getLocal<Folder[]>(STORAGE_KEYS.FOLDERS, []);
  }

  /** Save all folders */
  async setFolders(folders: Folder[]): Promise<void> {
    await this.setLocal(STORAGE_KEYS.FOLDERS, folders);
  }

  // ─── Prompts ──────────────────────────────────────────────────

  /** Get all saved prompts */
  async getPrompts(): Promise<SavedPrompt[]> {
    return this.getLocal<SavedPrompt[]>(STORAGE_KEYS.PROMPTS, []);
  }

  /** Save all prompts */
  async setPrompts(prompts: SavedPrompt[]): Promise<void> {
    await this.setLocal(STORAGE_KEYS.PROMPTS, prompts);
  }

  // ─── Starred Messages ─────────────────────────────────────────

  /** Get starred messages */
  async getStarred(): Promise<StarredMessage[]> {
    return this.getLocal<StarredMessage[]>(STORAGE_KEYS.STARRED, []);
  }

  /** Save starred messages */
  async setStarred(starred: StarredMessage[]): Promise<void> {
    await this.setLocal(STORAGE_KEYS.STARRED, starred);
  }

  // ─── Migration ────────────────────────────────────────────────

  private async migrateIfNeeded(settings: VoyagerSettings): Promise<VoyagerSettings> {
    if (settings.schemaVersion >= CURRENT_SCHEMA_VERSION) {
      return settings;
    }

    Logger.info(
      TAG,
      `Migrating from schema v${settings.schemaVersion} to v${CURRENT_SCHEMA_VERSION}`,
    );

    let data: Record<string, unknown> = { ...settings };

    for (let v = settings.schemaVersion + 1; v <= CURRENT_SCHEMA_VERSION; v++) {
      const migrateFn = migrations[v];
      if (migrateFn) {
        data = migrateFn(data);
      }
    }

    const migrated: VoyagerSettings = {
      ...DEFAULT_SETTINGS,
      ...(data as Partial<VoyagerSettings>),
      schemaVersion: CURRENT_SCHEMA_VERSION,
    };

    await this.setSettings(migrated);
    return migrated;
  }

  private normalizeSettings(settings: VoyagerSettings): VoyagerSettings {
    const rawFeatures = (settings.features ?? {}) as Record<string, unknown>;
    const normalizedFeatures = { ...DEFAULT_SETTINGS.features } as FeatureToggles;
    const keys = Object.keys(DEFAULT_SETTINGS.features) as (keyof FeatureToggles)[];

    for (const key of keys) {
      const value = rawFeatures[key as string];
      normalizedFeatures[key] =
        typeof value === 'boolean' ? value : DEFAULT_SETTINGS.features[key];
    }

    return {
      ...DEFAULT_SETTINGS,
      ...settings,
      features: normalizedFeatures,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    };
  }

  private settingsEqual(a: VoyagerSettings, b: VoyagerSettings): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }
}

/** Singleton storage service */
export const Storage = new StorageServiceImpl();
