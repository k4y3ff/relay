# Product Spec: Relay

**Stack:** Electron · React · Tailwind CSS  
**Status:** Pre-development  
**Last updated:** 2026-03-26

---

## 1. Overview

Relay is a macOS-native-feeling desktop IDE that pairs a local git repository browser with an AI coding agent (Claude Code) and a per-worktree terminal. The user manages multiple git repos, each with one or more worktrees. Within a worktree the user can chat with Claude, review pending file changes, and run terminal commands — all in one window.

---

## 2. Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  [Traffic lights]  Relay                                         │  ← Title bar (vibrancy/translucent)
├──────────────┬───────────────────────────┬───────────────────────┤
│              │                           │  Changed Files        │
│   Sidebar    │     Chat / Diff Pane      │  (top-right)          │
│   (left)     │     (center, primary)     ├───────────────────────┤
│              │                           │  Terminal             │
│              │                           │  (bottom-right)       │
└──────────────┴───────────────────────────┴───────────────────────┘
```

**Panel sizing:**
- Sidebar: fixed 260px, not resizable in v1
- Center pane: flexible, takes remaining width minus right column
- Right column: fixed 320px, split 50/50 between Changed Files and Terminal; both vertically resizable
- All panels separated by 1px mac-border dividers

---

## 3. Sidebar

### 3.1 Structure

The sidebar lists git repositories. Each repo is collapsible. Beneath each repo is a collapsible list of its **worktrees**.

```
▾ my-app                          ← repo header (repo name)
      main                        ← worktree row (branch name)
      feature/payments            ← worktree row
      hotfix/typo                 ← worktree row
▾ api-service
      main
```

Repos are collapsible to just their header row. Worktree rows are flat with no further nesting in v1.

### 3.2 Repo Header

- Displays repo name (derived from folder name)
- Small icon indicating remote (GitHub logo for github.com)
- Collapse chevron
- ⋯ overflow menu: **Add worktree**, **Open in Finder**, **Remove from Relay**

**Add worktree flow:**
1. Clicking "Add worktree" opens a small modal prompting for a branch name (with a "Create new branch" checkbox, checked by default).
2. On confirm, Relay runs `git worktree add -b <branch> <path>` (path is auto-derived as a sibling directory: `<repo-root>/../<repo-name>-<branch>`).
3. The new worktree row appears immediately in the sidebar in a selected state.
4. A Claude Code subprocess and a terminal PTY session are pre-spawned for it so both panes are ready without waiting for the first user action.

### 3.3 Worktree Row

- Branch name as the primary label
- Full worktree path available as a tooltip on hover
- Clicking the row selects it as the active context — this:
  - Loads that worktree's changed files into the top-right pane
  - Brings that worktree's terminal session into focus in the bottom-right pane
  - Restores the chat session associated with that worktree in the center pane
- ⋯ overflow menu per worktree: Open in Finder, Copy path, Remove worktree

### 3.4 Add Repository

- "+ Add repository" button at the bottom of the sidebar
- Opens macOS native folder picker (dialog.showOpenDialog)
- App calls "git rev-parse --show-toplevel" to validate it's a git repo
- On success, repo is added and persisted to electron-store

---

## 4. Center Pane — Chat

The center pane is the primary interaction surface. It has two modes: **Chat mode** (default) and **Diff mode** (activated by clicking a file in the Changed Files pane).

### 4.1 Chat Mode

#### Message list

Each message occupies the full width of the pane with comfortable padding. Message types:

| Type | Rendering |
|---|---|
| User message | Right-aligned bubble, mac-surface2 background |
| Assistant text | Left-aligned, plain text with markdown rendering (bold, inline code, code blocks) |
| Tool call | Collapsible card (see §4.2) |
| File edit summary | Inline banner: "Edited src/App.tsx (+12 / -3)" with link to open diff |
| Thinking block | Collapsible, italicized, muted — collapsed by default |
| Error | Red-tinted inline banner |

#### Input area

- Pinned to the bottom of the pane
- Multi-line textarea, expands up to 5 lines then scrolls
- ⌘↵ to send; ↵ for newline
- Stop button appears while Claude is responding (sends interrupt signal to the CLI process)
- "New chat" button clears the session for the active worktree (with confirmation dialog)
- Session message count shown in muted text: "Session: 14 messages"

Note: Model selection and token estimates are not available in v1 since Claude Code CLI manages its own model configuration. Users change the model via "claude config" in their terminal as usual.

#### Session management

- Each worktree has its own chat session, keyed by worktree path
- Sessions are preserved in memory while the app is open; the Claude Code subprocess for each worktree remains alive between messages (so Claude retains its own context within the session)
- Starting a new chat kills the existing subprocess and spawns a fresh one

### 4.2 Tool Call Cards

When Claude Code invokes a tool, the corresponding event in the stream-json output is rendered as a card in the message stream:

```
┌─────────────────────────────────────┐
│ 🔧  Read file                  ▾   │
│  src/components/App.tsx             │
│  [142 lines returned]               │
└─────────────────────────────────────┘
```

Cards are collapsed by default; clicking expands to show full input parameters and output. Claude Code's built-in tools are rendered this way — Relay does not implement its own tools. Common cards users will see:

| Claude Code tool | Card label |
|---|---|
| Read | Read file |
| Write | Write file |
| Edit / MultiEdit | Edit file |
| Bash | Run command |
| Glob | Find files |
| Grep | Search files |
| TodoWrite / TodoRead | Update task list |

Any tool not in this list is rendered with a generic "🔧 Tool name" card.

When Claude Code edits a file, Relay detects the resulting change via the Changed Files pane's auto-refresh and inserts a file-edit summary banner inline in the chat:

```
  ✎  Edited src/components/App.tsx  +12 / -3   [View diff →]
```

### 4.3 Diff Mode

When a file is clicked in the Changed Files pane, the center pane switches to Diff Mode:

- Header bar shows: ← Back to chat · src/components/App.tsx · +12 / -3
- Renders a unified diff using diff2html
- Additions highlighted green, deletions red
- "Back to chat" returns to Chat Mode without losing scroll position

---

## 5. Top-Right Pane — Changed Files

Shows all files modified in the active worktree since the last commit (git diff HEAD + untracked files).

### 5.1 File List

Each row shows:

```
  M  src/components/App.tsx          +12  -3
  A  src/hooks/useSession.ts          +88
  D  src/utils/legacy.ts                   -40
  ?  .env.local
```

- Status indicator: M Modified · A Added · D Deleted · ? Untracked — color-coded
- Filename (path relative to repo root, truncated with tooltip)
- +N in green, -N in red (line counts from git diff --stat)
- Clicking any row switches the center pane to Diff Mode for that file

### 5.2 Header

- "Changes 10" title (count of changed files)
- Refresh button — re-runs git diff immediately
- Auto-refreshes every 3 seconds when the window is focused

### 5.3 Commit & Push

A **Commit** button sits in the footer of the Changed Files pane (disabled when there are no changes).

Flow when clicked:
1. Relay sends a message to the active worktree's Claude Code subprocess: "Please write a concise, conventional commit message for the following diff:" followed by the output of `git diff HEAD`.
2. The response is rendered as a normal assistant message in the chat pane so the user can see Claude's reasoning.
3. The suggested commit message is simultaneously populated into an editable text field that appears in the Changed Files pane footer, below the Commit button.
4. The user can edit the message directly in that field, then click **Confirm commit** to run `git commit -m "<message>"`.
5. After a successful commit, a **Push** button appears. Clicking it runs `git push` in the worktree directory and shows a spinner until complete. Push errors (e.g. no upstream set) are shown as an inline red banner.
6. The changed files list clears after a successful commit.

### 5.4 Empty State

When there are no changes: centered text "No changes since last commit" in muted color.

---

## 6. Bottom-Right Pane — Terminal

A full PTY terminal. Each worktree has its own terminal session — when you select a worktree in the sidebar, its terminal comes into view. Sessions are not destroyed when switching between worktrees; they remain alive in the background for the lifetime of the app.

### 6.1 Terminal behavior

- Uses node-pty in main process + xterm.js in renderer
- When a worktree is first selected, a PTY session is spawned with:
  - cwd set to the worktree path
  - Shell set to the user's $SHELL
  - Standard environment inherited, so tools like git, npm, claude, etc. work as expected
- Switching to a different worktree suspends the current terminal view and resumes the target worktree's session
- xterm-addon-fit keeps the terminal sized to the pane

### 6.2 Tab bar

- Supports multiple terminal tabs per worktree (up to 5)
- "+" button opens a new tab in the same worktree directory
- Tab label defaults to the shell name; right-click → rename / close

### 6.3 Toolbar

- Active worktree path shown in muted text: ~/code/my-app [feature/payments]
- ⌘K clears the terminal screen
- Copy-on-select enabled by default

---

## 7. Claude Code Integration

### 7.1 Approach

Relay integrates Claude by spawning the claude CLI as a subprocess in the active worktree's directory. This means:

- **No separate login required.** Users who have already authenticated via "claude login" in their terminal are automatically authenticated in Relay — credentials live in ~/.claude and are inherited by the subprocess.
- **No Anthropic API key stored in Relay.** Auth is fully delegated to the Claude Code CLI.
- **Model configuration is managed externally** via "claude config", as users already expect.

### 7.2 Subprocess lifecycle

Each worktree gets one long-lived claude subprocess per chat session. The subprocess is started when the user sends their first message to a worktree and kept alive until the user starts a new chat or closes the app. This allows Claude to retain context between messages within a session.

The subprocess is spawned as:

```
claude --output-format stream-json --cwd <worktree-path>
```

User messages are written to the subprocess's stdin. The subprocess streams newline-delimited JSON events to stdout.

### 7.3 Stream parsing

The stream-json output format emits a sequence of typed events. Relay parses and renders each event type:

| Event type | Relay behavior |
|---|---|
| assistant (text delta) | Appends text to the current assistant message bubble in real time |
| assistant (thinking delta) | Appends to a collapsible thinking block, collapsed by default |
| tool_use | Opens a new tool call card with a spinner |
| tool_result | Closes the spinner; populates the card's result section |
| result | Marks the turn as complete; shows cost/turn info in muted text if available |
| error | Renders a red inline error banner |

### 7.4 Interrupt / stop

When the user clicks the Stop button, Relay sends SIGINT to the subprocess. Claude Code handles this gracefully by stopping mid-response.

### 7.5 Startup validation

On launch, Relay checks that `claude` is available on the user's $PATH by running `claude --version`. If not found, a modal is shown with instructions to install Claude Code (`npm install -g @anthropic-ai/claude-code`).

If `claude` is found but the user is not authenticated, the first message to any worktree will return an auth error. Relay detects this error string in the stream output and replaces the normal error banner with a specific prompt: "You're not logged in to Claude Code. Run `claude login` in the terminal below to authenticate, then try again." The terminal pane is automatically brought into focus.

---

## 9. Data Persistence

All persistence is via electron-store. No secrets are stored in v1 — Claude Code and git auth are handled externally.

| Key | Contents |
|---|---|
| repos | Array of { path, remoteUrl, addedAt } |
| chatSessions | Map of worktreePath → MessageArray (for display replay only; subprocess is not resumed across restarts) |
| settings.theme | dark (only option in v1) |
| settings.shell | Override for terminal shell (defaults to $SHELL) |
| settings.autoRefreshInterval | Changed Files refresh cadence in seconds |

---

## 10. Settings Panel

Accessible via ⌘, or the gear icon at the bottom of the sidebar.

| Setting | Type | Default |
|---|---|---|
| Shell | text input | $SHELL env value |
| Auto-refresh interval | number input (seconds) | 3 |

Note: Claude Code authentication is managed outside of Relay via "claude login" / "claude config". There is intentionally no Claude-related configuration in Relay's Settings.

---

## 11. Window & macOS Integration

- titleBarStyle: 'hiddenInset' — traffic light buttons inset into the app chrome
- vibrancy: 'sidebar' applied to the sidebar background for frosted-glass effect
- transparent: true + rounded corners on the main window
- Dock icon: relay-themed icon (e.g., signal/wave motif)
- Menu bar: standard File / Edit / View / Window / Help
- ⌘W closes a terminal tab when terminal is focused; otherwise closes the window
- ⌘T opens a new terminal tab for the active worktree
- ⌘1 / ⌘2 / ... navigates between repos in the sidebar

---

## 12. v1 Scope (MVP)

**In scope:**
- Sidebar with repo → worktree hierarchy, repos collapsible; Add worktree modal that auto-spawns all sessions
- Chat pane with streaming Claude Code output, tool call cards, and thinking blocks
- File-edit summary banners inserted into chat as Claude Code writes files
- Changed Files pane (git diff HEAD + untracked) with click-to-diff
- Commit flow: Claude Code-generated message surfaced in an editable field, confirmed with `git commit`
- Push button post-commit (`git push`)
- Diff viewer in center pane (unified view)
- Per-worktree terminal sessions (PTY, multi-tab), persisted across worktree switches within a session
- Chat session message history persisted across restarts (for display; subprocess is not resumed)
- Not-logged-in detection with inline prompt to run `claude login`

**Out of scope for v1:**
- GitHub PR integration (deferred to v2)
- Side-by-side diff view
- GitLab / Bitbucket support
- Inline code suggestions / autocomplete
- Notifications / system alerts
- Windows / Linux support

---

## 13. Resolved Design Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Commit/push UI | Included. Claude Code generates the commit message via a chat turn; user edits and confirms in the Changed Files pane. Push button appears after a successful commit. |
| 2 | Context window management | Fully delegated to Claude Code — no intervention from Relay. |
| 3 | Tool approval for destructive operations | Fully deferred to Claude Code's own permission model. |
| 4 | Worktree creation UI | Modal with branch name input. Relay runs `git worktree add` and pre-spawns the Claude Code subprocess and terminal PTY automatically. |
| 5 | Claude Code not logged in | Relay detects the auth error in the stream output and shows an inline prompt directing the user to run `claude login` in the terminal pane, which is brought into focus. |
