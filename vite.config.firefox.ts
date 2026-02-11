import { defineConfig, type Plugin, type UserConfig, build } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, rmSync, cpSync } from 'fs';

const aliasConfig = {
  '@core': resolve(__dirname, 'src/core'),
  '@features': resolve(__dirname, 'src/features'),
  '@i18n': resolve(__dirname, 'src/i18n'),
  '@pages': resolve(__dirname, 'src/pages'),
};

const targetConfig = 'firefox142';
const envDefine = {
  'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
};

/**
 * Plugin that runs after the popup build to also build
 * the content script (IIFE) and background script (ESM) separately,
 * then copies static assets.
 *
 * This avoids code-splitting across entry points — critical because
 * Firefox content scripts are classic scripts and CANNOT use ES module imports.
 */
function multiBuildPlugin(): Plugin {
  return {
    name: 'multi-build',
    async closeBundle() {
      const distDir = resolve(__dirname, 'dist');

      // ─── Build content script as IIFE (no imports allowed) ────
      await build({
        configFile: false,
        resolve: { alias: aliasConfig },
        define: envDefine,
        build: {
          outDir: distDir,
          emptyOutDir: false, // Don't wipe the popup output
          sourcemap: false,
          lib: {
            entry: resolve(__dirname, 'src/pages/content/index.ts'),
            name: 'ClaudeVoyagerContent',
            formats: ['iife'],
            fileName: () => 'content.js',
          },
          rollupOptions: {
            output: {
              // Ensure everything is inlined
              inlineDynamicImports: true,
            },
          },
          target: targetConfig,
          minify: true,
        },
      });

      // ─── Build background script as ESM (MV3 supports type:module) ─
      await build({
        configFile: false,
        resolve: { alias: aliasConfig },
        define: envDefine,
        build: {
          outDir: distDir,
          emptyOutDir: false,
          sourcemap: false,
          lib: {
            entry: resolve(__dirname, 'src/pages/background/index.ts'),
            name: 'ClaudeVoyagerBG',
            formats: ['iife'],
            fileName: () => 'background.js',
          },
          rollupOptions: {
            output: {
              inlineDynamicImports: true,
            },
          },
          target: targetConfig,
          minify: true,
        },
      });

      // ─── Copy static assets ───────────────────────────────────
      // Copy manifest.json
      copyFileSync(
        resolve(__dirname, 'manifest.json'),
        resolve(distDir, 'manifest.json'),
      );

      // Copy content.css
      const assetsDir = resolve(distDir, 'assets');
      if (!existsSync(assetsDir)) {
        mkdirSync(assetsDir, { recursive: true });
      }
      copyFileSync(
        resolve(__dirname, 'src/pages/content/content.css'),
        resolve(assetsDir, 'content.css'),
      );

      // Copy _locales and icons from repo root into dist
      cpSync(resolve(__dirname, '_locales'), resolve(distDir, '_locales'), { recursive: true });
      cpSync(resolve(__dirname, 'icons'), resolve(distDir, 'icons'), { recursive: true });
    },
  };
}

/**
 * Main config: builds only the popup (HTML + React).
 * The content script and background script are built separately
 * by the multiBuildPlugin above.
 */
export default defineConfig({
  base: './',
  plugins: [react(), multiBuildPlugin()],
  publicDir: 'public',
  resolve: { alias: aliasConfig },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/pages/popup/index.html'),
      },
    },
    target: targetConfig,
  },
  define: envDefine,
});
