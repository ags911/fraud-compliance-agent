# Sparkov corpus intake — proposed

Status: **Proposed research/demo corpus; not approved for model training or runtime use**

## Candidate

The candidate is Kaggle's [Credit Card Transactions Fraud Detection
Dataset](https://www.kaggle.com/datasets/kartik2112/fraud-detection), generated
using Sparkov and also described by the [Fraud Dataset
Benchmark](https://github.com/amazon-science/fraud-dataset-benchmark). Kaggle
metadata was checked on 2026-09-17: it declares **CC0: Public Domain**, is about
502 MB, covers simulated transactions from 2019-01-01 through 2020-12-31, and
describes 1,000 customers and 800 merchants. Re-verify the current source terms
at acquisition time; this note is not legal advice or a licence grant.

## Intended use and boundary

- **Permitted proposed use:** reproducible research/demo evaluation of the
  ingestion, feature, temporal-split, model-comparison, and monitoring
  mechanics.
- **Not permitted:** a production-performance claim, a runtime risk decision,
  an assertion of Plaid feature parity, or redistribution of raw files from
  this repository.
- **Prediction target:** `is_fraud` / `is_fraud`-equivalent source label,
  subject to a reviewer confirming its exact source meaning and availability
  time. It represents simulated card-payment fraud only; it is not an APP-fraud
  label or a customer/reviewer disposition.

## Why this is the first candidate

The expected source schema is understandable enough to exercise a neutral
payment-event adapter: event time, amount, merchant, category, customer-like
reference, transaction-like reference, and a binary fraud label. It also has a
synthetic provenance, which makes it appropriate for a public portfolio demo
without treating real people’s financial activity as test data.

## Known limitations

- Synthetic scenario mechanics can be learnt by a model; results are therefore
  evidence of pipeline operation, not external fraud-detection validity.
- Expected location, name, and account-like fields are not product features by
  default and must not be exposed, committed, or used without explicit feature
  approval.
- The source’s fraud-generation and label-availability process may not match a
  payment processor’s mature chargeback process.
- Any later partner corpus must be evaluated independently under the frozen
  protocol; it cannot inherit this corpus’s results.

## Controlled local intake

1. A named reviewer verifies the source URL, current source terms, and intended
   research/demo use.
2. Download the raw file manually to ignored `data/raw/` storage. Do not commit
   or copy it into `fixtures/`.
3. Run `make corpus-sparkov-inspect` with
   `FCA_SPARKOV_DATASET_PATH` set to the local CSV. The command emits only
   schema, aggregate, and checksum evidence; it never prints rows or values.
4. Review the generated manifest, schema coverage, label availability, and
   proposed feature exclusions in Notebook 06.
5. Create `corpus-and-label-feasibility.proposed.json` only after review. An
   authorised decision owner must accept the corpus/target and evaluation
   protocol before Notebook 08 may run in approved-data mode.

## Local acquisition evidence — 2026-09-17

The supplied Kaggle archive was acquired into ignored `data/raw/` storage and
inspected without printing rows. This records observed source facts only; it is
not corpus approval.

| File | Rows | Label `0` | Label `1` | SHA-256 |
| --- | ---: | ---: | ---: | --- |
| Archive | — | — | — | `4e32829b9ba5a6b17af707c513c15204011044df0e8971e431cedca3d8c0a8a1` |
| `fraudTrain.csv` | 1,296,675 | 1,289,169 | 7,506 | `fd7139200dbfcbed0b6742bbe05a4f1abce532c4fef20918228a651647a3e75d` |
| `fraudTest.csv` | 555,719 | 553,574 | 2,145 | `12d553ab19440c752d2531ee1af44bb64f12cc3d3839f1649f19e81c230545f0` |

Both files contain the required event time, amount, merchant, category,
transaction reference, and label fields. Both include one unnamed CSV export
index column, which the inspector records and ignores. They also contain the
sensitive/source-specific fields listed in the exclusions above. The source
train/test naming does **not** prove a leakage-safe chronological partition or
label maturity; Notebook 07 must establish those independently.

## Expected neutral mapping for review

| Neutral concept | Expected source field | Default handling |
| --- | --- | --- |
| Event time | `trans_date_trans_time` | Candidate decision-time boundary; validate parseability and ordering. |
| Amount | `amt` | Candidate feature; validate currency/unit assumptions before use. |
| Merchant/category | `merchant`, `category` | Candidate categorical inputs; normalise only after feature approval. |
| Source event reference | `trans_num` | Lineage/deduplication only; pseudonymise before any derived artifact. |
| Customer-like reference | `cc_num` | Do not use by default; sensitive/source-specific and requires an explicit decision. |
| Fraud outcome | `is_fraud` | Evaluation label only; verify source semantics and availability time. |

## References

- [Fraud Dataset Benchmark data-source inventory](https://github.com/amazon-science/fraud-dataset-benchmark#data-sources)
- [Fraud Dataset Benchmark paper](https://arxiv.org/abs/2208.14417)
- [Project data governance](../data-governance.md)
- [Fast-path model technical specification](FAST-PATH-FRAUD-MODEL-TECHNICAL-SPEC.md)
