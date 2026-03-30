# Security Evaluation

**Subject:** Relay v0.1.0
**Evaluator role:** Lead Security Engineer
**Scope:** Enterprise suitability assessment
**Date:** 2026-03-29

---

## Executive Summary

Relay is a macOS-only Electron desktop application that integrates git worktree management with the Claude Code CLI. It runs locally on developer workstations, reads and writes source code files, spawns shell processes with full user-level privileges, and proxies terminal I/O to an AI coding assistant.

**Overall risk rating: MEDIUM**

Relay has sound fundamentals: Electron's `contextIsolation` is enabled, `nodeIntegration` is disabled, file reads and writes are scoped to worktree paths, and no credentials are stored by the application. However, several issues warrant attention before broad enterprise deployment, most significantly the unsandboxed renderer, the full-environment PTY inheritance, and the unencrypted local data store.

---

## Threat Model

**Who uses it:** Software engineers on macOS workstations with access to source code repositories and Claude Code credentials.

**What it touches:**
- Local git repositories and worktree directories on disk
- The user's shell environment (PATH, git credentials, SSH keys, environment variables)
- The Claude Code CLI process (which communicates with Anthropic's API)
- macOS notification system
- Arbitrary file paths within configured worktrees

**What it does not touch:**
- Network sockets directly (all API traffic goes through the `claude` subprocess)
- Browser cookies, system keychains, or credential stores
- Any data outside the user's configured worktrees directory

---

## Finding 1: Renderer sandbox is disabled — MEDIUM

**Location:** `src/main/window.ts:24`

```ts
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: false,       // ← renderer runs unsandboxed
}
```

`sandbox: false` is required because `node-pty` is a native Node module that can only run in the main process, and electron-vite's dev server needs certain Node capabilities during development. In production the renderer itself has no Node access (contextIsolation is on, nodeIntegration is off), so the practical blast radius of a renderer compromise is limited to what can be done via the IPC bridge.

However, an unsandboxed renderer means that a renderer-level exploit (e.g. a vulnerability in xterm.js, diff2html, or react-markdown triggered by malicious repository content) would not be contained by the OS-level sandbox that Electron's sandbox mode provides.

**Recommendation:** Evaluate whether the dev-server dependency on `sandbox: false` can be removed for production builds. The native `node-pty` module does not require a sandboxed renderer; only certain dev-mode tooling does. A production build with `sandbox: true` would meaningfully reduce exploit surface.

---

## Finding 2: PTY sessions inherit the full parent environment — MEDIUM

**Location:** `src/main/terminal.ts:32` and `src/main/shell.ts:21`

```ts
// TerminalManager (terminal.ts:27–33)
const proc = pty.spawn(shell, ['-l', '-c', 'claude'], {
  name: 'xterm-256color',
  cols,
  rows,
  cwd: worktreePath,
  env: process.env as Record<string, string>,
});

// ShellManager (shell.ts:16–22)
const proc = pty.spawn(shell, ['-l'], {
  name: 'xterm-256color',
  cols,
  rows,
  cwd,
  env: process.env as Record<string, string>,
});
```

Both the Claude PTY sessions (`TerminalManager`) and shell tab PTYs (`ShellManager`) inherit `process.env` in its entirety. This means any secrets present in the user's environment at launch time — AWS credentials, API tokens, SSH agent sockets, proxy passwords — are visible to:

1. The spawned shell process
2. The `claude` CLI subprocess
3. Any code that Claude Code executes on the user's behalf (e.g. shell commands Claude runs during agentic tasks)

This is consistent with how developers use a terminal directly, so it is not unexpected behavior. However, enterprises that enforce credential hygiene via environment-variable injection (e.g., Vault agent sidecar patterns, credential-scoped shells) should be aware that Relay does not scope or filter the inherited environment.

**Recommendation:** Document this behavior explicitly for end users. Consider an enterprise configuration option to explicitly allowlist environment variables passed to PTY sessions, preventing accidental forwarding of credentials that were intended only for the parent shell.

---

## Finding 3: File paths are not fully validated against worktree root — MEDIUM

**Location:** `src/main/ipc.ts:618–640` and `src/main/ipc.ts:642–665`

```ts
// fs:read-file (ipc.ts:623–624)
const fullPath = path.join(worktreePath, filePath);
const buf = await readFile(fullPath);

// fs:write-file (ipc.ts:637–638)
const fullPath = path.join(worktreePath, filePath);
await writeFile(fullPath, content, 'utf-8');

// git:diff-file — untracked branch (ipc.ts:650–655)
const fullPath = path.join(worktreePath, filePath);
const { stdout } = await execFileAsync(
  'git',
  ['diff', '--no-index', '/dev/null', fullPath],
  { cwd: worktreePath }
).catch((e: { stdout: string }) => ({ stdout: e.stdout ?? '' }));
```

`path.join` resolves `..` components, meaning a renderer-supplied `filePath` of `../../etc/passwd` would resolve to a path outside the worktree. All three handlers — `fs:read-file`, `fs:write-file`, and the untracked branch of `git:diff-file` — share this pattern. The tracked-file branch of `git:diff-file` passes `filePath` directly as a git argument (safe from shell injection, but the same traversal logic applies). While `contextIsolation` prevents arbitrary JavaScript from calling these handlers, a compromised renderer (or a renderer tricked via malicious repo content into invoking file operations on attacker-controlled paths) could read or overwrite files outside the intended worktree.

**Recommendation:** Add an explicit containment check before I/O operations:

```ts
const fullPath = path.resolve(worktreePath, filePath);
if (!fullPath.startsWith(path.resolve(worktreePath) + path.sep)) {
  throw new Error('PATH_TRAVERSAL_REJECTED');
}
```

This is a defense-in-depth measure. The actual risk is low given the IPC model, but the fix is trivial and eliminates a class of vulnerability entirely.

---

## Finding 4: IPC channels are not allowlisted — LOW

**Location:** `src/preload/index.ts:8`

```ts
invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
```

The preload bridge forwards any channel name to `ipcRenderer.invoke` without an allowlist. This means renderer code can attempt to invoke any channel that happens to be registered in the main process. In the current codebase this is not exploitable beyond the 32 application-defined handlers, but it is a latent risk: if a dependency or future developer adds a sensitive IPC handler, the renderer will be able to call it without any explicit grant.

**Recommendation:** Add a channel allowlist to the preload bridge:

```ts
const ALLOWED_CHANNELS = new Set([
  'taskgroups:list', 'taskgroups:create', /* ... */
]);

invoke: (channel: string, ...args: unknown[]) => {
  if (!ALLOWED_CHANNELS.has(channel)) throw new Error(`IPC channel not allowed: ${channel}`);
  return ipcRenderer.invoke(channel, ...args);
},
```

---

## Finding 5: Data store is unencrypted — LOW

**Location:** `src/main/store.ts`

electron-store persists application data to `~/Library/Application Support/relay/config.json` as plain JSON. The data stored includes:

- Absolute paths to git repositories and worktree directories
- Task group names and branch names
- User preferences (theme, editor word-wrap, notification and sound settings)
- `customSoundPath` — a user-supplied absolute file path to a custom notification sound

No credentials, tokens, or file contents are stored. The paths and names could be sensitive in high-security environments where the existence of certain projects is itself confidential. The `customSoundPath` field is a new addition that stores an arbitrary user-supplied filesystem path in plaintext.

**Recommendation:** For regulated environments, consider enabling electron-store's built-in encryption (`encryptionKey` option) or noting in deployment guidance that the config file contains repository path metadata.

---

## Finding 6: Context menu items are renderer-controlled — LOW

**Location:** `src/main/ipc.ts:282–309`

The `menu:show-context-menu` handler builds a native macOS menu from renderer-supplied label strings without sanitization. Labels are displayed in the OS context menu UI and are not interpreted as code, so there is no injection risk. However, an attacker with renderer control could display misleading UI (e.g. a fake "Grant Full Disk Access" menu item).

**Recommendation:** This is acceptable given the current threat model. If renderer sandboxing is added (Finding 1), this risk is further mitigated.

---

## Finding 7: `shell:open-path` opens arbitrary paths — LOW

**Location:** `src/main/ipc.ts:555–557`

```ts
ipcMain.handle('shell:open-path', (_event, { path: p }: { path: string }): void => {
  shell.openPath(p);
});
```

The `shell:open-path` handler accepts a renderer-supplied path and opens it via the macOS default application with no validation. This is used to reveal files in Finder. A renderer-side attacker could pass any path — including sensitive files outside the worktree — causing them to be opened in whatever application the OS associates with that file type. The practical impact is limited to UI-level interaction (no data exfiltration over the IPC bridge), but it bypasses the intended worktree scope.

**Recommendation:** Validate that `p` resolves to a path within the configured worktrees directory before calling `shell.openPath`.

---

## Finding 8: No Content-Security-Policy in renderer HTML — INFORMATIONAL

**Location:** `src/renderer/index.html`

The renderer's `index.html` has no `Content-Security-Policy` meta tag. In production, `nodeIntegration: false`, `contextIsolation: true`, and the absence of remote URLs make XSS difficult to exploit. However, a CSP would add a further layer of defense against script injection from malicious repository content rendered by the app (e.g. via react-markdown, diff2html, or xterm.js).

**Recommendation:** Add a restrictive CSP:

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'">
```

(`unsafe-inline` for styles is typically necessary for CSS-in-JS solutions like Tailwind/Emotion.)

---

## Finding 9: Claude response completion detection is heuristic — INFORMATIONAL

**Location:** `src/main/terminal.ts:36–48`

Claude completion is detected by a 1500ms idle timer on PTY output. Notifications ("Claude finished on `<branch>`") are fired based on this heuristic. A slow network response or a Claude command that produces no output for >1.5 seconds will trigger a false positive notification. This is a product quality issue rather than a security issue, but it is noted because the notification content (`groupName`, `branchName`) is derived from the store — not from sanitized user input — and is displayed in the macOS notification center.

---

## Positive Findings

The following security properties are correctly implemented:

- **`nodeIntegration: false`** — renderer cannot access Node.js APIs directly
- **`contextIsolation: true`** — renderer JavaScript runs in a separate context from the preload script
- **No credential storage** — the application stores no API keys, passwords, or tokens. Claude Code authentication is handled entirely by the CLI at `~/.claude`
- **Git operations use `execFile`** — git subcommands are invoked via `execFile` (not `exec` or `shell: true`), which prevents shell injection from branch names or file paths containing shell metacharacters
- **Binary file detection** — `fs:read-file` checks the first 8KB for null bytes and refuses to return binary content as a string, preventing large binary files from being sent over IPC
- **No remote content loaded** — the renderer loads a local `index.html` in production. No remote URLs are loaded into the application window
- **Notifications contain minimal data** — notification body contains only task group name and branch name, not file contents or Claude output

---

## Summary Table

| Finding | Severity | Effort to Fix |
|---|---|---|
| Renderer sandbox disabled | MEDIUM | Medium |
| PTY inherits full environment | MEDIUM | Low–Medium |
| No path traversal guard on file I/O (fs:read-file, fs:write-file, git:diff-file) | MEDIUM | Low |
| IPC channels not allowlisted | LOW | Low |
| Data store unencrypted | LOW | Low |
| Context menu labels unvalidated | LOW | Negligible |
| shell:open-path opens arbitrary paths | LOW | Low |
| No Content-Security-Policy in renderer | INFORMATIONAL | Low |

---

## Recommendation for Enterprise Deployment

Relay is suitable for use by individual developers on managed macOS workstations where the user already has the ability to run arbitrary shell commands and access to their own source code repositories. The risk profile is comparable to running VS Code or any other local IDE that can spawn terminals.

Before broad enterprise deployment, the following should be addressed in priority order:

1. Add path traversal guards to `fs:read-file` and `fs:write-file` (Finding 3) — trivial fix, eliminates a class of vulnerability
2. Add an IPC channel allowlist to the preload bridge (Finding 4) — low effort, prevents future handler exposure
3. Evaluate enabling `sandbox: true` for production builds (Finding 1) — more complex but meaningfully improves defense-in-depth
4. Document the environment inheritance behavior for security-conscious users (Finding 2)
