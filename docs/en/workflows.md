# Workflows and automation

The companion distributes five strictly separate consumer templates:

- `heroes-ci.yml`: CI rendered from the branch strategy.
- `heroes-configure.yml`: roster labels and optional initial Project schema.
- `heroes-release-label.yml`: read-only label/version gate.
- `heroes-update-badges.yml`: one README marker block with bot/skip/stale guards.
- `heroes-sync-project-board.yml`: optional lifecycle sync after full opt-in.

All use `ubuntu-latest` and least privilege. Owner, repository, Project, runner,
statuses, branches, badge sources and release line are not defaults.

## README badges

`update-badges.mjs --check` reports drift without writing. The generator replaces
only one unique marker block and preserves all other bytes. Identical output
causes no write, commit or push.

## Version and release label

`versionbump` accepts only strict `X.Y.Z`, changes configured package files and
does not commit, push or deploy. The release gate is read-only and requires
exactly one configured positive or negative label.

## ReqEng and Ralph

Manual ReqEng creates no issue comment. Ralph mode uses exactly one block between
`<!-- squad:reqeng-questions -->` and `<!-- /squad:reqeng-questions -->`, waits
while blocking questions remain and evaluates bundled answers only against
currently displayed options.
