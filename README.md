# Relay

Relay is a macOS desktop application that pairs git worktrees with Claude Code. It gives you a dedicated workspace for each task branch — a Claude terminal, a file viewer, a diff viewer, and a shell — all within a single window.

## What it does

- **Task groups** organize related work across one or more repos. Each task group holds one or more worktrees, one per branch.
- **Claude terminal** — each worktree gets a persistent Claude Code session. You can send prompts and receive responses without leaving the app.
- **Changed files panel** — shows M/A/D/untracked files in the current worktree. Click a file to view its diff or open it in the editor.
- **File viewer/editor** — syntax-highlighted CodeMirror editor with multiple themes and word-wrap support.
- **Shell tabs** — a separate multi-tab terminal pane per worktree for running arbitrary commands.
- **macOS notifications** — Relay notifies you when Claude finishes responding, even when the window is in the background.

## Prerequisites

- **macOS** 12 or later
- **Node.js** 18 or later (with npm)
- **Git** 2.30 or later
- **Claude Code CLI** installed and authenticated

Install Claude Code if you haven't already:

```bash
npm install -g @anthropic-ai/claude-code
claude login
```

## Running locally

```bash
npm install
npm run start
```

`npm install` will automatically rebuild the native `node-pty` module for your Electron version via the `postinstall` script. The dev server starts with hot reload enabled.

## Building for production

```bash
npm run build
```

Output is written to `out/`. You can preview it with `npm run preview`.

## Packaging for distribution

To create a `.dmg` installer for macOS:

```bash
npm run package
```

This builds the app with electron-vite and packages it into a `.dmg` using electron-builder. The output is written to `dist/`.

> **Note:** Apple requires apps distributed outside the Mac App Store to be code-signed and notarized to run without Gatekeeper warnings. For personal use or local testing, you can bypass this by right-clicking the app in Finder and choosing **Open**.

## Tech stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 36 |
| UI | React 18, TypeScript, Tailwind CSS 4 |
| Build | electron-vite, Vite |
| Terminal emulator | xterm.js + node-pty |
| Code editor | CodeMirror 6 |
| Diff viewer | diff2html |
| Persistence | electron-store |

## Status

Relay is in active development at v0.1. It currently supports macOS only. Windows and Linux support are deferred to a future release.
