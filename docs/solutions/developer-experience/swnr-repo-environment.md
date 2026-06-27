---
title: "SWNR repo environment — Foundry symlink, fork remote layout, pack rebuild"
date: 2026-06-27
problem_type: developer_experience
category: developer-experience
track: knowledge
module: swnr
component: repo-setup
tags: ["foundry-vtt", "git-remotes", "compendium-packs", "dev-environment"]
applies_when: "Testing in Foundry, committing/pushing, or rebuilding compendium content for the SWNR system"
---

# SWNR repo environment — Foundry symlink, fork remote layout, pack rebuild

## Context

Several non-obvious facts about how this repo is wired trip up anyone working on it for the first time (or a fresh agent session). They are not visible from the code alone, and getting them wrong leads to pushing to the wrong remote, testing stale code, or corrupting a compendium pack.

## Guidance

- **The main checkout IS the live Foundry install.** `~/Library/Application Support/FoundryVTT/Data/systems/swnr` is a symlink to `/Users/personal/code/swnr`. Whatever is checked out and present in that working tree is what Foundry loads after a world relaunch. JS loads directly (`esmodules: module/swnr.mjs` in `system.json`) — there is **no JS build step**; only CSS is built (`npm run build` runs `sass`). To manually test a branch, get it onto the main checkout (not a separate worktree).

- **The remote layout is inverted from the usual fork convention.** `origin` is the **upstream** (`wintersleepAI/swnr`); the personal fork is the **`bunnysage`** remote (`bunnysage/swnr`). All pushes and PRs go to `bunnysage`, never `origin`. Commit identity must be bunnysage (`git config user.name bunnysage`, email `86330532+bunnysage@users.noreply.github.com`). Open PRs fork-only with `gh pr create --repo bunnysage/swnr ...`.

- **Compiled compendium packs are gitignored build artifacts.** `packs/<name>/` (LevelDB) is generated from `src/packs/<name>/*.yml` (YAML, one doc per item) using `@foundryvtt/foundryvtt-cli`'s `compilePack` (see `scripts/pack-compendium.mjs`). Only the YAML source is committed. After editing a content item, rebuild that pack so Foundry serves the change.

- **Tests:** `npm test` = `node --test tests/node/*.test.mjs`. Pure logic lives in `module/helpers/*.mjs` (Foundry-free) and is unit-tested there; Foundry-bound glue (data models, rolls) is verified manually in a running world.

## Why This Matters

- Pushing to `origin` would target the upstream maintainer's repo instead of the fork — a publish to the wrong place.
- Editing source but not rebuilding the pack means Foundry keeps serving the old compiled item, so a content change looks like it "didn't work."
- Compiling onto an existing, non-empty pack LevelDB can throw `LEVEL_ITERATOR_NOT_OPEN`, and Foundry holds a lock on the DB while running — both produce confusing failures unless you know the rebuild recipe below.

## When to Apply

Whenever committing/pushing, opening a PR, manually testing in Foundry, or changing compendium content in this repo.

## Examples

**Rebuild a single pack safely** (Foundry must be closed; back up first because a dirty dest can fail mid-compile):

```bash
cd /Users/personal/code/swnr
cp -r packs/wwn-items packs/wwn-items.bak     # backup
rm -rf packs/wwn-items                         # compile onto a clean dir
node --input-type=module -e "import {compilePack} from '@foundryvtt/foundryvtt-cli'; const r=process.cwd(); await compilePack(r+'/src/packs/wwn-items', r+'/packs/wwn-items', {yaml:true});"
rm -rf packs/wwn-items.bak                      # on success
```

**Fork-only push + PR:**

```bash
git push -u bunnysage <branch>
gh pr create --repo bunnysage/swnr --base <base-branch> --head <branch> ...
```
