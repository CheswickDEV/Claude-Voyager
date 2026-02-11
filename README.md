<p align="center">
  <img src="public/banner.png" alt="Claude Voyager Banner" width="100%" />
</p>

<h1 align="center">Claude Voyager</h1>

<p align="center">
  <strong>Productivity toolkit for claude.ai</strong><br/>
  <sub>Firefox Extension &middot; Manifest V3 &middot; React 19 &middot; TypeScript</sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Firefox-142%2B-FF7139?logo=firefoxbrowser&logoColor=white" alt="Firefox 142+" />
  <img src="https://img.shields.io/badge/Manifest-V3-4285F4?logoColor=white" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License" />
</p>

<p align="center">
  <a href="#features">Features</a> &bull;
  <a href="#installation">Installation</a> &bull;
  <a href="#development">Development</a> &bull;
  <a href="#architecture">Architecture</a> &bull;
  <a href="#contributing">Contributing</a>
</p>

---

## What is Claude Voyager?

Claude Voyager adds focused productivity tools directly into the claude.ai interface. Every feature is designed to look and feel native to Claude — no visual noise, no heavy overlays. Enable or disable each tool independently from the popup settings.

---

## Features

| Feature | Description |
|---------|-------------|
| **Timeline Navigation** | Dot timeline on the side of messages for quick jumps. Long-press to star important points. |
| **Folder Organization** | Native-style sidebar folder entry with drag-and-drop conversation sorting. |
| **Prompt Library** | Reusable prompt snippets with save, search, and one-click insert into the chat input. |
| **Chat Export** | Export conversations as JSON, Markdown, or PDF-ready output. |
| **Adjustable Chat Width** | Change the max chat width directly from the extension popup. |
| **Tab Title Sync** | Keep browser tab titles aligned with the active conversation title. |
| **Formula Copy** | Copy LaTeX source from rendered KaTeX formulas directly to clipboard. |

### Language Support

- English (`en`)
- Deutsch (`de`)

---

## Installation

### From ZIP (recommended)

1. Download the latest `claude-voyager-x.x.x.zip` from [Releases](../../releases)
2. Extract the archive to a folder of your choice.
3. Open a terminal within that folder and run `npm install` followed by `npm run build`.
4. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
5. Click **Load Temporary Add-on...**
6. Select the `manifest.json` file located in the `.\dist` directory.

### From Source

```bash
# Clone the repository
git clone https://github.com/CheswickDEV/claude-voyager.git
cd claude-voyager

# Install dependencies
npm install

# Build for production
npm run build

# Load dist/ in Firefox via about:debugging
```

> **Requirements:** Node.js 20+, npm, Firefox 142+

---

## Development

```bash
npm run dev        # Watch build — rebuilds on file changes
npm run build      # Production build (typecheck + bundle)
npm run typecheck  # TypeScript validation only
npm run clean      # Remove dist/
```

### Dev Workflow

1. Run `npm run dev` for watch mode
2. Load `dist/manifest.json` as a temporary add-on in Firefox
3. After changes, click **Reload** in `about:debugging`
4. Test on `https://claude.ai/*`

---

## Architecture

```
                 +------------------+
                 |   Popup (React)  |  Settings UI with feature toggles
                 +--------+---------+
                          |
                    MessageService
                          |
              +-----------+-----------+
              |                       |
    +---------+----------+  +---------+---------+
    | Background Worker  |  |  Content Script   |
    | Settings + Sync    |  |  Feature Lifecycle |
    +--------------------+  |  DOM Observation   |
                            |  SPA Navigation    |
                            +---------+----------+
                                      |
                      +---------------+---------------+
                      |       |       |       |       |
                   Timeline Folder  Prompt  Export  ...
```

### Core Services

| Service | Purpose |
|---------|---------|
| `DOMService` | Centralized CSS selectors, DOM queries, MutationObserver management |
| `StorageService` | Settings, folders, prompts persistence with migration support |
| `MessageService` | Typed IPC between popup, background, and content script |
| `LoggerService` | Structured logging with `[Claude Voyager]` prefix |

### Project Structure

```
src/
  core/
    services/        # DOM, Storage, Messaging, Logger
    types/           # Global types, feature keys, defaults
    utils/           # Debounce, ID generation
  features/
    timeline/        # Timeline navigation + starring
    folder/          # Folder organization + drag-and-drop
    prompt/          # Prompt library + search
    export/          # Chat export (JSON/MD/PDF)
    widthAdjust/     # Adjustable chat width
    tabTitleSync/    # Tab title synchronization
    formulaCopy/     # LaTeX formula copy
  i18n/              # EN + DE translations
  pages/
    background/      # MV3 background script
    content/         # Content script entry + feature orchestration
    popup/           # React settings UI
public/
  icons/             # Extension icons (16/48/128px)
  banner.png         # Extension banner
  _locales/          # Firefox i18n (en, de)
manifest.json        # MV3 manifest for Firefox
vite.config.firefox.ts
```

---

## Permissions

This extension requests minimal permissions:

| Permission | Reason |
|------------|--------|
| `storage` | Persist settings, folders, prompts, and starred messages |
| `tabs` | Notify open claude.ai tabs when settings change |

Content script is scoped to `https://claude.ai/*` only.

---

## Design Philosophy

> Added UI should look and feel native to Claude.

- All custom elements use Claude's own CSS variables and design patterns
- Features are independently toggleable — nothing is forced
- Zero tracking, zero analytics, zero external requests
- DOM selectors are centralized in `DOMService` for easy maintenance when claude.ai updates

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run `npm run build` to verify TypeScript + build
5. Submit a pull request

---

## Disclaimer

This project is not affiliated with or endorsed by Anthropic. Claude and claude.ai are trademarks of Anthropic.

---

## 📄 License

This project is licensed under the **MIT License** — see [LICENSE](LICENSE) for details.

You're free to use this optimizer personally, commercially, in your own projects, or as part of a larger system.

---

## ⭐ Star This Repo

If this optimizer saves you time or improves your Claude results, please consider starring the repo — it helps others discover it and motivates continued development.

[![Star History Chart](https://api.star-history.com/svg?repos=CheswickDEV/Claude-Voyager&type=Date)](https://star-history.com/#CheswickDEV/Claude-Voyager&Date)

**[⭐ Star this repo](https://github.com/CheswickDEV/Claude-Voyager)** | **[🐛 Report an issue](https://github.com/CheswickDEV/Claude-Voyager/issues)** | **[💡 Request a feature](https://github.com/CheswickDEV/Claude-Voyager/issues/new?template=feature_request.md)**

---

<p align="center">
  Made with 🖤 by <a href="https://cheswick.dev">cheswick.dev </a> · Not affiliated with Anthropic
</p>
