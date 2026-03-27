import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { store } from './store.js';
import type { Repo, Worktree, PersistedRepo, ChangedFile } from '../renderer/types/repo.js';
import type { ClaudeManager } from './claude.js';
import type { ShellManager } from './shell.js';

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

export function registerIpcHandlers(win: BrowserWindow, claudeManager: ClaudeManager, shellManager: ShellManager): void {
  // repos:list — hydrate all repos from store
  ipcMain.handle('repos:list', async (): Promise<Repo[]> => {
    const persisted = store.get('repos');
    const repos = await Promise.all(persisted.map(assembleRepo));
    return repos;
  });

  // repos:add — validate folder, persist, return assembled Repo
  ipcMain.handle('repos:add', async (_event, { folderPath }: { folderPath: string }): Promise<Repo> => {
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

    const existing = store.get('repos');
    if (existing.some((r) => r.id === rootPath)) {
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

  // git:changed-files — list modified/added/deleted/untracked files with line counts
  ipcMain.handle(
    'git:changed-files',
    async (_event, { worktreePath }: { worktreePath: string }): Promise<ChangedFile[]> => {
      // Get status + numstat for tracked changes
      const [nameStatusResult, numStatResult, untrackedResult] = await Promise.all([
        execFileAsync('git', ['diff', 'HEAD', '--name-status'], { cwd: worktreePath }).catch(() => ({ stdout: '' })),
        execFileAsync('git', ['diff', 'HEAD', '--numstat'], { cwd: worktreePath }).catch(() => ({ stdout: '' })),
        execFileAsync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: worktreePath }).catch(() => ({ stdout: '' })),
      ]);

      // Build a map of filename -> { added, deleted } from --numstat
      const statMap = new Map<string, { added: number; deleted: number }>();
      for (const line of numStatResult.stdout.trim().split('\n').filter(Boolean)) {
        const parts = line.split('\t');
        if (parts.length >= 3) {
          statMap.set(parts[2], {
            added: parseInt(parts[0], 10) || 0,
            deleted: parseInt(parts[1], 10) || 0,
          });
        }
      }

      const files: ChangedFile[] = [];

      // Parse --name-status lines (M/A/D + filename)
      for (const line of nameStatusResult.stdout.trim().split('\n').filter(Boolean)) {
        const tab = line.indexOf('\t');
        if (tab === -1) continue;
        const rawStatus = line.slice(0, tab).trim();
        const filePath = line.slice(tab + 1).trim();
        const status = (rawStatus[0] as 'M' | 'A' | 'D') ?? 'M';
        const stat = statMap.get(filePath) ?? { added: 0, deleted: 0 };
        files.push({ path: filePath, status, ...stat });
      }

      // Add untracked files
      for (const filePath of untrackedResult.stdout.trim().split('\n').filter(Boolean)) {
        files.push({ path: filePath, status: '?', added: 0, deleted: 0 });
      }

      return files;
    }
  );

  // git:diff-file — return unified diff string for a single file
  ipcMain.handle(
    'git:diff-file',
    async (
      _event,
      { worktreePath, filePath, untracked }: { worktreePath: string; filePath: string; untracked: boolean }
    ): Promise<string> => {
      if (untracked) {
        const fullPath = path.join(worktreePath, filePath);
        const { stdout } = await execFileAsync(
          'git',
          ['diff', '--no-index', '/dev/null', fullPath],
          { cwd: worktreePath }
        ).catch((e: { stdout: string }) => ({ stdout: e.stdout ?? '' }));
        console.log(`[git:diff-file] untracked ${filePath}: ${stdout.length} bytes`);
        return stdout;
      }
      const { stdout } = await execFileAsync('git', ['diff', 'HEAD', '--', filePath], {
        cwd: worktreePath,
      });
      console.log(`[git:diff-file] tracked ${filePath}: ${stdout.length} bytes`);
      return stdout;
    }
  );

  // ── Claude channels ────────────────────────────────────────────────────────

  ipcMain.handle('claude:validate', async (): Promise<{ installed: boolean }> => {
    return claudeManager.validate();
  });

  ipcMain.handle(
    'claude:send',
    (_event, { worktreePath, text }: { worktreePath: string; text: string }): void => {
      claudeManager.send(worktreePath, text);
    }
  );

  ipcMain.handle(
    'claude:stop',
    (_event, { worktreePath }: { worktreePath: string }): void => {
      claudeManager.stop(worktreePath);
    }
  );

  ipcMain.handle(
    'claude:new-chat',
    (_event, { worktreePath }: { worktreePath: string }): void => {
      claudeManager.newChat(worktreePath);
    }
  );

  ipcMain.handle(
    'claude:persist-sessions',
    (_event, { sessions }: { sessions: Record<string, unknown[]> }): void => {
      store.set('chatSessions', sessions as Record<string, import('../renderer/types/chat.js').ChatMessage[]>);
    }
  );

  ipcMain.handle('claude:load-sessions', (): Record<string, unknown[]> => {
    return store.get('chatSessions') as Record<string, unknown[]>;
  });

  // ── Shell channels (per-tab PTY sessions for the terminal pane) ────────────

  ipcMain.handle(
    'shell:create',
    (_event, { tabId, cwd, cols, rows }: { tabId: string; cwd: string; cols: number; rows: number }): void => {
      shellManager.create(tabId, cwd, cols, rows);
    }
  );

  ipcMain.handle(
    'shell:write',
    (_event, { tabId, data }: { tabId: string; data: string }): void => {
      shellManager.write(tabId, data);
    }
  );

  ipcMain.handle(
    'shell:resize',
    (_event, { tabId, cols, rows }: { tabId: string; cols: number; rows: number }): void => {
      shellManager.resize(tabId, cols, rows);
    }
  );

  ipcMain.handle(
    'shell:close',
    (_event, { tabId }: { tabId: string }): void => {
      shellManager.close(tabId);
    }
  );
}
