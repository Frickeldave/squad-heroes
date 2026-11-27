# End-to-end test plan: `squad-heroes-snake` consumer repository

This runbook validates the released product outside the source repository. It
is repeatable but not fully automatic: GitHub and browser checks require an
approved test organization and explicit human confirmation. Never store tokens,
PATs, or credentials in commands, files, or evidence.

## 1. Prerequisites

1. Linux, Node.js 20+, npm, `git`, `gh`, and `squad` are installed.
   Verify the launcher as the normal user before upgrading anything:

   ```bash
   command -v squad
   ls -l "$(command -v squad)"
   squad --version
   ```

   If this fails with `Permission denied`, stop; do not run the CLI under
   `sudo` or apply a recursive chmod.
2. An empty approved GitHub owner/namespace is available. `{owner}` means only
   this namespace.
3. Verify the active `gh` identity and permissions without exposing credentials:

   ```bash
   gh auth status
   gh api repos/{owner}/squad-heroes-snake --jq .permissions.push
   ```

   Expect `gh auth status` to succeed. The first API lookup may legitimately be
   `404` before creation; otherwise `push` must be provably `true`. If auth is
   missing, use only the host-side `gh auth login` browser/device flow.
4. Keep a local `squad-heroes` checkout at `{heroes-dir}` and identify the exact
   tested state:

   ```bash
   cd {heroes-dir}
   git rev-parse HEAD
   sha256sum plugin.manifest.json package-lock.json
   npm ci
   npm run check
   npm run smoke
   squad plugin validate .
   git diff --check
   ```

   Save command output, commit ID, and checksums in an `evidence/` directory
   outside the product repository. Any failure, unexpected dirty state, or
   missing Squad version stops the run.

## 2. Create the empty consumer repository

```bash
gh repo create {owner}/squad-heroes-snake --private --confirm
git clone git@github.com:{owner}/squad-heroes-snake.git {snake-dir}
cd {snake-dir}
git status --short
```

Expect an empty repository with only the Git directory. Verify SSH access before
cloning or use the HTTPS transport already configured by `gh`. Stop if the name
exists and is not explicitly confirmed as this run's empty test repository.

## 3. Verify a supported Squad version

Initialize Squad only in the consumer repository. The authoritative product
source is the marker in the installed file:

```bash
cd {snake-dir}
squad init
grep -c '<!-- version:' .github/agents/squad.agent.md
grep '<!-- version:' .github/agents/squad.agent.md
squad --version
```

Expect `1` from `grep -c` and exactly one `<!-- version: X.Y.Z -->` marker whose
valid stable SemVer is at least `2.0.0` (for example `2.0.0`, `2.0.1` or
`3.0.0`). `squad --version` records the CLI too, but does not replace the marker
check. Prereleases, including `2.0.0-rc.1`, are rejected fail-closed.

If the detected version is `0.13.1`, this is a stop condition: do not continue
the installation. Update the installed CLI with `squad upgrade --self` as the
normal user. If a root-owned global npm package fails with `EACCES`/`EPERM`,
repair that one global install with:

```bash
sudo sh -c 'umask 022 && exec npm install -g --allow-scripts=@bradygaster/squad-cli,node-pty,koffi,protobufjs @bradygaster/squad-cli@latest'
```

Do not run Squad itself under `sudo`, persist a global allowlist, or use
`--dangerously-allow-all-scripts`. Restart the terminal and repeat `command -v
squad`, `ls -l "$(command -v squad)"`, and `squad --version`. After all three
checks pass, run `squad upgrade` inside `{snake-dir}`, repeat the marker commands,
and rerun `node {heroes-dir}/scripts/plugin-preflight.mjs --target "$PWD"`.

## 4. Install and update the Squad plugin

Fresh lifecycle:

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

The **plugin distribution plan** from `squad plugin dry-run` must include the
complete versioned companion: its installer and static copies of runtime,
script, `.squad/heroes/`, workflow, resource, and Humanizer files. Require
representative entries such as
`templates/squad-heroes/companion/.squad/heroes/agents/tony.en.md`,
`templates/squad-heroes/companion/src/installer`, and
`templates/squad-heroes/companion/.squad/heroes/companion/workflows/heroes-ci.yml`.
Every entry remains below `templates/squad-heroes/companion/`; it must not
target active root `scripts/`, `.github/prompts/`, or `.github/workflows/`.

Expect declared plugin targets under `.squad/`; `.squad/plugins/*` must be the
authoritative installed state. `list --json` must report `squad-heroes@0.1.0`
or the exact released version under test. `verify` succeeds. Active Companion
targets remain untouched.

Idempotency and actual update behavior:

1. Save plugin target and Companion control checksums.
2. Repeat the identical installation:

   ```bash
   squad plugin verify &&
   squad plugin install {heroes-dir} &&
   squad plugin verify
   ```

   Expect unchanged target bytes and one installed `squad-heroes` entry. Squad
   may record a new timestamp or audit event.
3. Check out a newer approved release at `{heroes-new-dir}` and prove that
   version or source content differs:

   ```bash
   node {heroes-new-dir}/scripts/plugin-preflight.mjs --target "$PWD"
   squad plugin validate {heroes-new-dir}
   squad plugin verify &&
   node {heroes-new-dir}/scripts/plugin-preflight.mjs --target "$PWD" &&
   squad plugin install {heroes-new-dir} &&
   squad plugin verify
   squad plugin list --json
   ```

   Expect the new version, manifest checksum, file checksums, and static content
   to appear in `.squad/plugins/*`.
4. Locally modify one plugin target and run `squad plugin verify`. Expect a
   `checksum mismatch`, nonzero status, and no state/file change from `verify`.
   Deliberately restore it rather than silently covering the conflict.

## 5. Companion and supplied flows

```bash
cd {snake-dir}
node .squad/templates/squad-heroes/companion/scripts/install --help
node .squad/templates/squad-heroes/companion/scripts/install \
  --target {snake-dir} \
  --repository {owner}/squad-heroes-snake \
  --profile typescript-development \
  --deployment-branches 1 \
  --deployment-branch-1 main \
  --language en \
  --model-reqeng mai-code-2 \
  --model-work claude-sonnet-5.5 \
  --model-review gpt-6.1-terra \
  --dry-run
```

Require approved model IDs and complete noninteractive inputs. Verify dry-run
performs only `gh auth status`, authenticated-account/repository permission
queries and, when opted in, Project read queries. Expect the
separate **Companion activation plan** to show `scripts/start-work.mjs`, other
`scripts/` targets, `.github/prompts/`, and
`.github/workflows/heroes-ci.yml`. It performs no writes, passes both version
gates, avoids credential prompts, and keeps plugin/Companion ownership separate.

Also run the installer on a TTY once without model flags. Confirm the labels
`Default model for reqeng/work/review` use an in-place picker: Up/Down or `j`/`k`
moves, Enter confirms, Escape/`q` aborts, and typed numbers or arbitrary text
cannot select an item. The displayed current value is highlighted and is the
default. Without a TTY, expect a clear noninteractive-flags error rather than a
number-entry fallback. If board sync is enabled, confirm owner `\{owner\}` is
derived and Project `\#` is auto-selected or chosen with the same arrow-key
picker—never typed. Verify the one/multiple/zero Project cases.
Run a separate launcher invocation with `--model` and confirm the override is
used unchanged for that run.

Run the same command without `--dry-run`, then:

```bash
cd {snake-dir}
git status --short
git diff -- . ':!package-lock.json'
find scripts .github/prompts .github/workflows .squad/agents -type f -print
node .squad/templates/squad-heroes/companion/scripts/install --help
node scripts/start-reqeng.mjs --help
node scripts/start-work.mjs --help
node scripts/start-review.mjs --help
node scripts/update-badges.mjs --check
node scripts/versionbump.mjs --help
node scripts/check-release-label.mjs --help
```

Each entry point must exist and provide safe help or diagnostics. Unapproved
external board writes remain absent. Repeat the Companion command with identical
inputs and expect `changed: 0` or byte-identical no-op.

Conflict test: change one managed marker block deliberately, rerun dry-run, and
record all three versions/options. An unresolved conflict stops before writes;
then apply exactly one documented decision. `history.md` must append only.
A profile change must fail closed.

After plugin update, explicitly rerun the copied Companion and repeat the
idempotency check. Confirm active target bytes changed only on that explicit
rerun. Disable and uninstall the plugin, then verify that the active
`scripts/`, workflows and charters still exist before reinstalling the plugin.
`.squad/plugins/*` is unchanged by the Companion rerun.

## 6. Create the Snake ticket

The ticket describes only the test product. Minimum body:

- goal: browser-based Snake;
- acceptance: start, keyboard direction, food/growth, wall/self collision,
  score, game over, restart, deterministic core;
- gates: unit tests, build/check, reviewer approval.

```bash
cd {snake-dir}
gh issue create --repo github.com:{owner}/squad-heroes-snake \
  --title "Build browser-based Snake game" \
  --body-file evidence/snake-issue.md
gh issue list --repo github.com:{owner}/squad-heroes-snake --state open
```

Record `{snake-issue}`. Expect exactly one newly created test item and no change
to any unrelated ticket.

## 7. Full Squad workflow

1. Start ReqEng/issue processing with
   `node scripts/start-reqeng.mjs --issue {snake-issue}` and flags from `--help`.
2. Submit bundled, unambiguous answers. Blocking questions must close before
   Work. Re-evaluate the same stable block; duplicate blocks fail the test.
3. Start `node scripts/start-work.mjs --issue {snake-issue}`.
4. Capture branch, worktree/tmux, resolved model ID, downstream model, and
   decisions:

   ```bash
   git branch --show-current
   git worktree list
   git log --oneline -5
   gh issue view {snake-issue} --repo github.com:{owner}/squad-heroes-snake
   ```

   Expect an unambiguous branch/issue reference and one exact model ID propagated
   unchanged to every downstream operation.
5. Execute implementation, tests, and documentation through the generated Squad
   chain. Commits contain no credentials.
6. Create a PR with `gh pr create` referencing `{snake-issue}`, then:

   ```bash
   gh pr view --repo github.com:{owner}/squad-heroes-snake
   gh pr checks --repo github.com:{owner}/squad-heroes-snake --watch --fail-fast
   gh pr view --json reviewDecision,mergeable,state
   ```

   Do not mark ready or merge on failure, missing review, or an open gate.
7. Run `node scripts/start-review.mjs --pr {snake-pr}`. Baseline precedence must
   be run override, configured baseline, or PR base—never PR head.
8. Merge only after approval, then add a completion comment with checks and
   commit evidence. Scribe/decision updates must contain the agreed data without
   duplicated blocks.

## 8. Verify Snake behavior

Automatic checks where supported by the consumer framework:

```bash
cd {snake-dir}
npm ci
npm test
npm run build
npm run check
```

Tests must prove:

- deterministic initial state with a fixed seed;
- one-axis movement in every direction;
- food increases length and score;
- wall or self collision causes game over;
- restart returns to the initial state;
- immediate reverse direction is rejected;
- identical action sequences produce identical state.

A missing test, build failure, nondeterministic result, or flaky output stops the
run.

Manual browser checks:

1. Start the local server according to the generated README.
2. Verify start, keyboard input, growth, game over, and restart on a desktop
   browser; verify touch/mobile controls if supplied.
3. Confirm no diagonal motion, blocked UI, double-restart behavior, console
   errors, or failed network requests.
4. Save browser, version, timestamp, and screenshots as approval evidence.

## 9. Failure handling and cleanup

On failure: stop active commands, jobs, or local servers; record the step,
command, exit code, and unchanged checks; mutate nothing once ownership of a
resource is unclear.

For `bash: /usr/bin/squad: Permission denied`, record the launcher symlink and
its resolved path, do not patch individual dependency permissions, and repeat
the documented global reinstall with `umask 022`. Restart the terminal and
repeat the three launcher checks before resuming a product or test-repository
upgrade.

After a successful or intentionally aborted run:

```bash
cd {snake-dir}
git worktree list
gh pr list --repo github.com:{owner}/squad-heroes-snake --state open
gh issue list --repo github.com:{owner}/squad-heroes-snake --state open
```

1. Remove only this run's worktrees with `git worktree remove {path}`.
2. End identified tmux sessions by exact name with
   `tmux kill-session -t {name}`; never use pattern deletion.
3. Delete test branches only from this repository after final commit, using safe
   `gh` operations and explicit confirmation.
4. Move local evidence according to retention policy. Delete temporary checkouts
   only after comparing owner and absolute path.
5. If the isolated repository is no longer needed:

   ```bash
   gh repo delete github.com:{owner}/squad-heroes-snake --yes
   ```

   Require explicit human confirmation for this irreversible action.
6. Check `gh auth status` again, but do not alter the credential store. Do not
   revoke globally useful permissions used by other approved work.

Final evidence includes commit IDs, `list --json`, plugin checksums, Companion
plan, ticket/PR numbers, check/review results, model/Scribe evidence, browser
results, and the cleanup record.
