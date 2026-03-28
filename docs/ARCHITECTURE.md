# Architecture

## Overview

Relay is an Electron application with a standard two-process architecture. The **main process** runs in Node.js and owns all privileged operations: file I/O, git subprocess execution, PTY sessions, and persistent storage. The **renderer process** runs in Chromium and contains the React UI. Communication between the two happens exclusively through an IPC bridge exposed by the preload script.

```
┌─────────────────────────────────┐   ┌──────────────────────────────────┐
│  Main Process (Node.js)         │   │  Renderer Process (Chromium)     │
│                                 │   │                                  │
│  index.ts     — app lifecycle   │   │  React components                │
│  window.ts    — BrowserWindow   │   │  RepoContext  — global state     │
│  ipc.ts       — 32 handlers     │◄──►  window.relay — preload bridge  │
│  terminal.ts  — Claude PTYs     │   │                                  │
│  shell.ts     — shell PTYs      │   │                                  │
│  store.ts     — electron-store  │   │                                  │
└─────────────────────────────────┘   └──────────────────────────────────┘
                    ▲
                    │ spawns subprocesses
                    ▼
         git CLI  /  $SHELL  /  claude CLI
```

## Directory structure

```
src/
├── main/
│   ├── index.ts       App lifecycle, window creation, menu bar
│   ├── window.ts      BrowserWindow config (vibrancy, preload, security flags)
│   ├── ipc.ts         All IPC handler registrations
│   ├── terminal.ts    TerminalManager — one PTY per worktree, runs claude
│   ├── shell.ts       ShellManager — per-tab shell PTYs
│   └── store.ts       electron-store schema and defaults
├── preload/
│   └── index.ts       contextBridge — exposes window.relay to renderer
└── renderer/
    ├── index.tsx
    ├── App.tsx
    ├── context/
    │   └── RepoContext.tsx   useReducer-based global state
    ├── components/
    │   ├── layout/          AppShell, Sidebar, ChatPane, RightColumn
    │   ├── sidebar/         TaskGroupSection, WorktreeRow, modals
    │   ├── chat/            TerminalEmbed, DiffViewer, FileViewer
    │   ├── terminal/        ShellTabBar, ShellEmbed
    │   └── SettingsModal.tsx
    ├── hooks/
    │   └── useSoundEffects.ts
    └── types/
        └── repo.ts          Shared TypeScript interfaces
```

## Process model

### Main process

Bootstrapped in `src/main/index.ts`. Responsibilities:

- Creates the single `BrowserWindow` (via `window.ts`)
- Registers all IPC handlers (via `ipc.ts`)
- Instantiates `TerminalManager` and `ShellManager`
- Sets up the macOS menu bar with standard Edit menu and a Settings item
- Calls `terminal.killAll()` on `before-quit`

### Preload script

`src/preload/index.ts` uses `contextBridge` to expose a minimal `window.relay` API to the renderer. The renderer has no direct access to Node.js or Electron APIs. The bridge provides:

- `window.relay.invoke(channel, ...args)` — wraps `ipcRenderer.invoke`
- `window.relay.on(channel, listener)` — wraps `ipcRenderer.on`, returns an unsubscribe function

`nodeIntegration` is `false` and `contextIsolation` is `true`. The Electron sandbox is disabled (`sandbox: false`) because `node-pty` is a native module that must run in the main process, but the renderer itself has no Node access.

### Renderer

A standard React 18 application. All state is managed in `RepoContext` using `useReducer`. There is no external state management library.

## State management

### In-memory (renderer): `RepoContext`

`src/renderer/context/RepoContext.tsx` holds:

| Field | Type | Description |
|---|---|---|
| `taskGroups` | `TaskGroup[]` | All task groups with their hydrated branch/worktree info |
| `activeWorktreePath` | `string \| null` | Currently selected worktree |
| `activeTab` | `'chat' \| 'diff' \| 'file'` | Active center-pane tab |
| `activeDiffFile` | `ChangedFile \| null` | File selected in diff viewer |
| `activeFilePath` | `string \| null` | File selected in file viewer |
| `shellTabs` | per-worktree tab state | Shell tab IDs and active index |

On startup, `RepoContext` calls `taskgroups:list` to hydrate from the store.

### Persistent: `electron-store`

`src/main/store.ts` persists the following to `~/Library/Application Support/relay/config.json`:

| Key | Type | Default |
|---|---|---|
| `taskGroups` | `PersistedTaskGroup[]` | `[]` |
| `worktreesDir` | `string \| null` | `null` |
| `repoDefaults` | `Record<string, string>` | `{}` |
| `notificationsEnabled` | `boolean` | `true` |
| `soundEffectsEnabled` | `boolean` | `true` |
| `editorTheme` | `string` | `'one-dark'` |
| `editorWordWrap` | `boolean` | `false` |

`PersistedTaskGroup` stores only path references (`repoRootPath`, `worktreePath`) — not branch names. Branch names are resolved live from git at load time via `getCurrentBranch`.

## IPC layer

All IPC calls follow the `invoke` (request/response) pattern. There are no `send`-only calls from the renderer. The main process does use `win.webContents.send` to push events to the renderer for terminal output and notifications.

### Channels by domain

**Task group management**
- `taskgroups:list` — hydrate all groups from store, resolving current branch names from git
- `taskgroups:create` / `taskgroups:rename` / `taskgroups:remove`
- `taskgroups:add-branch` — fetch from origin, create git worktree, persist
- `taskgroups:remove-branch` — `git worktree remove`, update store

**Git operations**
- `git:get-repo-info` — resolve repo root, detect or look up default branch
- `git:changed-files` — `git diff HEAD --name-status` + `--numstat` + `git ls-files --others`
- `git:all-files` — `git ls-files`
- `git:diff-file` — `git diff HEAD -- <file>` or `git diff --no-index /dev/null <file>` for untracked

**File I/O**
- `fs:read-file` — read file, detect binary via 8KB null-byte scan
- `fs:write-file` — write file content back to disk

**Terminal (Claude sessions)**
- `terminal:create` / `terminal:write` / `terminal:resize`

**Shell (user shell tabs)**
- `shell:create` / `shell:write` / `shell:resize` / `shell:close`

**Settings**
- `settings:get-*` / `settings:set-*` for each preference

**UI**
- `dialog:open-folder` — native folder picker
- `shell:open-path` — open in Finder
- `menu:show-context-menu` — native context menu

**Push events (main → renderer)**
- `terminal:data` — PTY output for a worktree
- `shell:data` / `shell:exit` — shell tab output/close
- `response:complete` — Claude idle timeout fired (triggers sound effect)
- `navigate:worktree` — notification click, renderer switches active worktree
- `open:settings` — menu bar command, renderer opens settings modal
- `menu:item-clicked` — context menu selection

## Terminal and shell sessions

### TerminalManager (`src/main/terminal.ts`)

Manages one long-lived PTY per worktree, running `$SHELL -l -c claude` with the worktree as `cwd`. The PTY inherits the full parent environment so git credentials, npm config, etc. are available to Claude.

**Claude completion detection:** When the user sends input containing a newline, `pendingResponse` is set. When PTY output goes idle for 1500ms, the manager fires a `response:complete` event to the renderer and, if the window is not focused and notifications are enabled, shows a macOS `Notification`. Clicking the notification focuses the window and navigates to that worktree.

### ShellManager (`src/main/shell.ts`)

Manages per-tab PTYs running `$SHELL -l`, keyed by a UUID `tabId`. Supports up to five tabs per worktree. Tabs are created on demand and closed when the user closes the tab or switches worktrees.

## Component hierarchy

```
App (RepoProvider)
└── AppShell
    ├── Sidebar (fixed 260px)
    │   └── TaskGroupSection[]
    │       └── WorktreeRow[]
    ├── ChatPane (flexible center)
    │   ├── TerminalEmbed   (mounted for each visited worktree, display toggled)
    │   ├── DiffViewer      (diff2html)
    │   └── FileViewer      (CodeMirror 6)
    └── RightColumn (fixed 320px)
        ├── ChangedFilesPane (top, vertically resizable)
        └── TerminalPane (bottom)
            ├── ShellTabBar
            └── ShellEmbed[]
```

`TerminalEmbed` components are mounted permanently once a worktree is visited and hidden/shown via CSS. This preserves xterm.js terminal state without remounting.

## Build system

`electron-vite` manages three separate Vite bundles:

| Bundle | Entry | Output |
|---|---|---|
| Main | `src/main/index.ts` | `out/main/index.js` |
| Preload | `src/preload/index.ts` | `out/preload/index.js` |
| Renderer | `src/renderer/index.tsx` | `out/renderer/` |

The renderer bundle includes Tailwind CSS (via `@tailwindcss/vite`) and React. The main/preload bundles use `externalizeDepsPlugin` to keep Node built-ins and most npm packages as `require()` calls rather than bundling them, with the exception of `electron-store` which is bundled.

`postinstall` runs `electron-rebuild -f -w node-pty` to compile the native PTY module against the active Electron version's Node headers.
