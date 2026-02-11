/**
 * Internationalization module.
 * Provides type-safe translations for German and English.
 */

import type { Locale } from '@core/types';

/** Translation key structure */
export interface Translations {
  // General
  settings: string;
  features: string;
  enabled: string;
  disabled: string;
  save: string;
  cancel: string;
  reset: string;
  importBtn: string;
  exportBtn: string;
  delete: string;
  rename: string;
  confirm: string;
  search: string;
  closeBtn: string;
  loading: string;
  saving: string;

  // Feature names
  featureTimeline: string;
  featureFolders: string;
  featurePrompts: string;
  featureExport: string;
  featureWidthAdjust: string;
  featureTabTitleSync: string;
  featureFormulaCopy: string;

  // Feature descriptions
  featureTimelineDesc: string;
  featureFoldersDesc: string;
  featurePromptsDesc: string;
  featureExportDesc: string;
  featureWidthAdjustDesc: string;
  featureTabTitleSyncDesc: string;
  featureFormulaCopyDesc: string;

  // Settings
  chatWidth: string;
  language: string;

  // Popup
  popupTitle: string;
  popupSubtitle: string;
  allOn: string;
  allOff: string;
  enableAll: string;
  disableAll: string;

  // Folder feature
  folder: string;
  newFolder: string;
  noFoldersYet: string;
  deleteFolder: string;
  deleteFolderConfirm: string;
  importedFolder: string;
  importFailedArray: string;
  importFailedPersist: string;
  importFailedJson: string;
  importFinished: string;
  failedSaveFolders: string;

  // Prompt feature
  promptLibrary: string;
  newPrompt: string;
  searchPrompts: string;
  noPromptsFound: string;
  noPromptsSaved: string;
  insertBtn: string;
  editBtn: string;
  deleteBtn: string;
  promptTitle: string;
  promptContent: string;
  tagsSeparated: string;
  categoryLabel: string;
  failedSavePrompt: string;
  failedDeletePrompt: string;
  failedPersistPrompts: string;
  importFailedPromptArray: string;
  importFailedPromptJson: string;
  promptImportFinished: string;
  promptCopiedFallback: string;
  promptInsertFailed: string;

  // Export feature
  exportAsJson: string;
  exportAsMarkdown: string;
  exportAsPdf: string;
  untitledConversation: string;

  // Timeline feature
  messages: string;
  closeTimeline: string;
  you: string;
  claudeRole: string;
  starLevel1: string;
  starLevel2: string;
  starLevel3: string;
  removeStar: string;

  // Formula copy
  copyLatex: string;
  copyLatexSource: string;
}

const en: Translations = {
  settings: 'Settings',
  features: 'Features',
  enabled: 'Enabled',
  disabled: 'Disabled',
  save: 'Save',
  cancel: 'Cancel',
  reset: 'Reset',
  importBtn: 'Import',
  exportBtn: 'Export',
  delete: 'Delete',
  rename: 'Rename',
  confirm: 'Confirm',
  search: 'Search',
  closeBtn: 'Close',
  loading: 'Loading...',
  saving: 'Saving...',

  featureTimeline: 'Timeline Navigation',
  featureFolders: 'Folder Organization',
  featurePrompts: 'Prompt Library',
  featureExport: 'Chat Export',
  featureWidthAdjust: 'Adjustable Chat Width',
  featureTabTitleSync: 'Tab Title Sync',
  featureFormulaCopy: 'Formula Copy',

  featureTimelineDesc: 'Adds a vertical dot-timeline on the right side. Click a dot to jump to that message. Long-press to star.',
  featureFoldersDesc: 'Folder icon in top-left opens an overlay panel to organize chats into folders. Drag conversations from the sidebar into folders.',
  featurePromptsDesc: 'Floating button (bottom-right) opens a prompt library. Save, search, and one-click insert reusable prompt templates.',
  featureExportDesc: 'Floating "Export" button (top-right) on chat pages. Download conversations as JSON, Markdown, or print as PDF.',
  featureWidthAdjustDesc: 'Uses the width slider above to override the chat area max-width, making conversations wider or narrower.',
  featureTabTitleSyncDesc: 'Keeps the browser tab title in sync with the current conversation title instead of showing "Claude".',
  featureFormulaCopyDesc: 'Hover over a rendered LaTeX formula to see a copy button. Click it to copy the original LaTeX source to clipboard.',

  chatWidth: 'Chat Width',
  language: 'Language',

  popupTitle: 'Claude Voyager',
  popupSubtitle: 'Productivity features for claude.ai',
  allOn: 'All on',
  allOff: 'All off',
  enableAll: 'Enable all',
  disableAll: 'Disable all',

  folder: 'Folders',
  newFolder: 'New Folder',
  noFoldersYet: 'No folders yet. Click + to create one.',
  deleteFolder: 'Delete folder',
  deleteFolderConfirm: 'Delete this folder and all subfolders?',
  importedFolder: 'Imported Folder',
  importFailedArray: 'Import failed: JSON must be an array of folders.',
  importFailedPersist: 'Import failed: unable to persist folders.',
  importFailedJson: 'Import failed: file is not valid JSON.',
  importFinished: 'Folder import finished.',
  failedSaveFolders: 'Failed to save folders.',

  promptLibrary: 'Prompt Library',
  newPrompt: 'New Prompt',
  searchPrompts: 'Search prompts by title or tag...',
  noPromptsFound: 'No prompts found.',
  noPromptsSaved: 'No prompts saved yet.',
  insertBtn: 'Insert',
  editBtn: 'Edit',
  deleteBtn: 'Del',
  promptTitle: 'Prompt title',
  promptContent: 'Prompt content...',
  tagsSeparated: 'Tags (comma-separated)',
  categoryLabel: 'Category',
  failedSavePrompt: 'Failed to save prompt changes.',
  failedDeletePrompt: 'Failed to delete prompt.',
  failedPersistPrompts: 'Import failed: unable to persist prompts.',
  importFailedPromptArray: 'Import failed: JSON must be an array of prompts.',
  importFailedPromptJson: 'Import failed: file is not valid JSON.',
  promptImportFinished: 'Prompt import finished.',
  promptCopiedFallback: 'Could not insert prompt automatically. Prompt was copied to clipboard.',
  promptInsertFailed: 'Could not insert prompt automatically.',

  exportAsJson: 'Export as JSON',
  exportAsMarkdown: 'Export as Markdown',
  exportAsPdf: 'Export as PDF',
  untitledConversation: 'Untitled Conversation',

  messages: 'Messages',
  closeTimeline: 'Close timeline',
  you: 'You',
  claudeRole: 'Claude',
  starLevel1: '\u2605 Level 1',
  starLevel2: '\u2605 Level 2',
  starLevel3: '\u2605 Level 3',
  removeStar: 'Remove Star',

  copyLatex: 'Copy LaTeX',
  copyLatexSource: 'Copy LaTeX source',
};

const de: Translations = {
  settings: 'Einstellungen',
  features: 'Funktionen',
  enabled: 'Aktiviert',
  disabled: 'Deaktiviert',
  save: 'Speichern',
  cancel: 'Abbrechen',
  reset: 'Zurücksetzen',
  importBtn: 'Importieren',
  exportBtn: 'Exportieren',
  delete: 'Löschen',
  rename: 'Umbenennen',
  confirm: 'Bestätigen',
  search: 'Suchen',
  closeBtn: 'Schließen',
  loading: 'Laden...',
  saving: 'Speichern...',

  featureTimeline: 'Timeline-Navigation',
  featureFolders: 'Ordner-Organisation',
  featurePrompts: 'Prompt-Bibliothek',
  featureExport: 'Chat-Export',
  featureWidthAdjust: 'Chat-Breite anpassen',
  featureTabTitleSync: 'Tab-Titel-Synchronisierung',
  featureFormulaCopy: 'Formel kopieren',

  featureTimelineDesc: 'Vertikale Punkt-Timeline rechts. Klick springt zur Nachricht. Langes Drücken markiert mit Stern.',
  featureFoldersDesc: 'Ordner-Symbol oben links öffnet ein Overlay-Panel. Chats per Drag-and-Drop aus der Seitenleiste in Ordner sortieren.',
  featurePromptsDesc: 'Schwebender Button (unten rechts) öffnet die Prompt-Bibliothek. Vorlagen speichern, suchen und per Klick einfügen.',
  featureExportDesc: 'Schwebender "Export"-Button (oben rechts) auf Chat-Seiten. Konversationen als JSON, Markdown oder PDF herunterladen.',
  featureWidthAdjustDesc: 'Nutzt den Breite-Schieberegler oben, um die maximale Chat-Breite anzupassen - breiter oder schmaler.',
  featureTabTitleSyncDesc: 'Synchronisiert den Browser-Tab-Titel mit dem aktuellen Gesprächstitel statt "Claude" anzuzeigen.',
  featureFormulaCopyDesc: 'Beim Hovern über eine gerenderte LaTeX-Formel erscheint ein Kopier-Button für den LaTeX-Quellcode.',

  chatWidth: 'Chat-Breite',
  language: 'Sprache',

  popupTitle: 'Claude Voyager',
  popupSubtitle: 'Produktivitäts-Features für claude.ai',
  allOn: 'Alle an',
  allOff: 'Alle aus',
  enableAll: 'Alle aktivieren',
  disableAll: 'Alle deaktivieren',

  folder: 'Ordner',
  newFolder: 'Neuer Ordner',
  noFoldersYet: 'Noch keine Ordner. Klicke + um einen zu erstellen.',
  deleteFolder: 'Ordner löschen',
  deleteFolderConfirm: 'Diesen Ordner und alle Unterordner löschen?',
  importedFolder: 'Importierter Ordner',
  importFailedArray: 'Import fehlgeschlagen: JSON muss ein Array von Ordnern sein.',
  importFailedPersist: 'Import fehlgeschlagen: Ordner konnten nicht gespeichert werden.',
  importFailedJson: 'Import fehlgeschlagen: Datei ist kein gültiges JSON.',
  importFinished: 'Ordner-Import abgeschlossen.',
  failedSaveFolders: 'Ordner konnten nicht gespeichert werden.',

  promptLibrary: 'Prompt-Bibliothek',
  newPrompt: 'Neuer Prompt',
  searchPrompts: 'Prompts nach Titel oder Tag suchen...',
  noPromptsFound: 'Keine Prompts gefunden.',
  noPromptsSaved: 'Noch keine Prompts gespeichert.',
  insertBtn: 'Einfügen',
  editBtn: 'Bearbeiten',
  deleteBtn: 'Löschen',
  promptTitle: 'Prompt-Titel',
  promptContent: 'Prompt-Inhalt...',
  tagsSeparated: 'Tags (kommagetrennt)',
  categoryLabel: 'Kategorie',
  failedSavePrompt: 'Prompt-Änderungen konnten nicht gespeichert werden.',
  failedDeletePrompt: 'Prompt konnte nicht gelöscht werden.',
  failedPersistPrompts: 'Import fehlgeschlagen: Prompts konnten nicht gespeichert werden.',
  importFailedPromptArray: 'Import fehlgeschlagen: JSON muss ein Array von Prompts sein.',
  importFailedPromptJson: 'Import fehlgeschlagen: Datei ist kein gültiges JSON.',
  promptImportFinished: 'Prompt-Import abgeschlossen.',
  promptCopiedFallback: 'Prompt konnte nicht automatisch eingefügt werden. In Zwischenablage kopiert.',
  promptInsertFailed: 'Prompt konnte nicht automatisch eingefügt werden.',

  exportAsJson: 'Als JSON exportieren',
  exportAsMarkdown: 'Als Markdown exportieren',
  exportAsPdf: 'Als PDF exportieren',
  untitledConversation: 'Unbenannte Konversation',

  messages: 'Nachrichten',
  closeTimeline: 'Timeline schließen',
  you: 'Du',
  claudeRole: 'Claude',
  starLevel1: '\u2605 Stufe 1',
  starLevel2: '\u2605 Stufe 2',
  starLevel3: '\u2605 Stufe 3',
  removeStar: 'Stern entfernen',

  copyLatex: 'LaTeX kopieren',
  copyLatexSource: 'LaTeX-Quellcode kopieren',
};

const translations: Record<Locale, Translations> = { en, de };

/** Get the translation object for a given locale */
export function t(locale: Locale): Translations {
  return translations[locale];
}

/** Detect browser locale, falling back to 'en' */
export function detectLocale(): Locale {
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith('de')) return 'de';
  return 'en';
}
