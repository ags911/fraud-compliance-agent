"""Verify the credential-free parts of the MVP 3 deployment boundary."""

from __future__ import annotations

import json
import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _read(relative_path: str) -> str:
    """Read one required repository file."""
    return (ROOT / relative_path).read_text(encoding="utf-8")


def _require(text: str, fragment: str, source: str) -> None:
    """Fail when a required deployment invariant is absent."""
    if fragment not in text:
        raise SystemExit(f"{source} is missing required invariant: {fragment}")


def main() -> None:
    """Validate workflow, infrastructure, image, and static-host boundaries."""
    workflow = _read(".github/workflows/deploy-showcase.yml")
    main_bicep = _read("infra/azure/main.bicep")
    subscription_bicep = _read("infra/azure/subscription.bicep")
    dockerignore = _read(".dockerignore")
    dockerfile = _read("apps/api/Dockerfile")
    makefile = _read("Makefile")

    for fragment in (
        "workflow_dispatch:",
        "confirm_deploy:",
        "environment: showcase",
        "id-token: write",
        "packages: write",
        'if [ "$GITHUB_REF" != "refs/heads/main" ]',
        "brew install libomp",
        "docker manifest inspect",
        "az extension add --name staticwebapp --version 1.0.1 --yes",
        "az deployment group what-if",
        "az deployment group create",
        "az staticwebapp secrets list",
        "make acceptance-mvp3-public",
        "apply_sandbox_migrations:",
        "SHOWCASE_APPLY_SANDBOX_MIGRATIONS",
        "uv run --frozen python scripts/apply_sandbox_migrations.py",
        "steps.doppler.outputs.DATABASE_MIGRATION_URL",
        "Refuse an unguarded public database",
    ):
        _require(workflow, fragment, ".github/workflows/deploy-showcase.yml")

    action_refs = re.findall(r"uses:\s+[^\s@]+@([^\s#]+)", workflow)
    if not action_refs or any(
        not re.fullmatch(r"[0-9a-f]{40}", ref) for ref in action_refs
    ):
        raise SystemExit(
            "Every third-party deployment action must use a full commit SHA."
        )
    if ":latest" in workflow or "@latest" in workflow:
        raise SystemExit(
            "The deployment workflow must not consume a mutable latest reference."
        )

    for fragment in (
        "sku:",
        "name: 'Free'",
        "param staticWebAppLocation string = 'westus2'",
        "minReplicas: 0",
        "maxReplicas: 1",
        "allowInsecure: false",
        "destination: null",
        "'https://${staticWebApp.properties.defaultHostname}'",
        "name: 'SHOWCASE_LIVE_ENABLED'",
        "value: 'false'",
        "secretRef: 'groq-api-key'",
        "@secure()",
        "param databaseUrl string = ''",
        "name: 'DATABASE_URL'",
        "secretRef: 'database-url'",
    ):
        _require(main_bicep, fragment, "infra/azure/main.bicep")

    if re.search(r"name:\s*'DATABASE_URL'\s*\n\s*value:", main_bicep):
        raise SystemExit(
            "DATABASE_URL must use a Container App secret reference, not value."
        )

    required_settings = {
        "SHOWCASE_OVERVIEW_LIVE_ENABLED": "false",
        "SHOWCASE_CASES_ENABLED": "false",
        "SIMULATION_WORKER_ENABLED": "false",
        "PUBLIC_DATABASE_GUARDS_ENABLED": "false",
        "SHOWCASE_TRUSTED_PROXY_HOPS": "0",
    }
    for setting, default in required_settings.items():
        _require(main_bicep, f"name: '{setting}'", "infra/azure/main.bicep")
        if setting != "SHOWCASE_TRUSTED_PROXY_HOPS" and re.search(
            rf"name:\s*'{setting}'\s*\n\s*value:\s*'true'", main_bicep
        ):
            raise SystemExit(f"{setting} must default to false.")
        parameter = "".join(part.title() for part in setting.lower().split("_"))
        parameter = parameter[0].lower() + parameter[1:]
        _require(
            main_bicep,
            f"param {parameter} string = '{default}'",
            "infra/azure/main.bicep",
        )
    for fragment in ("threshold: 80", "threshold: 100", "contactEmails"):
        _require(subscription_bicep, fragment, "infra/azure/subscription.bicep")

    if dockerignore.splitlines()[7].strip() != "**":
        raise SystemExit(
            ".dockerignore must remain deny-all before its explicit allowlist."
        )
    if "vendor/arbiris-sdk" in dockerfile or "COPY apps/api/vendor" in dockerfile:
        raise SystemExit(
            "The public Dockerfile must not reference the private SDK tree."
        )
    for fragment in (
        "uv sync --frozen --no-dev",
        "USER app",
        "SHOWCASE_LIVE_ENABLED=false",
        # Without it, case storage turns itself off at startup (cases 503).
        (
            "COPY docs/contracts/public-showcase-events.v1.schema.json "
            "/app/showcase/docs/contracts/"
        ),
        # Spec 0010: without the policy, score routing turns itself off;
        # without the v2 schema, model raised payments save no case.
        "COPY config/sandbox-score-routing.v1.json /app/showcase/config/",
        (
            "COPY docs/contracts/public-showcase-events.v2.schema.json "
            "/app/showcase/docs/contracts/"
        ),
        # Spec 0011: without its accepted limits the overview route is 503.
        "COPY config/public-showcase-overview.v1.json /app/showcase/config/",
        (
            "COPY docs/contracts/sandbox-overview.v1.schema.json "
            "/app/showcase/docs/contracts/"
        ),
    ):
        _require(dockerfile, fragment, "apps/api/Dockerfile")
    for fragment in (
        "!docs/contracts/public-showcase-events.v1.schema.json",
        "!config/sandbox-score-routing.v1.json",
        "!docs/contracts/public-showcase-events.v2.schema.json",
        "!config/public-showcase-overview.v1.json",
        "!docs/contracts/sandbox-overview.v1.schema.json",
    ):
        _require(dockerignore, fragment, ".dockerignore")

    # Spec 0011 (AC-11): live overviews stay off unless an operator opts in,
    # in code as well as in the deployment template.
    _require(
        _read("apps/api/server/sandbox_data/overview_writer.py"),
        '_explicit_boolean("SHOWCASE_OVERVIEW_LIVE_ENABLED", False)',
        "apps/api/server/sandbox_data/overview_writer.py",
    )

    # A public checkout has no private SDK source tree, so every Make command
    # must reuse the frozen environment instead of resolving it again.
    _require(makefile, "UV_RUN := uv run --frozen", "Makefile")

    swa_config = json.loads(_read("apps/web/public/staticwebapp.config.json"))
    if swa_config.get("navigationFallback", {}).get("rewrite") != "/index.html":
        raise SystemExit("Static Web Apps must retain the product SPA fallback.")

    az = shutil.which("az")
    if az:
        for template in ("infra/azure/subscription.bicep", "infra/azure/main.bicep"):
            subprocess.run(
                [az, "bicep", "build", "--file", str(ROOT / template), "--stdout"],
                check=True,
                stdout=subprocess.DEVNULL,
            )
        print("MVP 3 deployment configuration and both Bicep templates passed.")
    else:
        print(
            "MVP 3 deployment configuration passed; Azure CLI is absent, so the "
            "pinned Bicep compile remains enforced by GitHub Actions."
        )


if __name__ == "__main__":
    main()
