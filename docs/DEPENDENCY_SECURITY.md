# Dependency security

Run the dependency policy from the repository root:

```bash
npm ci
npm run audit:dependencies
```

The command checks production and development dependencies. It exits with a nonzero status for an unapproved high or critical advisory. Pull requests and pushes to `main` run the same command in the `Dependency audit` job.

## Triage

Use `npm audit` and `npm explain <package>` to record each affected package, full dependency path, severity, and available fix. Classify the path as shipped runtime code, build tooling, development-only tooling, or unreachable transitive code. For reachable code, describe the input an attacker would need to control.

Prefer a supported package update or package removal. Review overrides against every affected parent range, then run the complete validation and mobile build checks. Do not use `npm audit fix --force` to apply framework or toolchain majors without a separate review.

## Temporary exceptions

A high or critical advisory may be excepted only when no compatible remediation is available. The pull request must include security approval and add one entry to `.github/dependency-audit-exceptions.json` with these fields:

- `advisory`: the exact GHSA identifier
- `package`: the affected package name
- `dependencyPaths`: every affected `node_modules` path reported by `npm audit`, as an array
- `exposure`: runtime or tooling exposure and attacker-controlled inputs
- `reason`: why no compatible remediation is currently safe
- `upstream`: the upstream reference that tracks the fix
- `owner`: the person or team responsible for follow-up
- `expiresOn`: the review deadline as a `YYYY-MM-DD` UTC date

The policy rejects incomplete, expired, malformed, and stale entries. It also rejects an exception when the advisory or package differs from the current audit finding. Remove the entry when the advisory disappears. The owner must remediate or renew the exception through another security-approved pull request before its expiry.

## Scheduled updates

Dependabot opens npm update pull requests each week and GitHub Actions updates each month. Minor and patch npm updates are grouped by production or development scope. Major updates remain separate so their compatibility and migration work can be reviewed on their own.
