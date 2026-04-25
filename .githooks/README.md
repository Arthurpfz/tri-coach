# Git hooks

Tracked hooks for this repo. Activated via `git config core.hooksPath .githooks`.

## Setup on a new clone

```bash
git config core.hooksPath .githooks
brew install gitleaks   # or: https://github.com/gitleaks/gitleaks
```

## What's installed

- **pre-commit** — runs `gitleaks protect --staged` to block commits containing secrets. Bypass with `git commit --no-verify` only in emergencies.
