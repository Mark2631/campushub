Push branch and run CI (copy-paste)

Option A — Using Git (recommended; you will be prompted for credentials):

```bash
# create branch
git checkout -b release/multi-institution
git add .
git commit -m "Add multi-institution foundation, migrations, Docker, CI improvements"
# push (enter credentials when prompted)
git push --set-upstream origin release/multi-institution
```

Then open a Pull Request on GitHub (or use `gh` CLI below).

Option B — Using GitHub CLI (`gh`) to create PR and run workflow

```bash
# requires: gh auth login
gh pr create --title "Add multi-institution foundation" --body-file PR_DESCRIPTION.md --head release/multi-institution --base main

# Trigger CI workflow manually (workflow_dispatch)
gh workflow run CI --repo <owner>/<repo> --ref release/multi-institution
```

Option C — Run CI from Actions UI
- Go to your repository → Actions → CI → Run workflow → choose `release/multi-institution` branch → Run workflow.

Docker fallback (no node installed locally)

```bash
docker build -t campushub:ci .
docker run --rm campushub:ci
```

Notes
- CI will run `npm ci`, `npm run lint`, `npm run type-check`, `npm run build` on Ubuntu.
- If CI fails, open the workflow run logs → download logs or paste errors here and I will triage fixes.
