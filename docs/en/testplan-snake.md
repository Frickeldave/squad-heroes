# End-to-end test plan: `squad-heroes-snake`

Validate `{heroes-dir}`, an approved GitHub owner `{owner}`, and an empty consumer checkout `{snake-dir}`. Store evidence outside both repositories. Never expose tokens or PATs in commands, files, or logs.

Start gate: in a TTY, Companion installation must first show the "Project type" menu with exactly `001 Typescript developer project`. Non-TTY runs must pass `--project-type 001` explicitly; omission fails.

## Prerequisites

- Linux, Node.js 20+, npm, `git`, `gh`, Squad, and a TTY for interactive cases.
- An approved, empty owner namespace `{owner}` and an available `squad-heroes-snake` repository name.
- Authenticated `gh` with repository push permission and the writable Project scope.

```bash
command -v squad
ls -l "$(command -v squad)"
squad --version
gh auth status --hostname github.com
gh api repos/{owner}/squad-heroes-snake --jq .permissions.push
```

Gate: `gh auth status` succeeds. A `404` from the repository query is valid before creation; after creation, `push` must be `true`. If the Squad launcher reports `Permission denied`, do not continue under `sudo` or with recursive `chmod`; use the bounded repair in [Installation](installation.md).

## Validate the product state

```bash
cd {heroes-dir}
git rev-parse HEAD
sha256sum plugin.manifest.json package-lock.json
git status --short
npm ci
npm run check
npm run smoke
squad plugin validate .
git diff --check
```

Gate: every command succeeds and the tested state is identified. Save the commit ID and checksums.

## Create the consumer and validate Squad

```bash
gh repo create {owner}/squad-heroes-snake --private --confirm
git clone git@github.com:{owner}/squad-heroes-snake.git {snake-dir}
cd {snake-dir}
git status --short
squad init
grep -c '<!-- version:' .github/agents/squad.agent.md
grep '<!-- version:' .github/agents/squad.agent.md
squad --version
```

Gate: exactly one `<!-- version: X.Y.Z -->` marker exists with stable SemVer at least `2.0.0`. Prereleases and older versions stop before installation. After `squad upgrade --self` and any bounded launcher repair, repeat the marker checks and `node {heroes-dir}/scripts/plugin-preflight.mjs --target "$PWD"`.

## Validate the plugin lifecycle

```bash
cd {snake-dir}
node {heroes-dir}/scripts/plugin-preflight.mjs --target "$PWD"
squad plugin validate {heroes-dir}
squad plugin dry-run {heroes-dir}
node {heroes-dir}/scripts/plugin-preflight.mjs --target "$PWD"
squad plugin install {heroes-dir}
squad plugin enable squad-heroes
squad plugin list --json
squad plugin verify
git status --short
find .squad/plugins -maxdepth 2 -type f -print -exec sha256sum {} \;
```

The **plugin distribution plan** (`plugin distribution plan`) gates:

- the complete distribution appears only below `templates/squad-heroes/companion/`;
- representative targets include `templates/squad-heroes/companion/src/installer`, `templates/squad-heroes/companion/.squad/heroes/001/agents/tony.en.md`, and `templates/squad-heroes/companion/.squad/heroes/companion/workflows/heroes-ci.yml`;
- the static source reference `.squad/heroes/companion/workflows/heroes-ci.yml` remains included;
- it does not directly target root `scripts/`, `.github/prompts/`, or `.github/workflows/`;
- `list --json` reports the tested version, `verify` succeeds, and active targets remain unchanged.

Idempotency:

```bash
squad plugin verify
squad plugin install {heroes-dir}
squad plugin verify
```

Gate: target bytes remain unchanged and exactly one `squad-heroes` entry exists. Deliberately modify a plugin target; `verify` must fail with `checksum mismatch` without changing files. Restore it explicitly.

Check out a newer approved release at `{heroes-new-dir}` with a different version or content. Repeat validate, verify, install, and verify. Gate: the new version and checksums appear in `.squad/plugins/*`.

## Validate Companion activation

```bash
cd {snake-dir}
node .squad/templates/squad-heroes/companion/scripts/install --help
node .squad/templates/squad-heroes/companion/scripts/install \
  --target {snake-dir} \
  --repository {owner}/squad-heroes-snake \
  --project-type 001 \
  --deployment-branches 1 \
  --deployment-branch-1 main \
  --language en \
  --model-reqeng mai-code-2 \
  --model-work claude-sonnet-5.5 \
  --model-review gpt-6.1-terra \
  --dry-run
```

The **Companion activation plan** gates:

- checks run in this order: `gh`, auth/account, repository read/push permissions, Project API access; the `project` scope is safely proven from status output;
- gates run before prompts, model discovery, menus, and output, including with `--dry-run` and board sync disabled; `read:project` alone fails;
- missing scope shows only `gh auth refresh -h github.com -s project` and `gh auth status --hostname github.com`;
- `scripts/start-work.mjs`, other scripts, `.github/prompts/`, and `.github/workflows/heroes-ci.yml` appear, with no writes;
- 403/404 guidance, `viewerCanUpdate` before Board mutation, and the second check before the first Project write are exercised.
- `.squad/001/profile.json`, agents, and skills are installed; active charters derive from them and land in `.squad/agents/`;
- ReqEng, Work, and Review each appear once and are not duplicated under `.squad/001/`.

On a TTY, run the installer again without model flags. Arrows or `j`/`k` move, Enter confirms, and Escape/`q` cancels; numbers do not select. Without a TTY, require noninteractive flags. Exercise one-, multiple-, and zero-Project cases; owner derives from `{owner}`. A launcher run with `--model` must propagate that exact override.

Then:

```bash
node .squad/templates/squad-heroes/companion/scripts/install \
  --target {snake-dir} \
  --repository {owner}/squad-heroes-snake \
  --project-type 001 \
  --deployment-branches 1 \
  --deployment-branch-1 main \
  --language en \
  --model-reqeng mai-code-2 \
  --model-work claude-sonnet-5.5 \
  --model-review gpt-6.1-terra
git status --short
find scripts .github/prompts .github/workflows .squad/agents -type f -print
node scripts/start-reqeng.mjs --help
node scripts/start-work.mjs --help
node scripts/start-review.mjs --help
node scripts/update-badges.mjs --check
node scripts/versionbump.mjs --help
node scripts/check-release-label.mjs --help
```

Gate: all entry points exist and provide safe help or diagnostics. Repeating the same apply reports `changed: 0`. Modify one managed marker block: dry-run shows local, incoming, and result; unresolved conflicts write nothing. Apply exactly one documented decision. `history.md` stays append-only, and profile changes fail closed.

After a plugin update, explicitly rerun the Companion. Active bytes may change only in this apply. Disable/uninstall the plugin: active files remain, and `.squad/plugins/*` stayed unchanged during the Companion rerun. Reinstall afterward.

## Create the Snake issue

Use the supplied [issue template](testplan-snake-issue.md) directly. Do not create a separate local issue file:

```bash
cd {snake-dir}
gh issue create --repo github.com/{owner}/squad-heroes-snake \
  --title "Build browser-based Snake game" \
  --body-file {heroes-dir}/docs/en/testplan-snake-issue.md
gh issue list --repo github.com/{owner}/squad-heroes-snake --state open
```

Record the returned URL/number immediately as `{snake-issue}`. Gate: exactly one new open ticket; unrelated tickets remain unchanged.

## Validate the Squad flows

```bash
cd {snake-dir}
node scripts/start-reqeng.mjs --issue {snake-issue}
node scripts/start-work.mjs --issue {snake-issue}
git branch --show-current
git worktree list
git log --oneline -5
gh issue view {snake-issue} --repo github.com:{owner}/squad-heroes-snake
```

Gate: blocking questions close before Work, the same question block is evaluated without duplicates, and one validated model ID propagates unchanged. Branch, issue reference, tmux, and worktree are unambiguous.

Implement, test, and open a PR with `gh pr create`. The body must contain `Closes #{snake-issue}`.

```bash
gh pr view --repo github.com:{owner}/squad-heroes-snake
gh pr checks --repo github.com:{owner}/squad-heroes-snake --watch --fail-fast
gh pr view --repo github.com:{owner}/squad-heroes-snake \
  --json reviewDecision,mergeable,state
node scripts/start-review.mjs --pr {snake-pr}
```

Gate: review baseline is run override, configured baseline, or PR base, never head. Do not mark ready or merge on a failure, missing approval, or open gate. After approval, merge and post completion evidence with checks and commits.

## Validate Snake behavior

```bash
cd {snake-dir}
npm ci
npm test
npm run build
npm run check
```

Automated gates:

- a fixed seed produces the same initial and final state;
- movement is axis-aligned and immediate reversal is blocked;
- food uses free cells and increases length/score;
- wall and self collision cause game over;
- restart restores the initial state and creates no second loop;
- identical actions produce identical state.

Manually test desktop and a narrow viewport: use the generated README to start the app, then check keyboard/optional touch input, focus, growth, score, game over, restart, overflow, console, and network errors. Record browser, version, time, and screenshots.

## Validate Project creation

Fixture: owner `frickeldave-test`, repository `squad-heroes-snake`, zero Projects.

```bash
node .squad/templates/squad-heroes/companion/scripts/install \
  --target "$PWD" \
  --repository frickeldave-test/squad-heroes-snake \
  --enable-board-sync \
  --project-type 001 \
  --language en \
  --deployment-branches 1 \
  --deployment-branch-1 main \
  --model-reqeng mai-code-2 \
  --model-work claude-sonnet-5.5 \
  --model-review gpt-6.1-terra \
  --create-project \
  --project-title squad-heroes-snake \
  --dry-run
```

Gate: the menu contains Companion creation, manual creation, and cancel; dry-run shows `PLANNED_CREATE` and `{{PROJECT_NUMBER}}`, with no mutation or placeholder lookup. Apply creates once, resolves the real number/node ID, checks `viewerCanUpdate`, configures schema and repository link, and stores the number. Rerun creates no second Project and no local writes. 403, missing CI flags, invalid title, and partial-schema failures produce safe recovery without secrets. `HEROES_PROJECT_TOKEN` reaches only Project v2 commands; repository access uses `${{ github.token }}`.

## Handle a stale consumer copy

```bash
git -C {heroes-dir} pull --ff-only
squad plugin install {heroes-dir}
squad plugin verify
sha256sum {heroes-dir}/dist/companion/scripts/install
sha256sum .squad/templates/squad-heroes/companion/scripts/install
cmp {heroes-dir}/dist/companion/scripts/install \
  .squad/templates/squad-heroes/companion/scripts/install
node .squad/templates/squad-heroes/companion/scripts/install --target "$PWD" --dry-run
```

Gate: `cmp` exits 0.

## Failure and cleanup

On failure, stop active processes and record the step, command, exit code, and last passing check. Do not mutate a resource with unclear ownership. For partial Project failure, first inspect `gh project list --owner {owner} --limit 100 --format json` and existing state; do not blindly recreate.

```bash
cd {snake-dir}
git worktree list
gh pr list --repo github.com:{owner}/squad-heroes-snake --state open
gh issue list --repo github.com:{owner}/squad-heroes-snake --state open
```

- Remove only this run's worktrees with `git worktree remove {path}`.
- End only named test tmux sessions with `tmux kill-session -t {name}`.
- Delete test branches only after the final commit and with explicit confirmation.
- Store evidence under its retention policy.
- Delete the test repository only after explicit human approval:

```bash
gh repo delete github.com/{owner}/squad-heroes-snake --yes
```

- Check `gh auth status` again; do not modify the credential store.

Final evidence: commit ID, checksums, `list --json`, plans, issue/PR, checks, review, model/Scribe evidence, browser data, and cleanup.
