# GitHub setup guide (step by step)

Who does what: **Abdallah Elwasify** performs Parts A-C (task S1-01). **Everyone** does Part D. Esraa is the second Owner/Admin.

## Part 0 - Decide where the repo lives (5 minutes, one decision)

GitHub only enforces branch protection ("rulesets") on **private** repos if the owner has a paid plan. Pick one:

| Option                                                     | How                                                                                         | Branch protection        | Notes                                                                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------- |
| **A (recommended): free GitHub Organization, public repo** | Org called e.g. `lens-fci` (or any name), repo `lens` set to Public                         | Works for free           | Proposal is not secret; never commit keys or real-project code. Shared ownership: two Owners. |
| **B: private repo under one member's personal account**    | That member gets GitHub Pro free via the Student Developer Pack (education.github.com/pack) | Works once Pro is active | Repo is tied to one person's account; if that account is lost, so is the repo.                |

Check with Dr. Gaber Hassan if the repo may be public. GitHub's plan rules can change: if the ruleset page says "upgrade", you are on the wrong plan for a private repo.

## Part A - Create the repo and give access

Option A (organization):

1. Log in as Abdallah Elwasify. Top right **+** > **New organization** > choose **Free** > name it (e.g. `lens-fci`) > contact email > "My personal account" > Next > skip inviting for now.
2. In the org page: **New repository** > name `lens` > visibility **Public** > do NOT add README/.gitignore/licence (the starter already has them) > Create.
3. Invite people: org page > **People** > **Invite member** > type each GitHub username or email (Esraa, Aya, Lama, Amr, Ahmed, Abdallah Mohamed Ramdan).
4. Make Esraa an **Owner**: People > her row > role > Owner. Everyone else stays **Member**.
5. Give them write access to the repo: repo **Settings > Collaborators and teams** > **Add teams** > create a team `developers` (org > Teams > New team), add all 7, and give the team the **Write** role. (Write = can push branches and open PRs, cannot change settings.)

Option B (personal account): repo **Settings > Collaborators > Add people** > each username > role **Write**; each person must accept the emailed invitation. Personal repos have a single owner and collaborators can be at most Write, so shared ownership is weaker: prefer Option A.)

Everyone must enable two-factor authentication (GitHub > Settings > Password and authentication).

## Part B - Push the starter as the first commit (before protecting main)

Protection blocks direct pushes, so the starter goes in first. On Abdallah's machine:

```bash
unzip lens-starter.zip && cd lens
git init -b main
git config user.name "Your Name"
git config user.email "the-email-used-on-github@example.com"
git add .
git commit -m "chore: initial scaffold"
git remote add origin https://github.com/<org-or-user>/lens.git
git push -u origin main
```

Git will open a browser sign-in (Git Credential Manager comes with Git for Windows). If asked for a password, use a Personal Access Token (GitHub > Settings > Developer settings > Tokens > classic > scope `repo`) - not your account password.

Then open the repo **Actions** tab and wait for the first **CI** run to finish. It must run once so the check names appear in the next part. If it fails, fix it on a branch (S1-06 tracks CI issues).

## Part C - Protect main

Repo **Settings > Rules > Rulesets > New ruleset > New branch ruleset**:

1. Name: `protect-main`. Enforcement status: **Active**.
2. Bypass list: leave **empty** (nobody, including admins, skips the rules).
3. Target branches: **Add target > Include default branch**.
4. Branch rules - tick:
   - **Restrict deletions**
   - **Block force pushes**
   - **Require a pull request before merging** > required approvals **1** > tick _Dismiss stale pull request approvals when new commits are pushed_ > allowed merge methods: **Squash** only.
   - **Require status checks to pass** > **Add checks** > select `check (ubuntu-latest)` and `check (windows-latest)` (they only appear after Part B's CI run).
5. **Create**.
6. Repo **Settings > General > Pull Requests**: untick _Allow merge commits_ and _Allow rebase merging_, keep _Allow squash merging_, tick _Automatically delete head branches_.
7. Test it: on your machine run `git commit --allow-empty -m "test" && git push origin main` - it must be **rejected**. Screenshot as evidence.

Changes to `packages/shared` should need 2 approvals: that is a team rule in CONTRIBUTING.md (a CODEOWNERS file can enforce it later).

Labels: repo **Issues > Labels** > create `shared`, `compression`, `task-context`, `connector`, `stats-api`, `dashboard`, `evaluation`, `infra`, `docs`, `spike`.

## Part D - Every member: first-time setup (15 minutes)

1. Create a GitHub account (if needed) and enable 2FA. Send your username to Abdallah.
2. Accept the invitation (email, or github.com/notifications).
3. Install Git, Node.js 22 (`nvm` / `nvm-windows`), and optionally GitHub Desktop or VS Code.
4. Configure Git once:
   ```bash
   git config --global user.name "Your Name"
   git config --global user.email "the-email-used-on-github@example.com"
   ```
5. Clone and check:
   ```bash
   git clone https://github.com/<org-or-user>/lens.git
   cd lens && npm install && npm run check
   ```
6. Your daily flow for any task (example S1-15):
   ```bash
   git switch main && git pull
   git switch -c feat/S1-15-compress-baseline
   # ...edit, then
   npm run check
   git add . && git commit -m "feat(compression): handle // inside strings"
   git push -u origin feat/S1-15-compress-baseline
   ```
   Open the link Git prints to create the Pull Request, title it `[S1-15] Harden baseline compressor`, fill the template, request a reviewer. After approval and green CI click **Squash and merge**. Then `git switch main && git pull`.

## Troubleshooting

- **"Permission denied" / 403 on push:** you have not accepted the invite, or you have Read role. Ask an Owner to set Write.
- **"Protected branch update failed":** you tried to push to `main`; push a branch and open a PR.
- **Cannot find the required check names:** CI has never run; push once, wait, then edit the ruleset.
- **Merge button greyed out:** CI still running/failed, or you have no approval (you cannot approve your own PR).
- **Ruleset page asks to upgrade:** private repo on a free plan - make it public (Option A) or use Student Pack Pro (Option B).
