import type { Repo } from '../../types/repo';
import { useRepo } from '../../context/RepoContext';
import RepoHeader from './RepoHeader';
import WorktreeRow from './WorktreeRow';

interface RepoSectionProps {
  repo: Repo;
  onAddWorktree: (repoId: string) => void;
}

export default function RepoSection({ repo, onAddWorktree }: RepoSectionProps) {
  const { collapsedRepos } = useRepo();
  const isCollapsed = collapsedRepos.has(repo.id);

  return (
    <div>
      <RepoHeader repo={repo} onAddWorktree={() => onAddWorktree(repo.id)} />
      {!isCollapsed &&
        repo.worktrees.map((wt) => (
          <WorktreeRow key={wt.path} repo={repo} worktree={wt} />
        ))}
    </div>
  );
}
