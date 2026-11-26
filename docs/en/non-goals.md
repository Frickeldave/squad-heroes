# Non-goals

- Product-managed or automatic installation, upgrade or downgrade of Squad;
  operator-run `squad upgrade` guidance is diagnostic only.
- A proprietary Squad/plugin/overlay CLI or global installer.
- Executable plugin hooks or plugin writes outside `.squad/`.
- Automatic Copilot, MCP, provider or package-manager installation.
- Project-specific owners, boards, branches, secrets, runners, products,
  databases or deployments as defaults.
- Blind 1:1 copying or runtime dependency on the reference tree.
- Whole README generation or automatic label selection.
- Commit/push/deploy from `versionbump`.
- Silent overwrite, profile migration, history reordering or global rollback.
- Operating systems or package managers beyond Linux/Node.js/npm.
