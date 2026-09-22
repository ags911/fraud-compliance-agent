# PaySim corpus intake — proposed, not pursued

Decision (2026-09-22): the project owner chose to continue with Sparkov as the
training/benchmark corpus rather than acquire PaySim, and to pursue Plaid
Sandbox for showcase-fixture enrichment instead (see
[`plaid-sandbox-showcase-fixtures.proposed.md`](plaid-sandbox-showcase-fixtures.proposed.md)).
The evaluation below is kept as a record of that comparison, not as an active
proposal; nothing here is acquired or approved, and no further work against
this document is planned unless that decision is revisited.

Status: **Proposed research/demo corpus; not acquired; not approved for model
training or runtime use.** The licence and the schema/warning below were read
directly from the live Kaggle page on 2026-09-22. No file has been
downloaded, so no row-level content, checksum, or exact row count has been
verified against local data.

## Candidate

The candidate is [PaySim](https://www.kaggle.com/datasets/ealaxi/paysim1), a
synthetic mobile-money transaction simulator, distributed on Kaggle as
"Synthetic Financial Datasets For Fraud Detection". Its origin is
[Lopez-Rojas, Elmir, and Axelsson (2016), "PaySim: A financial mobile money
simulator for fraud detection"](https://github.com/EdgarLopezPhD/PaySim), *The
28th European Modeling and Simulation Symposium (EMSS)*.

## Why it was checked

Unlike Sparkov (card-present retail purchases), PaySim models push transfers
and cash-outs with account balances, which is structurally closer to the
project's APP-drain and account-drain scenarios (S02/S03). See
[`fast-path-fraud-model-technical-spec.md`](fast-path-fraud-model-technical-spec.md)
and the S01–S08 scenario set for the target shape.

## Licence — confirmed: CC BY-SA 4.0, distinct from the simulator code's GPL-3.0

Two licence statements exist, for two different things:

- The **simulator source code** ([EdgarLopezPhD/PaySim](https://github.com/EdgarLopezPhD/PaySim),
  the program that generates PaySim data) is GPL-3.0. This project does not
  intend to use or redistribute that code.
- The **Kaggle-hosted CSV** (`ealaxi/paysim1`), which is what would actually be
  downloaded, states **License: CC BY-SA 4.0** directly on its Kaggle page
  (confirmed by opening the live page on 2026-09-22, linking to
  `creativecommons.org/licenses/by-sa/4.0`).

CC BY-SA 4.0 is an ordinary open-content licence with two conditions:
**attribution** (already required by the citation below) and **ShareAlike**
(any published derivative — a sanitised manifest, for instance — must carry
the same CC BY-SA 4.0 licence). ShareAlike applies to the published data
artifact, not to this MIT-licensed project's code, so it does not require
relicensing the repository. Licence acquisition is clear to proceed on this
point.

## Schema and the source's own leakage warning (confirmed from the live Kaggle page)

The dataset's own listing states this warning verbatim, in its own bold
heading, above the column descriptions:

> **NOTE: Transactions which are detected as fraud are cancelled, so for
> fraud detection these columns (`oldbalanceOrg`, `newbalanceOrig`,
> `oldbalanceDest`, `newbalanceDest`) must not be used.**

This is the author saying, in the dataset's own documentation, that its
balance-before/after columns are not safe fraud-detection features: a fraud
transaction's balances reflect the simulator cancelling it, not the attempted
transfer, so a model trained on them would be learning the cancellation
mechanic, not fraud behaviour. **This is the exact feature this note
originally recommended PaySim for** (see "Fit to this project's scenarios"
below). That recommendation needs to be read as substantially weakened by
this warning, not merely caveated.

| Column | Meaning | Usable per the source's own warning? |
| --- | --- | --- |
| `step` | Simulation time unit (1 step = 1 hour of a 744-step, 30-day run); not a real-world timestamp | Yes |
| `type` | `CASH_IN`, `CASH_OUT`, `DEBIT`, `PAYMENT`, `TRANSFER` | Yes |
| `amount` | Transaction amount, in an unspecified "local currency" | Yes |
| `nameOrig`, `nameDest` | Simulated originating/destination account identifiers | Identifier only, as with Sparkov |
| `oldbalanceOrg`, `newbalanceOrig`, `oldbalanceDest`, `newbalanceDest` | Account balances before/after | **No — the source warns these leak the label** |
| `isFraud` | Simulated fraud label: an agent taking over an account and draining it via transfer then cash-out | — |
| `isFlaggedFraud` | The simulator's own naive rule (any single transfer over 200,000), not a model output | Exclude as a feature, same as Sparkov's excluded identifiers |

Confirmed directly from the page: licence CC BY-SA 4.0, one file
(`PS_20174392719_1491204439457_log.csv`, 493.53 MB), described as "scaled down
1/4 of the original dataset" (whose full run produced "approximately 24
million" records). The commonly cited row count of 6,362,620 is consistent
with that 1/4 scaling but was not read as an explicit figure on the page
itself, so it remains a secondary-source number pending an actual row count
from the downloaded file.

## Fit to this project's scenarios (revised after reading the source warning)

- **The main advantage this note originally claimed does not hold.** The
  balance-before/after fields that looked like a natural "account drain"
  feature for S03 are the exact fields the source warns must not be used for
  fraud detection, because they leak the label through the simulator's own
  cancellation mechanic. Any S03-shaped feature would need to be built from
  `type` (`TRANSFER` followed by `CASH_OUT`) and `amount` alone, which is a
  much weaker signal than the balance fields promised.
- **The transfer-versus-purchase shape is still a genuine improvement over
  Sparkov**, independent of the balance columns: `type` gives real transfer
  semantics (`TRANSFER`, `CASH_OUT`) that Sparkov has no equivalent for at
  all, so PaySim is still the closer match for what an APP-fraud scenario
  looks like structurally, just with a narrower usable feature set than
  first thought.
- **No improvement on S04's evidence gap:** no device, session, or payee-
  relationship field exists in either source, so S04-style evidence stays
  synthetic regardless of corpus.
- **`step` is not a timestamp.** Any month-partitioned or time-of-day feature
  the current benchmark protocol uses (see
  [`richer_features.py`](../../apps/api/modelling/richer_features.py) and the
  Sparkov leakage-safe temporal design in
  [`07-leakage-and-evaluation-design.md`](../experiments/07-leakage-and-evaluation-design.md))
  would need rework, since only relative ordering, not wall-clock time, is
  available.
- **`isFlaggedFraud`** is a rule output embedded in the data, not a label; a
  model must not be allowed to see it as a feature, mirroring the exclusion of
  Sparkov's identifier columns.

## Known limitations

- Simulated label, same as Sparkov: evidence of pipeline mechanics, not
  external fraud-detection validity.
- `nameOrig`/`nameDest` are simulated account references, not Plaid or
  production account identifiers, and do not establish feature parity.
- The published file is stated as "scaled down 1/4 of the original dataset,"
  so it is a sample of a larger simulator run, not the full output; whether
  that sampling is representative is not established here.
- The balance columns' leakage warning (above) removes what this note
  originally treated as the corpus's main advantage; a reviewer should
  re-weigh PaySim against Sparkov on the strength of `type`/`amount`/`step`
  alone before treating this as clearly preferable.

## Proposed next decision

Licence is confirmed and no longer blocks acquisition. Before acquiring,
decide how a published derived manifest will carry the required CC BY-SA 4.0
attribution and ShareAlike notice, and confirm the balance columns will be
excluded as features (not just flagged) in any adapter, mirroring how
Sparkov's identifier columns are excluded. If proceeding, follow the same
controlled local intake as
[`sparkov-corpus-intake.proposed.md`](sparkov-corpus-intake.proposed.md):
manual download to ignored `data/raw/`, a schema/aggregate/checksum-only
inspection notebook (mirroring `make corpus-sparkov-inspect`), and a feasibility
review before any training use. This corpus cannot inherit Sparkov's feasibility
or benchmark results; it needs its own.
