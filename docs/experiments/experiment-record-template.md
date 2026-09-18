# Experiment: <short name>

| Field | Value |
| --- | --- |
| Status | Proposed / Running / Completed / Rejected / Accepted |
| Owner | <name or team> |
| Date | YYYY-MM-DD |
| Git commit | `<commit>` |
| Code/config revision | `<path and revision>` |
| Dataset or fixture manifest | `<secure URI or repository path>` |
| Source class | Synthetic / Sanitised provider sandbox / Approved secure dataset |
| Time boundary | `<point-in-time or period>` |
| Feature/schema version | `<version>` |
| Artifact URI + checksum | `N/A` or `<secure URI + SHA-256>` |

## Question and decision boundary

What question is this experiment answering? State what this result is allowed
to influence and what it cannot authorise.

## Method

Describe inputs, transformations, configuration, controls, and evaluation
method. Link to the notebook or production module; do not paste secrets, raw
records, or hidden model reasoning.

## Results

Record metrics, relevant cohorts/slices, failure cases, and limitations. Define
the comparison baseline where there is one.

## Decision

- Decision: <accepted / rejected / needs follow-up>
- Approver: <name or team>
- Follow-up / rollback: <work item or N/A>

An accepted experiment is not by itself approval to promote a model or modify a
runtime policy.
