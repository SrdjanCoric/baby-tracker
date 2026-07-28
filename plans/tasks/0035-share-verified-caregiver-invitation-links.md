# Task 0035: Share verified caregiver invitation links

**Branch**: `feature/share-verified-caregiver-invitation-links`
**Depends on**: none
**Source**: onboarding improvement conversation 2026-07-28 · **User stories**: owners share one invitation that works on iOS and Android; installed recipients reach Sofi with the code filled in; recipients without Sofi can install it and still see the readable fallback code

## What to build

Upgrade the existing household invitation from a code-only action to a verified HTTPS invitation plus the same readable invite code. When Sofi is installed, Apple Universal Links and Android App Links must open the app at the join flow with the code prefilled. When Sofi is not installed or the link opens on a computer, a small HTTPS landing page must show both store destinations, the invite code, and an instruction to reopen the invitation or enter the code after installation.

Keep authentication and explicit confirmation before the app submits the code or changes household membership. Do not include baby names or other family data in the shared payload, landing page, logs, or metadata. Do not add a third-party deferred-linking or analytics SDK. Automatic continuation through a first-time store installation is excluded.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/03-documentation.md`, `references/07-security.md`

- [ ] Keep link construction and parsing typed, deterministic, and free of embedded secrets other than the user-approved invite capability; prove with lint, typecheck, and focused tests.
- [ ] Test link construction, malformed input, route prefill, and platform configuration without production services; document the controlled real-device verification procedure.
- [ ] Document the canonical host, association files, landing-page deployment, store fallback, and recovery steps in repository-owned documentation.
- [ ] Preserve the repository's security scanning, secret detection, and dependency-audit posture without adding a tracking dependency.

## Implementation work

- [ ] Resolve the canonical HTTPS host and hosting location before defining the public invitation URL contract.
- [ ] Define one invitation URL builder/parser that normalizes valid codes and rejects malformed or unrelated links without attempting a join.
- [ ] Configure iOS Associated Domains and Android verified HTTPS intent filters for the chosen host.
- [ ] Publish and version the required Apple association and Android asset-link files from an authoritative location.
- [ ] Add the no-analytics landing page with App Store, Google Play, readable-code, and reopen-after-install guidance.
- [ ] Update household sharing to send the HTTPS link and readable code together, without baby or caregiver details.
- [ ] Route installed-app links to the existing join UI with the code prefilled but not submitted.
- [ ] Add automated configuration, builder/parser, malformed-link, prefill, and no-sensitive-payload tests.
- [ ] Document deployment, domain verification, manual checks, and failure recovery.

## Human checkpoints

- [ ] [decision] Choose and confirm the canonical HTTPS domain and repository-controlled landing-page host (`talk-it-through`).
- [ ] [confirm-security] Approve the final invitation URL shape, associated-domain ownership files, invite-code exposure model, and no-analytics landing page before enabling verified links.
- [ ] [verify] Share and open a real invitation on iOS and Android with Sofi installed, then repeat without Sofi installed and on a desktop browser · Expected: installed apps open the join route with the code prefilled but unsubmitted; other clients show both stores and the same readable code · Failure: the browser opens despite an installed app, the wrong app can claim the domain, the code is missing or submitted automatically, or the fallback page exposes family data · Reason: operating-system domain association and external HTTPS hosting cannot be proved by repository tests alone.

## Acceptance criteria

- [ ] One shared invitation contains a verified HTTPS link and its readable fallback code.
- [ ] Installed iOS and Android apps open the correct join route with the normalized code prefilled and no automatic membership change.
- [ ] Uninstalled and desktop recipients see a working landing page with both store destinations and the code.
- [ ] The fallback explains that first-time installers must reopen the invitation or enter the code.
- [ ] No third-party deferred-linking or analytics dependency is added.
- [ ] Shared content, web content, metadata, and logs contain no baby name or other family details.
- [ ] Automated and manual verification cover valid, malformed, installed, and uninstalled link behavior.
