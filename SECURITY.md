# Security policy

This is a portfolio showcase that uses synthetic data only. It is not a
production payment or compliance service, and it must never be given real
customer, payment, or provider data.

## Reporting a vulnerability

Please report a suspected vulnerability privately through GitHub's
"Report a vulnerability" option on this repository's Security tab, rather than
a public issue. If a secret or personal data has been committed by mistake,
say so in the report so it can be rotated and removed.

## Scope

- In scope: exposed secrets, unsafe handling of provider or personal data,
  wildcard CORS on sensitive routes, and raw provider errors reaching the UI.
- Out of scope: availability of the free-tier demo hosting, and findings that
  need real customer or payment data to reproduce.

## Automated checks

These run in CI on every change and weekly against `main`
(`.github/workflows/security.yml`), and they support review rather than replace
it:

- **Dependency audit** — `pip-audit` against the API's exported runtime
  dependency tree, and `npm audit` against the console's production
  dependencies. Dependabot proposes the upgrades; these jobs fail the build.
- **CodeQL** — `security-and-quality` queries for Python and
  TypeScript/JavaScript.
- **Ruff's security rules** (`S`) on the API, a `no-any` lint rule in the
  console, and a container job that checks the published image runs as a
  non-root user and carries no private or offline code.

The project's safety boundaries are described in
[context/architecture.md](context/architecture.md) and
[context/ai_workflow_rules.md](context/ai_workflow_rules.md).
