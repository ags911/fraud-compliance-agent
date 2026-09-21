.PHONY: architecture-diagrams check acceptance-mvp0 acceptance-mvp1 acceptance-mvp2 acceptance-mvp3-predeploy acceptance-mvp3-public web-build web-lint web-design-check web-test api-test api-smoke api-lint api-format-check api-notebook-lint api-docstring-lint api-contract api-notebook-kernel notebook-policy-check notebook-policy-fix notebook-status notebook-synthetic corpus-sparkov-inspect corpus-sparkov-temporal-inspect corpus-sparkov-build-mechanics repository-inventory repository-inventory-check data-check

# Use the private Arbiris SDK when its submodule is initialised; otherwise run
# without it. The SDK-backed demo pipeline tests skip when it is absent.
SDK_EXTRA := $(if $(wildcard apps/api/vendor/arbiris-sdk/pyproject.toml),--extra sdk,)
UV_RUN := uv run $(SDK_EXTRA)

check: web-lint web-design-check web-build web-test api-lint api-format-check api-notebook-lint api-docstring-lint notebook-policy-check api-test

# Release gates are deliberately small compositions of the checks that prove a
# particular MVP boundary.  MVP 3 has separate pre-deploy and public-runtime
# gates because the latter cannot be truthfully run without Azure credentials.
acceptance-mvp0: check

acceptance-mvp1: web-lint web-design-check web-build web-test

acceptance-mvp2: api-test web-test
	bash ./scripts/run_mvp2_local_acceptance.sh

acceptance-mvp3-predeploy: check
	bash ./scripts/run_mvp3_local_acceptance.sh

acceptance-mvp3-public:
	bash ./scripts/verify_public_showcase.sh

web-build:
	npm --prefix apps/web run build

web-lint:
	npm --prefix apps/web run lint

web-design-check:
	npm --prefix apps/web run check:payments-design

web-test:
	npm --prefix apps/web run test:payments

api-test: api-smoke
	@if [ -d apps/api/tests ]; then cd apps/api && $(UV_RUN) pytest tests; else echo "No API-owned tests yet; smoke check completed."; fi

api-lint:
	cd apps/api && $(UV_RUN) ruff check server modelling

# Formatting is enforced for API code, tests, and scripts. Notebooks are excluded on purpose: they
# are prototyping artefacts, and reformatting them rewrites cell sources for no review value.
api-format-check:
	cd apps/api && $(UV_RUN) ruff format --check server modelling tests ../../scripts

api-notebook-lint:
	cd apps/api && $(UV_RUN) ruff check ../../notebooks ../../scripts

api-docstring-lint:
	cd apps/api && $(UV_RUN) ruff check --select D103 server modelling ../../notebooks ../../scripts

# Re-render the architecture diagrams from their D2 sources (needs the d2 CLI: `brew install d2`).
# Re-render every diagram and fail if one is over 900 units wide, so they all show at one scale.
# Needs the d2 CLI (`brew install d2`).
architecture-diagrams:
	python3 scripts/render_architecture_diagrams.py

# Regenerate only after deliberately changing the versioned showcase contract.
# The contract test prevents route drift when this target has not been run.
api-contract:
	cd apps/api && $(UV_RUN) python ../../scripts/generate_demo_api_contract.py

api-notebook-kernel:
	cd apps/api && $(UV_RUN) python -m ipykernel install --user \
		--name fraud-compliance-agent-api \
		--display-name "Fraud Compliance Agent API (Python 3.13)"

notebook-policy-check:
	cd apps/api && $(UV_RUN) python ../../scripts/validate_notebooks.py

notebook-policy-fix:
	cd apps/api && $(UV_RUN) python ../../scripts/validate_notebooks.py --fix

repository-inventory:
	cd apps/api && $(UV_RUN) python ../../scripts/generate_repository_inventory.py

repository-inventory-check:
	cd apps/api && $(UV_RUN) python ../../scripts/generate_repository_inventory.py --check

notebook-status:
	cd apps/api && $(UV_RUN) python ../../scripts/notebook_pipeline.py

notebook-synthetic:
	cd apps/api && $(UV_RUN) python ../../scripts/notebook_pipeline.py --run-synthetic

corpus-sparkov-inspect:
	@test -n "$$FCA_SPARKOV_DATASET_PATH" || (echo "Set FCA_SPARKOV_DATASET_PATH to a locally downloaded Sparkov CSV."; exit 2)
	cd apps/api && $(UV_RUN) python ../../scripts/inspect_sparkov_corpus.py

corpus-sparkov-temporal-inspect:
	@test -n "$$FCA_SPARKOV_TRAIN_PATH" || (echo "Set FCA_SPARKOV_TRAIN_PATH to fraudTrain.csv."; exit 2)
	@test -n "$$FCA_SPARKOV_TEST_PATH" || (echo "Set FCA_SPARKOV_TEST_PATH to fraudTest.csv."; exit 2)
	cd apps/api && $(UV_RUN) python ../../scripts/inspect_sparkov_temporal_evidence.py --train "$$FCA_SPARKOV_TRAIN_PATH" --test "$$FCA_SPARKOV_TEST_PATH"

corpus-sparkov-build-mechanics:
	@test -n "$$FCA_SPARKOV_TRAIN_PATH" || (echo "Set FCA_SPARKOV_TRAIN_PATH to fraudTrain.csv."; exit 2)
	@test -n "$$FCA_SPARKOV_TEST_PATH" || (echo "Set FCA_SPARKOV_TEST_PATH to fraudTest.csv."; exit 2)
	cd apps/api && $(UV_RUN) python ../../scripts/build_sparkov_mechanics_dataset.py --train "$$FCA_SPARKOV_TRAIN_PATH" --test "$$FCA_SPARKOV_TEST_PATH" --output ../../data/processed/sparkov-mechanics-v1.csv --manifest-output ../../data/manifests/sparkov-mechanics-v1.manifest.json

api-smoke:
	cd apps/api && $(UV_RUN) python -c "from server.main import create_app; app = create_app(); assert app.title == 'Fraud Compliance Agent Console API'; print('API import smoke check passed')"

# Data-preparation and evidence checks: the Sparkov build's quality gates on
# seeded synthetic data, contract/report/configuration consistency, the
# approved-mode write guard, and the rule that Notebook 08 stays a thin runner.
data-check:
	cd apps/api && $(UV_RUN) pytest tests/test_sparkov_build.py tests/test_contracts_consistency.py tests/test_modelling_boundaries.py tests/test_modelling_report.py tests/test_notebook_08_runner.py -q
