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

The project's safety boundaries are described in
[docs/project-context.md](docs/project-context.md).
