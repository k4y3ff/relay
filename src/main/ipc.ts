import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { store } from './store.js';
import type { Repo, Worktree, PersistedRepo } from '../renderer/types/repo.js';
import type { PersistedChatSession } from '../renderer/types/chat.js';
import type { ClaudeManager } from './claude.js';

const execFileAsync = promisify(execFile);

// ── Git helpers ────────────────────────────────────────────────────────────

async function getWorktrees(repoRoot: string): Promise<Worktree[]> {
  const { stdout } = await execFileAsync('git', ['worktree', 'list', '--porcelain'], {
    cwd: repoRoot,
  });

  const blocks = stdout.trim().split(/\n\n+/);
  return blocks
    .filter((b) => b.trim().length > 0)
    .map((block, index) => {
      const lines = block.trim().split('\n');
      const worktreeLine = lines.find((l) => l.startsWith('worktree '));
      const branchLine = lines.find((l) => l.startsWith('branch '));
      const isBare = lines.some((l) => l.trim() === 'bare');

      const wtPath = worktreeLine?.slice('worktree '.length) ?? '';
      const rawBranch = branchLine?.slice('branch '.length) ?? '';
      const branch = rawBranch.replace(/^refs\/heads\//, '') || '(detached)';

      return {
        path: wtPath,
        branch,
        isMain: index === 0,
        isBare,
      };
    });
}

async function getRemoteUrl(repoRoot: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['remote', 'get-url', 'origin'], {
      cwd: repoRoot,
    });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function assembleRepo(persisted: PersistedRepo): Promise<Repo> {
  const [worktrees, remote] = await Promise.all([
    getWorktrees(persisted.rootPath),
    getRemoteUrl(persisted.rootPath),
  ]);
  return {
    id: persisted.id,
    rootPath: persisted.rootPath,
    name: path.basename(persisted.rootPath),
    remote,
    worktrees,
  };
}

// ── IPC handlers ───────────────────────────────────────────────────────────

export function registerIpcHandlers(win: BrowserWindow, claude: ClaudeManager): void {
  // repos:list — hydrate all repos from store
  ipcMain.handle('repos:list', async (): Promise<Repo[]> => {
    const persisted = store.get('repos');
    const repos = await Promise.all(persisted.map(assembleRepo));
    return repos;
  });

  // repos:add — validate folder, persist, return assembled Repo
  ipcMain.handle('repos:add', async (_event, { folderPath }: { folderPath: string }): Promise<Repo> => {
    // Validate it's a git repo and get canonical root
    let rootPath: string;
    try {
      const { stdout } = await execFileAsync(
        'git',
        ['rev-parse', '--show-toplevel'],
        { cwd: folderPath }
      );
      rootPath = stdout.trim();
    } catch {
      throw new Error('NOT_A_GIT_REPO');
    }

    // Check not already added
    const existing = store.get('repos');
    if (existing.some((r) => r.id === rootPath)) {
      // Already present — just return it assembled
      return assembleRepo({ id: rootPath, rootPath });
    }

    const persisted: PersistedRepo = { id: rootPath, rootPath };
    store.set('repos', [...existing, persisted]);

    return assembleRepo(persisted);
  });

  // repos:remove — remove from store only, no filesystem changes
  ipcMain.handle('repos:remove', (_event, { repoId }: { repoId: string }): void => {
    const existing = store.get('repos');
    store.set('repos', existing.filter((r) => r.id !== repoId));
  });

  // worktrees:add — run git worktree add, return new Worktree
  ipcMain.handle(
    'worktrees:add',
    async (
      _event,
      { repoId, branchName, createNew }: { repoId: string; branchName: string; createNew: boolean }
    ): Promise<Worktree> => {
      const repos = store.get('repos');
      const repo = repos.find((r) => r.id === repoId);
      if (!repo) throw new Error('REPO_NOT_FOUND');

      const repoName = path.basename(repo.rootPath);
      const safeBranch = branchName.replace(/\//g, '-');
      const worktreePath = path.join(repo.rootPath, '..', `${repoName}-${safeBranch}`);

      const args = createNew
        ? ['worktree', 'add', '-b', branchName, worktreePath]
        : ['worktree', 'add', worktreePath, branchName];

      await execFileAsync('git', args, { cwd: repo.rootPath });

      // Find the newly added worktree in the list
      const worktrees = await getWorktrees(repo.rootPath);
      const newWt = worktrees.find((wt) => wt.path === worktreePath);
      if (!newWt) throw new Error('WORKTREE_NOT_FOUND_AFTER_ADD');
      return newWt;
    }
  );

  // worktrees:remove — run git worktree remove
  ipcMain.handle(
    'worktrees:remove',
    async (_event, { repoId, worktreePath }: { repoId: string; worktreePath: string }): Promise<void> => {
      const repos = store.get('repos');
      const repo = repos.find((r) => r.id === repoId);
      if (!repo) throw new Error('REPO_NOT_FOUND');

      try {
        await execFileAsync('git', ['worktree', 'remove', worktreePath], { cwd: repo.rootPath });
      } catch {
        await execFileAsync('git', ['worktree', 'remove', '--force', worktreePath], {
          cwd: repo.rootPath,
        });
      }
    }
  );

  // dialog:open-folder — native folder picker
  ipcMain.handle('dialog:open-folder', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  // shell:open-path — open in Finder / default handler
  ipcMain.handle('shell:open-path', (_event, { path: p }: { path: string }): void => {
    shell.openPath(p);
  });

  // ── Claude Code channels ──────────────────────────────────────────────────

  ipcMain.handle(
    'claude:send-message',
    (_event, { worktreePath, text }: { worktreePath: string; text: string }): void => {
      claude.sendMessage(worktreePath, text);
    }
  );

  ipcMain.handle(
    'claude:new-chat',
    (_event, { worktreePath }: { worktreePath: string }): void => {
      claude.newChat(worktreePath);
    }
  );

  ipcMain.handle(
    'claude:stop',
    (_event, { worktreePath }: { worktreePath: string }): void => {
      claude.stop(worktreePath);
    }
  );

  ipcMain.handle(
    'claude:get-diff',
    async (
      _event,
      { worktreePath, filePath }: { worktreePath: string; filePath: string }
    ): Promise<string> => {
      try {
        const { stdout } = await execFileAsync(
          'git',
          ['diff', 'HEAD', '--', filePath],
          { cwd: worktreePath }
        );
        // If no staged/unstaged diff, try showing untracked file content
        if (!stdout) {
          const { stdout: catOut } = await execFileAsync(
            'git',
            ['diff', '--cached', '--', filePath],
            { cwd: worktreePath }
          );
          return catOut;
        }
        return stdout;
      } catch {
        return '';
      }
    }
  );

  ipcMain.handle(
    'claude:validate',
    async (): Promise<{ ok: boolean; version?: string }> => {
      try {
        const { stdout } = await execFileAsync('claude', ['--version']);
        return { ok: true, version: stdout.trim() };
      } catch {
        return { ok: false };
      }
    }
  );

  // ── Chat session persistence ──────────────────────────────────────────────

  ipcMain.handle(
    'chat:sessions:load',
    (_event, { worktreePath }: { worktreePath: string }): PersistedChatSession | null => {
      const sessions = store.get('chatSessions');
      return sessions.find((s) => s.worktreePath === worktreePath) ?? null;
    }
  );

  ipcMain.handle(
    'chat:sessions:save',
    (_event, { session }: { session: PersistedChatSession }): void => {
      const sessions = store.get('chatSessions');
      const filtered = sessions.filter((s) => s.worktreePath !== session.worktreePath);
      store.set('chatSessions', [...filtered, session]);
    }
  );
}
