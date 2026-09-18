.PHONY: check web-build web-lint web-design-check web-test api-test api-smoke api-lint api-notebook-lint api-docstring-lint api-notebook-kernel notebook-policy-check notebook-policy-fix notebook-status notebook-synthetic corpus-sparkov-inspect corpus-sparkov-temporal-inspect corpus-sparkov-build-mechanics repository-inventory repository-inventory-check data-check

check: web-lint web-design-check web-build web-test api-lint api-notebook-lint api-docstring-lint notebook-policy-check api-test

web-build:
	npm --prefix apps/web run build

web-lint:
	npm --prefix apps/web run lint

web-design-check:
	npm --prefix apps/web run check:payments-design

web-test:
	npm --prefix apps/web run test:payments

api-test: api-smoke
	@if [ -d apps/api/tests ]; then cd apps/api && uv run pytest tests; else echo "No API-owned tests yet; smoke check completed."; fi

api-lint:
	cd apps/api && uv run ruff check server

api-notebook-lint:
	cd apps/api && uv run ruff check ../../notebooks ../../scripts

api-docstring-lint:
	cd apps/api && uv run ruff check --select D103 server ../../notebooks ../../scripts

api-notebook-kernel:
	cd apps/api && uv run python -m ipykernel install --user \
		--name fraud-compliance-agent-api \
		--display-name "Fraud Compliance Agent API (Python 3.11)"

notebook-policy-check:
	cd apps/api && uv run python ../../scripts/validate_notebooks.py

notebook-policy-fix:
	cd apps/api && uv run python ../../scripts/validate_notebooks.py --fix

repository-inventory:
	cd apps/api && uv run python ../../scripts/generate_repository_inventory.py

repository-inventory-check:
	cd apps/api && uv run python ../../scripts/generate_repository_inventory.py --check

notebook-status:
	cd apps/api && uv run python ../../scripts/notebook_pipeline.py

notebook-synthetic:
	cd apps/api && uv run python ../../scripts/notebook_pipeline.py --run-synthetic

corpus-sparkov-inspect:
	@test -n "$$FCA_SPARKOV_DATASET_PATH" || (echo "Set FCA_SPARKOV_DATASET_PATH to a locally downloaded Sparkov CSV."; exit 2)
	cd apps/api && uv run python ../../scripts/inspect_sparkov_corpus.py

corpus-sparkov-temporal-inspect:
	@test -n "$$FCA_SPARKOV_TRAIN_PATH" || (echo "Set FCA_SPARKOV_TRAIN_PATH to fraudTrain.csv."; exit 2)
	@test -n "$$FCA_SPARKOV_TEST_PATH" || (echo "Set FCA_SPARKOV_TEST_PATH to fraudTest.csv."; exit 2)
	cd apps/api && uv run python ../../scripts/inspect_sparkov_temporal_evidence.py --train "$$FCA_SPARKOV_TRAIN_PATH" --test "$$FCA_SPARKOV_TEST_PATH"

corpus-sparkov-build-mechanics:
	@test -n "$$FCA_SPARKOV_TRAIN_PATH" || (echo "Set FCA_SPARKOV_TRAIN_PATH to fraudTrain.csv."; exit 2)
	@test -n "$$FCA_SPARKOV_TEST_PATH" || (echo "Set FCA_SPARKOV_TEST_PATH to fraudTest.csv."; exit 2)
	cd apps/api && uv run python ../../scripts/build_sparkov_mechanics_dataset.py --train "$$FCA_SPARKOV_TRAIN_PATH" --test "$$FCA_SPARKOV_TEST_PATH" --output ../../data/processed/sparkov-mechanics-v1.csv --manifest-output ../../data/manifests/sparkov-mechanics-v1.manifest.json

api-smoke:
	cd apps/api && uv run python -c "from server.main import create_app; app = create_app(); assert app.title == 'Fraud Compliance Agent Console API'; print('API import smoke check passed')"

# Data-preparation and evidence checks: the Sparkov build's quality gates on
# seeded synthetic data, contract/report consistency, and the notebook 08 guard.
data-check:
	cd apps/api && uv run pytest tests/test_sparkov_build.py tests/test_contracts_consistency.py tests/test_notebook_08_report_path.py -q
