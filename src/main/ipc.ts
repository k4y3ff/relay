import { ipcMain, dialog, shell, BrowserWindow, Menu, MenuItem } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { store } from './store.js';
import type { Worktree, BranchEntry, TaskGroup, PersistedTaskGroup, PersistedBranch, ChangedFile } from '../renderer/types/repo.js';
import type { TerminalManager } from './terminal.js';
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

async function getCurrentBranch(worktreePath: string): Promise<string> {
  const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: worktreePath });
  const branch = stdout.trim();
  return branch === 'HEAD' ? '(detached)' : branch;
}

async function hydrateBranch(persisted: PersistedBranch): Promise<BranchEntry | null> {
  try {
    const branch = await getCurrentBranch(persisted.worktreePath);
    return {
      repoRootPath: persisted.repoRootPath,
      repoName: path.basename(persisted.repoRootPath),
      worktree: { path: persisted.worktreePath, branch, isMain: false, isBare: false },
    };
  } catch {
    return null;
  }
}

async function assembleTaskGroup(persisted: PersistedTaskGroup): Promise<TaskGroup> {
  const branchResults = await Promise.all(persisted.branches.map(hydrateBranch));
  return {
    id: persisted.id,
    name: persisted.name,
    branches: branchResults.filter((b): b is BranchEntry => b !== null),
  };
}

// ── IPC handlers ───────────────────────────────────────────────────────────

export function registerIpcHandlers(win: BrowserWindow, terminal: TerminalManager, shellManager: ShellManager): void {
  // taskgroups:list — hydrate all task groups from store
  ipcMain.handle('taskgroups:list', async (): Promise<TaskGroup[]> => {
    const persisted = store.get('taskGroups');
    return Promise.all(persisted.map(assembleTaskGroup));
  });

  // taskgroups:create — create a new empty task group
  ipcMain.handle(
    'taskgroups:create',
    (_event, { name }: { name: string }): PersistedTaskGroup => {
      const group: PersistedTaskGroup = { id: randomUUID(), name, branches: [] };
      const existing = store.get('taskGroups');
      store.set('taskGroups', [...existing, group]);
      return group;
    }
  );

  // taskgroups:remove — remove a task group and delete all associated worktrees from filesystem
  ipcMain.handle('taskgroups:remove', async (_event, { groupId }: { groupId: string }): Promise<void> => {
    const existing = store.get('taskGroups');
    const group = existing.find((g) => g.id === groupId);

    if (group) {
      for (const branch of group.branches) {
        try {
          await execFileAsync('git', ['worktree', 'remove', branch.worktreePath], { cwd: branch.repoRootPath });
        } catch {
          try {
            await execFileAsync('git', ['worktree', 'remove', '--force', branch.worktreePath], {
              cwd: branch.repoRootPath,
            });
          } catch {
            // ignore: worktree may already be gone
          }
        }
      }
    }

    store.set('taskGroups', existing.filter((g) => g.id !== groupId));
  });

  // taskgroups:rename — rename a task group
  ipcMain.handle(
    'taskgroups:rename',
    (_event, { groupId, name }: { groupId: string; name: string }): void => {
      const existing = store.get('taskGroups');
      store.set(
        'taskGroups',
        existing.map((g) => (g.id === groupId ? { ...g, name } : g))
      );
    }
  );

  // git:get-repo-info — resolve repo root and look up (or auto-detect) default branch
  ipcMain.handle(
    'git:get-repo-info',
    async (_event, { folderPath }: { folderPath: string }): Promise<{ repoRootPath: string; repoName: string; defaultBranch: string | null }> => {
      let repoRootPath: string;
      try {
        const { stdout } = await execFileAsync('git', ['rev-parse', '--show-toplevel'], { cwd: folderPath });
        repoRootPath = stdout.trim();
      } catch {
        throw new Error('NOT_A_GIT_REPO');
      }

      const repoName = path.basename(repoRootPath);
      const repoDefaults = store.get('repoDefaults');
      let defaultBranch: string | null = repoDefaults[repoRootPath] ?? null;

      if (!defaultBranch) {
        try {
          const { stdout } = await execFileAsync(
            'git', ['symbolic-ref', 'refs/remotes/origin/HEAD', '--short'],
            { cwd: repoRootPath }
          );
          defaultBranch = stdout.trim().replace(/^origin\//, '') || null;
        } catch {
          // not detectable — user must enter manually
        }
      }

      return { repoRootPath, repoName, defaultBranch };
    }
  );

  // settings:get-worktrees-dir — return the configured worktrees directory
  ipcMain.handle('settings:get-worktrees-dir', (): string | null => store.get('worktreesDir'));

  // settings:set-worktrees-dir — persist the worktrees directory
  ipcMain.handle('settings:set-worktrees-dir', (_event, { dir }: { dir: string }): void => {
    store.set('worktreesDir', dir);
  });

  // settings:get-notifications-enabled — return whether notifications are enabled
  ipcMain.handle('settings:get-notifications-enabled', (): boolean => store.get('notificationsEnabled'));

  // settings:set-notifications-enabled — persist the notifications preference
  ipcMain.handle('settings:set-notifications-enabled', (_event, { enabled }: { enabled: boolean }): void => {
    store.set('notificationsEnabled', enabled);
  });

  // taskgroups:add-branch — fetch default branch, create worktree off it, persist
  ipcMain.handle(
    'taskgroups:add-branch',
    async (
      _event,
      { groupId, folderPath, branchName, defaultBranch }: { groupId: string; folderPath: string; branchName: string; defaultBranch: string }
    ): Promise<BranchEntry> => {
      const worktreesDir = store.get('worktreesDir');
      if (!worktreesDir) throw new Error('WORKTREES_DIR_NOT_SET');

      let repoRootPath: string;
      try {
        const { stdout } = await execFileAsync('git', ['rev-parse', '--show-toplevel'], { cwd: folderPath });
        repoRootPath = stdout.trim();
      } catch {
        throw new Error('NOT_A_GIT_REPO');
      }

      // Save default branch for this repo
      const repoDefaults = store.get('repoDefaults');
      store.set('repoDefaults', { ...repoDefaults, [repoRootPath]: defaultBranch });

      const repoName = path.basename(repoRootPath);
      const worktreePath = path.join(worktreesDir, repoName, branchName);

      // Fetch latest of default branch then create worktree off origin/<defaultBranch>
      await execFileAsync('git', ['fetch', 'origin', defaultBranch], { cwd: repoRootPath });
      try {
        await execFileAsync(
          'git',
          ['worktree', 'add', '-b', branchName, worktreePath, `origin/${defaultBranch}`],
          { cwd: repoRootPath }
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes('already exists')) throw err;
        // Branch exists — check it out in the new worktree without -b
        await execFileAsync(
          'git',
          ['worktree', 'add', worktreePath, branchName],
          { cwd: repoRootPath }
        );
      }

      const newWt: Worktree = { path: worktreePath, branch: branchName, isMain: false, isBare: false };
      const persistedBranch: PersistedBranch = { repoRootPath, worktreePath };
      const existing = store.get('taskGroups');
      store.set(
        'taskGroups',
        existing.map((g) =>
          g.id === groupId ? { ...g, branches: [...g.branches, persistedBranch] } : g
        )
      );

      return { repoRootPath, repoName, worktree: newWt };
    }
  );

  // taskgroups:remove-branch — remove worktree from filesystem and from group
  ipcMain.handle(
    'taskgroups:remove-branch',
    async (
      _event,
      { groupId, worktreePath, repoRootPath }: { groupId: string; worktreePath: string; repoRootPath: string }
    ): Promise<void> => {
      try {
        await execFileAsync('git', ['worktree', 'remove', worktreePath], { cwd: repoRootPath });
      } catch {
        await execFileAsync('git', ['worktree', 'remove', '--force', worktreePath], { cwd: repoRootPath });
      }

      const existing = store.get('taskGroups');
      store.set(
        'taskGroups',
        existing.map((g) =>
          g.id === groupId
            ? { ...g, branches: g.branches.filter((b) => b.worktreePath !== worktreePath) }
            : g
        )
      );
    }
  );

  // menu:show-context-menu — show a native macOS context menu
  ipcMain.handle(
    'menu:show-context-menu',
    (
      event,
      { menuId, items }: { menuId: string; items: { label: string; enabled?: boolean; separator?: boolean }[] }
    ): void => {
      const menu = new Menu();
      items.forEach((item, index) => {
        if (item.separator) {
          menu.append(new MenuItem({ type: 'separator' }));
        } else {
          menu.append(
            new MenuItem({
              label: item.label,
              enabled: item.enabled !== false,
              click: () => {
                const senderWindow = BrowserWindow.fromWebContents(event.sender);
                if (senderWindow) {
                  event.sender.send('menu:item-clicked', { menuId, itemIndex: index });
                }
              },
            })
          );
        }
      });
      menu.popup({ window: BrowserWindow.fromWebContents(event.sender) ?? undefined });
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

  // git:all-files — list all tracked files in the worktree
  ipcMain.handle(
    'git:all-files',
    async (_event, { worktreePath }: { worktreePath: string }): Promise<string[]> => {
      const { stdout } = await execFileAsync('git', ['ls-files'], { cwd: worktreePath })
        .catch(() => ({ stdout: '' }));
      return stdout.trim().split('\n').filter(Boolean);
    }
  );

  // fs:read-file — read raw file content
  ipcMain.handle(
    'fs:read-file',
    async (_event, { worktreePath, filePath }: { worktreePath: string; filePath: string }): Promise<string> => {
      const { readFile } = await import('node:fs/promises');
      const fullPath = path.join(worktreePath, filePath);
      return readFile(fullPath, 'utf-8');
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

  // ── Terminal channels ──────────────────────────────────────────────────────

  ipcMain.handle(
    'terminal:create',
    (_event, { worktreePath, cols, rows }: { worktreePath: string; cols: number; rows: number }): void => {
      terminal.create(worktreePath, cols, rows);
    }
  );

  ipcMain.handle(
    'terminal:write',
    (_event, { worktreePath, data }: { worktreePath: string; data: string }): void => {
      terminal.write(worktreePath, data);
    }
  );

  ipcMain.handle(
    'terminal:resize',
    (_event, { worktreePath, cols, rows }: { worktreePath: string; cols: number; rows: number }): void => {
      terminal.resize(worktreePath, cols, rows);
    }
  );

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
