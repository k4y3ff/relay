import { ipcMain, dialog, shell, BrowserWindow, Menu, MenuItem } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { store } from './store.js';
import type { Worktree, BranchTask, ManualTask, Task, TaskGroup, PersistedTaskGroup, PersistedTask, TaskStatus, ChangedFile } from '../renderer/types/repo.js';
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

async function deriveBranchTaskStatus(persisted: PersistedTask, storedStatus: TaskStatus): Promise<TaskStatus> {
  const worktreePath = persisted.worktreePath!;

  // If worktree directory is gone, task is done
  if (!fs.existsSync(worktreePath)) return 'done';

  // If user explicitly set blocked, preserve it
  if (storedStatus === 'blocked') return 'blocked';

  // Auto-derive: check for uncommitted changes
  try {
    const { stdout } = await execFileAsync('git', ['status', '--porcelain'], { cwd: worktreePath });
    if (stdout.trim().length > 0) return 'in-progress';
  } catch {
    // ignore — worktree may be inaccessible
  }

  // Preserve manually set in-progress or done; default to stored status (or todo)
  return storedStatus === 'done' ? 'todo' : storedStatus;
}

async function hydrateBranchTask(persisted: PersistedTask): Promise<BranchTask | null> {
  try {
    const branch = await getCurrentBranch(persisted.worktreePath!);
    const status = await deriveBranchTaskStatus(persisted, persisted.status);
    return {
      id: persisted.id,
      type: 'branch',
      title: persisted.title,
      status,
      repoRootPath: persisted.repoRootPath!,
      repoName: path.basename(persisted.repoRootPath!),
      worktree: { path: persisted.worktreePath!, branch, isMain: false, isBare: false },
    };
  } catch {
    return null;
  }
}

function hydrateManualTask(persisted: PersistedTask): ManualTask {
  return {
    id: persisted.id,
    type: 'manual',
    title: persisted.title,
    status: persisted.status,
  };
}

async function assembleTaskGroup(persisted: PersistedTaskGroup): Promise<TaskGroup> {
  const tasks: Task[] = [];
  for (const t of persisted.tasks) {
    if (t.type === 'branch') {
      const hydrated = await hydrateBranchTask(t);
      if (hydrated) tasks.push(hydrated);
    } else {
      tasks.push(hydrateManualTask(t));
    }
  }
  return { id: persisted.id, name: persisted.name, tasks };
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
      const group: PersistedTaskGroup = { id: randomUUID(), name, tasks: [] };
      const existing = store.get('taskGroups');
      store.set('taskGroups', [...existing, group]);
      return group;
    }
  );

  // taskgroups:remove — remove a task group and delete all associated worktrees
  ipcMain.handle('taskgroups:remove', async (_event, { groupId }: { groupId: string }): Promise<void> => {
    const existing = store.get('taskGroups');
    const group = existing.find((g) => g.id === groupId);

    if (group) {
      for (const task of group.tasks) {
        if (task.type === 'branch' && task.worktreePath && task.repoRootPath) {
          try {
            await execFileAsync('git', ['worktree', 'remove', task.worktreePath], { cwd: task.repoRootPath });
          } catch {
            try {
              await execFileAsync('git', ['worktree', 'remove', '--force', task.worktreePath], {
                cwd: task.repoRootPath,
              });
            } catch {
              // ignore: worktree may already be gone
            }
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

  // settings:get-sound-effects-enabled — return whether sound effects are enabled
  ipcMain.handle('settings:get-sound-effects-enabled', (): boolean => store.get('soundEffectsEnabled'));

  // settings:set-sound-effects-enabled — persist the sound effects preference
  ipcMain.handle('settings:set-sound-effects-enabled', (_event, { enabled }: { enabled: boolean }): void => {
    store.set('soundEffectsEnabled', enabled);
  });

  // settings:get-editor-theme — return the saved editor theme id
  ipcMain.handle('settings:get-editor-theme', (): string => store.get('editorTheme'));

  // settings:set-editor-theme — persist the editor theme preference
  ipcMain.handle('settings:set-editor-theme', (_event, { theme }: { theme: string }): void => {
    store.set('editorTheme', theme);
  });

  // settings:get-editor-word-wrap — return the saved word wrap preference
  ipcMain.handle('settings:get-editor-word-wrap', (): boolean => store.get('editorWordWrap'));

  // settings:set-editor-word-wrap — persist the word wrap preference
  ipcMain.handle('settings:set-editor-word-wrap', (_event, { enabled }: { enabled: boolean }): void => {
    store.set('editorWordWrap', enabled);
  });

  // taskgroups:add-branch — fetch default branch, create worktree off it, persist as a branch task
  ipcMain.handle(
    'taskgroups:add-branch',
    async (
      _event,
      { groupId, folderPath, branchName, defaultBranch }: { groupId: string; folderPath: string; branchName: string; defaultBranch: string }
    ): Promise<BranchTask> => {
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

      const newTask: PersistedTask = {
        id: randomUUID(),
        type: 'branch',
        status: 'todo',
        title: branchName,
        repoRootPath,
        worktreePath,
      };
      const existing = store.get('taskGroups');
      store.set(
        'taskGroups',
        existing.map((g) =>
          g.id === groupId ? { ...g, tasks: [...g.tasks, newTask] } : g
        )
      );

      const result: BranchTask = {
        id: newTask.id,
        type: 'branch',
        title: branchName,
        status: 'todo',
        repoRootPath,
        repoName,
        worktree: { path: worktreePath, branch: branchName, isMain: false, isBare: false },
      };
      return result;
    }
  );

  // taskgroups:add-manual-task — add a manual (checklist) task to a group
  ipcMain.handle(
    'taskgroups:add-manual-task',
    (_event, { groupId, title }: { groupId: string; title: string }): ManualTask => {
      const newTask: PersistedTask = {
        id: randomUUID(),
        type: 'manual',
        status: 'todo',
        title,
      };
      const existing = store.get('taskGroups');
      store.set(
        'taskGroups',
        existing.map((g) =>
          g.id === groupId ? { ...g, tasks: [...g.tasks, newTask] } : g
        )
      );
      return { id: newTask.id, type: 'manual', title, status: 'todo' };
    }
  );

  // taskgroups:remove-task — remove a task from a group; branch tasks also remove the worktree
  ipcMain.handle(
    'taskgroups:remove-task',
    async (
      _event,
      { groupId, taskId }: { groupId: string; taskId: string }
    ): Promise<void> => {
      const existing = store.get('taskGroups');
      const group = existing.find((g) => g.id === groupId);
      const task = group?.tasks.find((t) => t.id === taskId);

      if (task?.type === 'branch' && task.worktreePath && task.repoRootPath) {
        try {
          await execFileAsync('git', ['worktree', 'remove', task.worktreePath], { cwd: task.repoRootPath });
        } catch {
          try {
            await execFileAsync('git', ['worktree', 'remove', '--force', task.worktreePath], {
              cwd: task.repoRootPath,
            });
          } catch {
            // ignore: worktree may already be gone
          }
        }
      }

      store.set(
        'taskGroups',
        existing.map((g) =>
          g.id === groupId ? { ...g, tasks: g.tasks.filter((t) => t.id !== taskId) } : g
        )
      );
    }
  );

  // taskgroups:update-task-status — update a task's status (stored, overrides auto-derive)
  ipcMain.handle(
    'taskgroups:update-task-status',
    (_event, { groupId, taskId, status }: { groupId: string; taskId: string; status: TaskStatus }): void => {
      const existing = store.get('taskGroups');
      store.set(
        'taskGroups',
        existing.map((g) =>
          g.id === groupId
            ? { ...g, tasks: g.tasks.map((t) => (t.id === taskId ? { ...t, status } : t)) }
            : g
        )
      );
    }
  );

  // taskgroups:rename-task — rename a task's title
  ipcMain.handle(
    'taskgroups:rename-task',
    (_event, { groupId, taskId, title }: { groupId: string; taskId: string; title: string }): void => {
      const existing = store.get('taskGroups');
      store.set(
        'taskGroups',
        existing.map((g) =>
          g.id === groupId
            ? { ...g, tasks: g.tasks.map((t) => (t.id === taskId ? { ...t, title } : t)) }
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

  // fs:read-file — read raw file content, with binary detection
  ipcMain.handle(
    'fs:read-file',
    async (_event, { worktreePath, filePath }: { worktreePath: string; filePath: string }): Promise<{ content: string; isBinary: boolean }> => {
      const { readFile } = await import('node:fs/promises');
      const fullPath = path.join(worktreePath, filePath);
      const buf = await readFile(fullPath);
      const sample = buf.slice(0, 8192);
      const isBinary = sample.includes(0);
      if (isBinary) return { content: '', isBinary: true };
      return { content: buf.toString('utf-8'), isBinary: false };
    }
  );

  // fs:write-file — write content back to a file in the worktree
  ipcMain.handle(
    'fs:write-file',
    async (_event, { worktreePath, filePath, content }: { worktreePath: string; filePath: string; content: string }): Promise<void> => {
      const { writeFile } = await import('node:fs/promises');
      const fullPath = path.join(worktreePath, filePath);
      await writeFile(fullPath, content, 'utf-8');
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
