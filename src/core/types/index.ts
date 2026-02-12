/**
 * Global type definitions for Claude Voyager.
 */

/** Supported UI languages */
export type Locale = 'en' | 'de';

/** Feature toggle keys — each feature can be enabled/disabled independently */
export type FeatureKey =
  | 'timeline'
  | 'folders'
  | 'prompts'
  | 'export'
  | 'widthAdjust'
  | 'tabTitleSync'
  | 'formulaCopy';

/** Feature toggle map */
export type FeatureToggles = Record<FeatureKey, boolean>;

/** Default feature toggle state */
export const DEFAULT_FEATURE_TOGGLES: FeatureToggles = {
  timeline: false,
  folders: false,
  prompts: false,
  export: false,
  widthAdjust: false,
  tabTitleSync: false,
  formulaCopy: false,
};

/** Global extension settings persisted in storage */
export interface VoyagerSettings {
  locale: Locale;
  features: FeatureToggles;
  chatWidth: number;
  schemaVersion: number;
}

/** Current schema version — increment when storage shape changes */
export const CURRENT_SCHEMA_VERSION = 1;

/** Default settings */
export const DEFAULT_SETTINGS: VoyagerSettings = {
  locale: 'en',
  features: DEFAULT_FEATURE_TOGGLES,
  chatWidth: 800,
  schemaVersion: CURRENT_SCHEMA_VERSION,
};

/** A saved prompt in the prompt library */
export interface SavedPrompt {
  id: string;
  title: string;
  content: string;
  tags: string[];
  category: string;
  createdAt: number;
  updatedAt: number;
}

/** A conversation reference stored inside a folder */
export interface FolderConversation {
  id: string;
  title: string;
}

/** A folder for organizing conversations */
export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  conversations: FolderConversation[];
  createdAt: number;
  order: number;
}

/** A starred message reference */
export interface StarredMessage {
  conversationId: string;
  messageIndex: number;
  preview: string;
  starredAt: number;
  level: 1 | 2 | 3;
}

/** Message role in a conversation */
export type MessageRole = 'human' | 'assistant';

/** Parsed chat message from the DOM */
export interface ChatMessage {
  role: MessageRole;
  contentHtml: string;
  contentText: string;
  index: number;
  element: Element;
}

/** Storage key constants */
export const STORAGE_KEYS = {
  SETTINGS: 'voyager_settings',
  FOLDERS: 'voyager_folders',
  PROMPTS: 'voyager_prompts',
  STARRED: 'voyager_starred',
} as const;
