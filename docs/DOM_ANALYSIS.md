# claude.ai DOM analysis (Phase 1)

## Likely structure (React SPA)

- **React root**: A single `#root` element that hydrates the entire SPA.
- **Sidebar**: An `aside` element on the left containing the conversation list.
- **Conversation items**: Likely list items with stable `data-testid` attributes (e.g. `conversation-item`).
- **Chat container**: A `main` region that renders the conversation.
- **Message groups**: Containers with `data-testid="chat-message"` (or similar) holding the author + content.
- **Author label**: A `data-testid="chat-message-author"` element with "Human"/"Assistant".
- **Content body**: A `data-testid="chat-message-content"` element with Markdown-rendered HTML.
- **Input area**: A `contenteditable` div for composing messages (not a textarea).

## Volatile selectors

- **Message group/content**: Internal class names can change frequently between builds.
- **Sidebar list items**: UI refactors may adjust list structure and attributes.
- **Input area**: Input component might switch between contenteditable and textarea.

## DOM service strategy

- Centralize selectors in `DOMService` so updates are localized.
- Always fail gracefully when a selector misses.
- Use `MutationObserver` only where dynamic rendering is expected (chat container, sidebar list).
- Use polling + timeout for initial render readiness.
