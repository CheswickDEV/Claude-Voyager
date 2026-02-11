/**
 * Popup settings UI — displays feature toggles and configuration options.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Messaging } from '@core/services/MessageService';
import { t } from '@i18n/index';
import type { VoyagerSettings, FeatureKey, Locale } from '@core/types';
import { DEFAULT_SETTINGS } from '@core/types';

/** Feature key to i18n key mapping */
const FEATURE_I18N: Record<FeatureKey, { name: keyof ReturnType<typeof t>; desc: keyof ReturnType<typeof t> }> = {
  timeline: { name: 'featureTimeline', desc: 'featureTimelineDesc' },
  folders: { name: 'featureFolders', desc: 'featureFoldersDesc' },
  prompts: { name: 'featurePrompts', desc: 'featurePromptsDesc' },
  export: { name: 'featureExport', desc: 'featureExportDesc' },
  widthAdjust: { name: 'featureWidthAdjust', desc: 'featureWidthAdjustDesc' },
  tabTitleSync: { name: 'featureTabTitleSync', desc: 'featureTabTitleSyncDesc' },
  formulaCopy: { name: 'featureFormulaCopy', desc: 'featureFormulaCopyDesc' },
};

const FEATURE_ORDER: FeatureKey[] = [
  'timeline', 'folders', 'prompts', 'export',
  'widthAdjust', 'tabTitleSync',
  'formulaCopy',
];

export function Popup() {
  const [settings, setSettings] = useState<VoyagerSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const settingsRef = useRef(settings);
  const updateQueueRef = useRef<Promise<void>>(Promise.resolve());

  const locale = settings.locale;
  const tr = t(locale);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Load settings on mount
  useEffect(() => {
    let active = true;

    (async () => {
      const res = await Messaging.send({ type: 'GET_SETTINGS' });
      if (!active) return;

      if (res.success && res.data) {
        setSettings(res.data as VoyagerSettings);
      } else {
        setError(res.error ?? 'Failed to load settings.');
      }
      setLoading(false);
    })().catch((err) => {
      if (!active) return;
      setError(String(err));
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const runQueued = useCallback(async (operation: () => Promise<void>) => {
    const run = updateQueueRef.current.then(operation, operation);
    updateQueueRef.current = run.then(() => undefined, () => undefined);
    await run;
  }, []);

  const applySettingChange = useCallback(
    async (
      buildOptimistic: (current: VoyagerSettings) => VoyagerSettings,
      createMessage: (
        optimistic: VoyagerSettings,
        previous: VoyagerSettings,
      ) => { type: 'UPDATE_SETTINGS' | 'FEATURE_TOGGLE'; payload: unknown },
    ) => {
      await runQueued(async () => {
        const previous = settingsRef.current;
        const optimistic = buildOptimistic(previous);
        setError(null);
        setSaving(true);
        settingsRef.current = optimistic;
        setSettings(optimistic);

        try {
          const res = await Messaging.send(createMessage(optimistic, previous));
          if (!res.success) {
            settingsRef.current = previous;
            setSettings(previous);
            setError(res.error ?? 'Failed to save settings.');
            return;
          }
          if (res.data) {
            const confirmed = res.data as VoyagerSettings;
            settingsRef.current = confirmed;
            setSettings(confirmed);
          }
        } catch (err) {
          settingsRef.current = previous;
          setSettings(previous);
          setError(String(err));
        } finally {
          setSaving(false);
        }
      });
    },
    [runQueued],
  );

  /** Persist and broadcast a settings update */
  const updateSettings = useCallback(async (patch: Partial<VoyagerSettings>) => {
    await applySettingChange(
      (current) => ({ ...current, ...patch }),
      () => ({ type: 'UPDATE_SETTINGS', payload: patch }),
    );
  }, [applySettingChange]);

  /** Toggle a single feature */
  const toggleFeature = useCallback(async (key: FeatureKey) => {
    await applySettingChange(
      (current) => ({
        ...current,
        features: { ...current.features, [key]: !current.features[key] },
      }),
      (optimistic) => ({
        type: 'FEATURE_TOGGLE',
        payload: { key, enabled: optimistic.features[key] },
      }),
    );
  }, [applySettingChange]);

  /** Toggle all features on/off */
  const toggleAllFeatures = useCallback(async () => {
    const current = settingsRef.current;
    const allEnabled = FEATURE_ORDER.every((key) => current.features[key]);
    const newState = !allEnabled;
    const features = { ...current.features };
    for (const key of FEATURE_ORDER) {
      features[key] = newState;
    }
    await updateSettings({ features });
  }, [updateSettings]);

  /** Change locale */
  const changeLocale = useCallback(async (newLocale: Locale) => {
    await updateSettings({ locale: newLocale });
  }, [updateSettings]);

  /** Change chat width */
  const changeChatWidth = useCallback(async (width: number) => {
    await updateSettings({ chatWidth: width });
  }, [updateSettings]);

  if (loading) {
    return <div style={styles.loading}>{tr.loading}</div>;
  }

  return (
    <div style={styles.container}>
      {/* Header / Banner */}
      <header style={styles.header}>
        {/* Replace src with your own banner image */}
        {/* Replace banner.png in the popup folder with your own image */}
        <img
          src="../../../../banner.png"
          alt="Claude Voyager"
          style={styles.bannerImg}
          onLoad={(e) => {
            // Image loaded — hide text fallback
            (e.target as HTMLImageElement).style.display = 'block';
            const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
            if (fallback) fallback.style.display = 'none';
          }}
          onError={(e) => {
            // No banner image — show text fallback
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        <div style={styles.bannerFallback}>
          <h1 style={styles.title}>{tr.popupTitle}</h1>
          <p style={styles.subtitle}>{tr.popupSubtitle}</p>
        </div>
      </header>

      {error && (
        <div style={styles.errorBanner}>
          {error}
        </div>
      )}

      {/* Language selector */}
      <div style={styles.section}>
        <label style={styles.sectionLabel}>{tr.language}</label>
        <select
          style={styles.select}
          value={locale}
          disabled={saving}
          onChange={(e) => changeLocale(e.target.value as Locale)}
        >
          <option value="en">English</option>
          <option value="de">Deutsch</option>
        </select>
      </div>

      {/* Chat width slider */}
      <div style={styles.section}>
        <label style={styles.sectionLabel}>
          {tr.chatWidth}: {settings.chatWidth}px
        </label>
        <input
          type="range"
          min={400}
          max={1400}
          step={50}
          value={settings.chatWidth}
          disabled={saving}
          onChange={(e) => changeChatWidth(Number(e.target.value))}
          style={styles.slider}
        />
      </div>

      {/* Feature toggles */}
      <div style={styles.section}>
        <div style={styles.featureHeader}>
          <h2 style={styles.sectionTitle}>{tr.features}</h2>
          <div
            style={styles.allToggle}
            onClick={() => { if (!saving) void toggleAllFeatures(); }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (!saving && (e.key === 'Enter' || e.key === ' ')) void toggleAllFeatures();
            }}
            title={FEATURE_ORDER.every((k) => settings.features[k]) ? tr.disableAll : tr.enableAll}
          >
            <span style={styles.allToggleLabel}>
              {FEATURE_ORDER.every((k) => settings.features[k]) ? tr.allOn : tr.allOff}
            </span>
            <div
              style={{
                ...styles.toggleSmall,
                background: FEATURE_ORDER.every((k) => settings.features[k])
                  ? 'rgba(217, 170, 90, 0.7)'
                  : 'rgba(255, 255, 255, 0.12)',
              }}
            >
              <div
                style={{
                  ...styles.toggleKnobSmall,
                  transform: FEATURE_ORDER.every((k) => settings.features[k])
                    ? 'translateX(12px)'
                    : 'translateX(0)',
                }}
              />
            </div>
          </div>
        </div>
        <div style={styles.featureList}>
          {FEATURE_ORDER.map((key) => {
            const i18n = FEATURE_I18N[key];
            const name = tr[i18n.name];
            const desc = tr[i18n.desc];
            const enabled = settings.features[key];
            return (
              <div
                key={key}
                style={styles.featureItem}
                onClick={() => { if (!saving) void toggleFeature(key); }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (!saving && (e.key === 'Enter' || e.key === ' ')) void toggleFeature(key);
                }}
              >
                <div style={styles.featureInfo}>
                  <span style={styles.featureName}>{name}</span>
                  <span style={styles.featureDesc}>{desc}</span>
                </div>
                <div
                  style={{
                    ...styles.toggle,
                    background: enabled ? 'rgba(217, 170, 90, 0.7)' : 'rgba(255, 255, 255, 0.12)',
                  }}
                >
                  <div
                    style={{
                      ...styles.toggleKnob,
                      transform: enabled ? 'translateX(16px)' : 'translateX(0)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <footer style={styles.footer}>
        <span>{saving ? tr.saving : `Claude Voyager v${DEFAULT_SETTINGS.schemaVersion}.0`}</span>
      </footer>
    </div>
  );
}

// ─── Inline Styles ──────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    padding: '16px',
    gap: '12px',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '200px',
    color: 'rgba(232, 228, 222, 0.4)',
  },
  header: {
    textAlign: 'center',
    paddingBottom: '8px',
    borderBottom: '0.5px solid rgba(255, 255, 255, 0.06)',
  },
  bannerImg: {
    width: '100%',
    height: 'auto',
    borderRadius: '8px',
    objectFit: 'cover' as const,
    maxHeight: '80px',
    display: 'none',
  },
  bannerFallback: {
    display: 'block',
  },
  title: {
    fontSize: '18px',
    fontWeight: 700,
    color: 'rgba(232, 228, 222, 0.9)',
  },
  subtitle: {
    fontSize: '12px',
    color: 'rgba(232, 228, 222, 0.4)',
    marginTop: '4px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  errorBanner: {
    padding: '8px',
    borderRadius: '8px',
    border: '0.5px solid rgba(248, 113, 113, 0.5)',
    background: 'rgba(127, 29, 29, 0.35)',
    color: 'rgba(254, 226, 226, 0.95)',
    fontSize: '12px',
  },
  sectionLabel: {
    fontSize: '12px',
    color: 'rgba(232, 228, 222, 0.6)',
    fontWeight: 500,
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'rgba(232, 228, 222, 0.75)',
    marginBottom: '0',
  },
  featureHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '4px',
  },
  allToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
  },
  allToggleLabel: {
    fontSize: '11px',
    color: 'rgba(232, 228, 222, 0.4)',
  },
  toggleSmall: {
    width: '28px',
    height: '16px',
    borderRadius: '8px',
    position: 'relative' as const,
    flexShrink: 0,
    transition: 'background 0.2s',
  },
  toggleKnobSmall: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    background: 'rgba(232, 228, 222, 0.9)',
    position: 'absolute' as const,
    top: '2px',
    left: '2px',
    transition: 'transform 0.2s',
  },
  select: {
    padding: '6px 8px',
    borderRadius: '6px',
    border: '0.5px solid rgba(255, 255, 255, 0.1)',
    background: 'rgba(20, 18, 15, 0.8)',
    color: 'rgba(232, 228, 222, 0.9)',
    fontSize: '13px',
    cursor: 'pointer',
  },
  slider: {
    width: '100%',
    accentColor: 'rgba(217, 170, 90, 0.8)',
  },
  featureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  featureInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flex: 1,
    marginRight: '12px',
  },
  featureName: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'rgba(232, 228, 222, 0.9)',
  },
  featureDesc: {
    fontSize: '11px',
    color: 'rgba(232, 228, 222, 0.4)',
  },
  toggle: {
    width: '36px',
    height: '20px',
    borderRadius: '10px',
    position: 'relative' as const,
    flexShrink: 0,
    transition: 'background 0.2s',
  },
  toggleKnob: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    background: 'rgba(232, 228, 222, 0.9)',
    position: 'absolute' as const,
    top: '2px',
    left: '2px',
    transition: 'transform 0.2s',
  },
  footer: {
    textAlign: 'center',
    fontSize: '11px',
    color: 'rgba(232, 228, 222, 0.25)',
    paddingTop: '8px',
    borderTop: '0.5px solid rgba(255, 255, 255, 0.06)',
  },
};
