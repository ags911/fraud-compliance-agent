# IEEE-CIS Fraud Detection corpus intake — proposed, not pursued

Decision (2026-09-22): the project owner chose to continue with Sparkov as the
training/benchmark corpus rather than pursue this candidate, and its blocking
Kaggle-competition licence question (below) was never resolved. The evaluation
below is kept as a record of that comparison, not as an active proposal.

Status: **Proposed research/demo corpus; not acquired; not approved for model
training or runtime use.** This is a metadata-only check against public
listings and third-party write-ups. No file has been downloaded, and no
schema, row count, or checksum below has been verified against local data.

## Candidate

The candidate is the
[IEEE-CIS Fraud Detection](https://www.kaggle.com/competitions/ieee-fraud-detection)
Kaggle competition dataset, provided by Vesta Corporation: real e-commerce
card-not-present transactions with a real fraud label (confirmed chargebacks),
plus a companion identity/device table.

## Why it was checked

It is the only candidate here with **real fraud labels**, and its identity
table documents device and browser signals, which is closer in kind (though
not in payment type) to the device/session evidence tool your showcase agent
already calls. See
[`fast-path-fraud-model-technical-spec.md`](fast-path-fraud-model-technical-spec.md).

## Licence — blocking, needs a named reviewer before acquisition

This is a **Kaggle competition** dataset, not a CC0/ODbL public dataset like
Sparkov or the ULB card-fraud set. General Kaggle competition rules (not the
competition-specific rules page, which an automated fetch could not read
because it is JavaScript-rendered) restrict data use to "the competition,
participation on Kaggle website forums, academic research and education, and
other non-commercial purposes, unless otherwise restricted by specific
competition rules," and prohibit redistributing data "to any party not
participating in the competition."

This project is a **public recruiter/employer showcase repository**. Committing
this data, or even a sanitised manifest derived from it, may not fit "academic
research and education" or "non-commercial purposes," and redistribution to a
public repository's readers is plausibly exactly what the generic clause
forbids. **Do not acquire this corpus until a named reviewer reads the current
competition-specific rules page in full and confirms local research use (never
committing raw data, matching the Sparkov intake's own boundary) is
permitted.** Unlike the PaySim question, this is not a reconciliation of two
sources — it is a real possibility that the licence does not permit this
project's use at all.

## Expected schema (from public documentation, not verified locally)

Reported by the competition's own data description and secondary sources; not
independently verified:

| File | Join key | Contents |
| --- | --- | --- |
| `train_transaction.csv` / `test_transaction.csv` | `TransactionID` | `isFraud` (train only), `TransactionDT` (a time delta from an arbitrary reference, not a real timestamp), `TransactionAmt`, `ProductCD`, `card1`–`card6` (card/issuer attributes), `addr1`/`addr2`, `dist1`/`dist2`, `P_emaildomain`/`R_emaildomain`, `C1`–`C14`, `D1`–`D15`, `M1`–`M9`, and `V1`–`V339` (Vesta-engineered, largely undocumented features) |
| `train_identity.csv` / `test_identity.csv` | `TransactionID` (not every transaction has a matching row) | Device type, device info, and `id_01`–`id_38` covering browser/OS fingerprint-style signals |

Reported scale (from secondary sources, unverified): about 590,540 training
transactions, 434 columns after joining, roughly 3.5% fraud prevalence.

## Fit to this project's scenarios

- **Real labels are a genuine step up** from every synthetic candidate: a
  score here is evidence against real chargeback outcomes, not a simulator's
  rules. This is the one candidate that could support a claim closer to real
  detective performance, subject to the usual caveats about competition-era
  fraud patterns ageing.
- **Still card-not-present, not push-payment.** It doesn't close the
  transfer/account-drain gap PaySim addresses; `TransactionAmt` and card
  attributes are closer to Sparkov's shape than to S02/S03. The identity
  table's device/browser signals are the closest external match to the
  showcase's `get_device_session_evidence` tool of any candidate checked,
  though still e-commerce sessions rather than a banking app session.
- **`V1`–`V339` are opaque.** They are Vesta's own engineered features with
  undisclosed meaning. That conflicts with this project's feature-availability
  discipline (every feature needs a stated source and an online-parity
  argument): most of the predictive power in public solutions to this
  competition reportedly comes from these columns, so using them as a black
  box would undermine the interpretability the accepted benchmark protocol
  values, and excluding them would likely erase most of the accuracy
  advantage this corpus would otherwise offer.
- **`TransactionDT` is a delta, not a timestamp.** A chronological split (as
  the project's protocol requires) is possible but needs its reference point
  established; secondary sources describe it as relative only.

## Known limitations

- Real fraud, but from one processor's card-not-present traffic in one past
  period; it does not establish fraud-model performance for this project's
  domain (bank-transfer/APP fraud) or for a current period.
- Heavier engineering cost than either synthetic candidate: 434 columns, many
  undocumented, and a train/test join across two files per split.
- Licence status is the blocking question (see above), independent of any
  technical merit.

## Proposed next decision

Do not acquire. A named reviewer must resolve the licence question first, and
that answer may simply be no for a public repository. If it is resolved
favourably, this would still need its own controlled local intake and
feasibility review under the same protocol as Sparkov; it could not reuse
Sparkov's or PaySim's results, and a separate decision would be needed on
whether the `V1`–`V339` columns may be used at all given the project's feature-
transparency rule.
