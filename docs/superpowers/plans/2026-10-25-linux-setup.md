# Linux setup implementation plan

> Execute inline using superpowers:executing-plans. The user authorized implementation and publication.

**Goal:** Reproduce the Linux setup without changing Windows defaults, and install the shared-access rule on both platforms.
**Architecture:** Separate Linux orchestration and portable Python iCloud helpers; reuse the existing managed installer and memory/MCP code.
**Stack:** Node.js 22+, Python 3.10+, rclone 1.69+, systemd user timers.
**Spec:** ../specs/2026-10-25-linux-setup-design.md

## Constraints and review focus

- Windows keeps default config paths, scheduled-task/VBS behavior and preservation semantics.
- Linux paths are derived from the selected home; services use absolute executable paths and escaped arguments.
- No credentials, vault content or live configuration is copied into Git.
- Reinstallation must preserve personal settings and unrelated connectors.
- iCloud is optional, refuses incorrect paths, retains its initialization state and never silently resyncs.
- No-backup policy must not create snapshots; initial sync must not race with Obsidian or capture.

## Tasks

1. [ ] Add failing installation tests for Linux paths, repeated installation, connectors disabled, private settings preservation and Windows behavior. Add a cross-source MCP retrieval test. Run them before implementation.
2. [ ] Extract shared instructions; minimally parameterize config location, platform and managed-file backups in `src/install.js`, retaining Windows defaults. Add `src/linux.js` and Linux install/uninstall CLIs with prepared-only mode. Run focused tests.
3. [ ] Add portable iCloud connect/sync helpers and generated wrappers, filters and timers. Test initialization, repeated runs, no backups, concurrent initialization protection, paths with spaces and conflicts using local rclone remotes. Validate generated services.
4. [ ] Document setup, authentication, conflict limitations, reinstall/uninstall and Windows compatibility. Add Linux ZIP and Ubuntu/Windows CI. Run complete tests, syntax checks and release packaging.
5. [ ] Review the complete branch with a fresh reviewer, fix material findings, commit, push and verify remote CI. Integrate only after checks pass; update the original checkout without rerunning its installer.
