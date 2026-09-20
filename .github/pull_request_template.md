## What and why

<!-- One or two sentences. Link the plan item or contract this belongs to. -->

## Checks

- [ ] `make check` passes (lint, design contract, build, web tests, API tests)
- [ ] New or changed endpoints have Pydantic request and response models and tests written first
- [ ] Presentational components take typed props only, with no fetching and no `any`
- [ ] Security review: request input is validated and bounded, nothing is built from unvalidated input, no secrets or raw provider errors are exposed, and any new lint ignore is justified in a comment
- [ ] Nothing presents synthetic data as live, and pending or failed states are not shown as completed
- [ ] The implementation plan's `Status`, `Verification`, and progress line reflect this change (a tick needs evidence in the repository)
