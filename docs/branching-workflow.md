# Branching workflow: `develop` and `main`

## The two long-lived branches

- **`develop`**: where all daily work lands. Everyone opens pull requests (PRs) into `develop`. It is the default branch.
- **`main`**: the stable branch. It only changes when the team promotes `develop` at the end of a sprint (a "release PR").

Both branches are protected: nobody pushes to them directly, every change needs a PR, one approval from someone else, and green CI (both checks).

## Merge method: merge commits only

Squash merging and rebase merging are disabled. Every PR is merged with the **Create a merge commit** button. Because squash is off, every commit inside a branch stays in the history, so write clean commit messages (Conventional Commits).

Why we do not squash `develop` into `main`: squashing replaces many commits with a new one, so `develop` and `main` no longer share history and later release PRs show false conflicts.

## Daily flow (feature branches)

```bash
git switch develop
git pull
git switch -c feat/S1-15-compress-baseline   # <type>/<TaskID>-<slug>
# work, commit often
npm run check
git push -u origin feat/S1-15-compress-baseline
```

1. Open a PR with **base: develop** (it is the default).
2. Title starts with the task ID: `[S1-15] Harden baseline compressor`.
3. Request a reviewer who is not the author. Fix comments with new commits on the same branch.
4. When approved and CI is green, the **author** clicks **Merge pull request** (merge commit), then deletes the branch.
5. Update your local copy: `git switch develop && git pull`.

## Release flow (end of each sprint)

1. The team lead opens a PR **develop -> main** titled `Release: Sprint N`.
2. CI must be green and one person approves. Merge with a merge commit.
3. **Do not delete `develop`** after this PR. `develop` is protected against deletion, so GitHub will refuse; if it ever disappears, use **Restore branch** on the PR page.
4. Afterwards `main` has one merge commit that `develop` does not. GitHub may show "develop is 1 commit behind main". This is harmless. To clear it, open a PR **main -> develop** (merge commit) when convenient, for example at the start of the next sprint.

## Rules summary

| Rule                                | Value                                                                                   |
| ----------------------------------- | --------------------------------------------------------------------------------------- |
| Direct pushes to `main` / `develop` | Not allowed                                                                             |
| PR target for features and fixes    | `develop`                                                                               |
| PR target only for releases         | `main`, from `develop` only                                                             |
| Approvals                           | 1 (2 for `packages/shared`, a team rule)                                                |
| Merge button                        | Merge commit only                                                                       |
| Branch names                        | `<type>/<TaskID>-<slug>` from `develop`                                                 |
| Urgent fix on `main`                | Branch from `main` as `hotfix/<slug>`, PR into `main`, then merge `main` into `develop` |
