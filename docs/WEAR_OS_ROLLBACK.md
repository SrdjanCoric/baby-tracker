# Wear OS work rollback (2026-08-25)

`main` was reset to the last deployed state (`bd01266`, release 4.9.8) before any Wear OS work
landed. All Wear OS commits (tasks 0089–0097: scaffold, session handoff, today summary, diaper,
feeding, sleep, pumping, tummy time, launcher complication) are preserved on the branch
`backup/wear-os-work` (tip `df6e1f9`), pushed to origin.

## Restore the Wear OS work

```sh
git checkout main
git reset --hard backup/wear-os-work
```

Or cherry-pick individual commits from `backup/wear-os-work`.

Do not delete `backup/wear-os-work` until the work is merged back or explicitly abandoned.
