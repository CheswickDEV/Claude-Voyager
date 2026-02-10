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

