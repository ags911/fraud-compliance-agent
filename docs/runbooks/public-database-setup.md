# Public database setup

How to switch on saved cases, the live feed and Sandbox analytics on the
public showcase, as ADR-021 allows. Work through the steps in order: each
one depends on the one before. Allow about two hours, plus up to a day of
waiting for the budget alert in step 9.

## Before you start

You need:

- a Neon account (London region);
- access to the Doppler project, the showcase config behind the
  `DOPPLER_TOKEN` GitHub secret, and your local development config (it holds
  the Plaid Sandbox keys and `SANDBOX_PSEUDONYMISATION_KEY`);
- admin access to the GitHub repository (Settings, Environments, Actions);
- the Azure CLI signed in to the showcase subscription (for step 9 only);
- `psql` on your machine (`brew install libpq`, then add it to your PATH).

**The one rule to keep.** The Sandbox routes (analytics, decisions and the
live feed) use the database whenever `DATABASE_URL` is set, whatever the
flags say. So never add `DATABASE_URL` to the showcase Doppler config unless
the same deploy also sets `PUBLIC_DATABASE_GUARDS_ENABLED=true` (steps 5 and
6). Without the guards, the public database has no per client limits and no
row ceilings.

## 1. Create the Neon project

1. In Neon, create a project named `fca-showcase` in **AWS Europe (London)**.
2. Keep the default database `neondb` and its owner role `neondb_owner`. The
   owner role is the **migration role**: it creates and changes tables, and
   the app never uses it.
3. Open **Connect**, choose the owner role, turn **Connection pooling off**,
   and copy the connection string. This is your `DATABASE_MIGRATION_URL`.
   Make sure it ends in `?sslmode=require`.
4. Check the plan against the row ceilings the guards enforce (20,000 cases,
   2,000 feed runs, 400,000 feed events). If you are on a paid plan, set
   Neon's spending limit now.

## 2. Create the app's least privilege role

Create this role with SQL, not in the Neon console: roles made in the
console get broad rights. In the Neon SQL editor, signed in as
`neondb_owner`, run the following, with a long random password
(`openssl rand -base64 32 | tr -d '/+='` makes one):

```sql
CREATE ROLE showcase_app WITH LOGIN PASSWORD '<password>';
GRANT CONNECT ON DATABASE neondb TO showcase_app;
GRANT USAGE ON SCHEMA public TO showcase_app;
-- Tables the migrations create later are granted automatically.
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO showcase_app;
```

Your runtime URL is the migration URL with the user and password swapped:
`postgresql://showcase_app:<password>@<same host>/neondb?sslmode=require`.
This is your `DATABASE_URL`. Keep both URLs in a password manager until
step 4.

## 3. Create the tables and load the Sandbox data

Run these from `apps/api` on your machine, using the **migration** URL:

```bash
cd apps/api
DATABASE_URL='<DATABASE_MIGRATION_URL>' uv run python scripts/apply_sandbox_migrations.py
```

You should see `migrations applied`. Then load the sanitised Sandbox data.
This runs with your local Doppler config, which supplies the Plaid Sandbox
keys, and points it at the new database:

```bash
doppler run -- env DATABASE_URL='<DATABASE_MIGRATION_URL>' PLAID_ENV=sandbox \
  uv run python scripts/import_plaid_sandbox_history.py
```

You should see a line ending in `sanitised events across S01-S08`.

Then check the app role, using the **runtime** URL:

```bash
psql '<DATABASE_URL>' -c 'SELECT count(*) FROM sandbox_datasets;'
psql '<DATABASE_URL>' -c 'CREATE TABLE should_fail (i int);'
```

The first should return a number above zero. The second **must fail** with
`permission denied`. That proves the app cannot change the schema.

## 4. Add the migration secret to Doppler

In the Doppler **showcase** config, add `DATABASE_MIGRATION_URL`. This lets
future deploys run migrations through the workflow.

Do **not** add `DATABASE_URL` yet.

## 5. Set the four switches in GitHub

In GitHub, open **Settings, Environments, showcase, Environment variables**
and add:

| Variable | Value | Why |
|---|---|---|
| `SHOWCASE_CASES_ENABLED` | `true` | Saves investigation runs as cases |
| `SIMULATION_WORKER_ENABLED` | `true` | Runs the live feed, **and** the sweeps that delete cases after 30 days and runs after 7. Cases must not be on without it |
| `PUBLIC_DATABASE_GUARDS_ENABLED` | `true` | Per client limits and row ceilings |
| `SHOWCASE_TRUSTED_PROXY_HOPS` | `1` | Azure's ingress adds the visitor's address as the last `X-Forwarded-For` entry. At `0`, every visitor would share one limit. Step 7 proves `1` is right |

## 6. Deploy

1. In the Doppler showcase config, add `DATABASE_URL` (the **runtime** URL).
2. In GitHub, open **Actions, Deploy public showcase, Run workflow** on
   `main`. Tick **confirm_deploy** and **apply_sandbox_migrations**. The
   migrations are safe to rerun, and this proves the workflow's migration
   path works.
3. When it finishes, the run summary shows the web and API URLs.

## 7. Confirm the proxy hops

This takes about five minutes and needs a second network (your phone on
mobile data).

**Test A: a fake header cannot dodge the limit.** From your machine, send 65
case reads in under a minute, each with a different fake
`X-Forwarded-For`:

```bash
API='<API URL from the run summary>'
ID=$(uuidgen | tr 'A-Z' 'a-z')
for i in $(seq 1 65); do
  curl -s -o /dev/null -w '%{http_code}\n' \
    -H "X-Showcase-Browser-Id: $ID" -H "X-Forwarded-For: 203.0.113.$i" \
    "$API/cases"
done | sort | uniq -c
```

Expect about 60 `200` and at least 5 `429`. If every line is `200`, the
fake header is being trusted: set `SHOWCASE_TRUSTED_PROXY_HOPS` to `0`,
redeploy, and stop there.

**Test B: visitors do not share one limit.** Straight after test A, within
the same minute, open the site's Cases tab on your phone with Wi-Fi off. It
should load normally. If it shows a "Too many case reads" error, all
visitors are sharing one identity, so the hop count is too low.

## 8. Check the features on the live site

1. Run an investigation. The Cases tab should list it as saved, with the
   privacy note: "Saved cases are linked only to a random ID kept in this
   browser, and are deleted after 30 days. Nothing else about you is
   stored."
2. Copy its `?case=` link into a new tab. The case drawer should open.
3. Start a live feed, watch payments route, then stop it: the stopped board
   keeps its counts. Reload the page: the board resets (spec 0006 keeps
   display state in the browser only), but every saved feed case is still
   listed.
4. ADR-021 also asks for spec 0002's and 0003's `verify.md` to pass
   against the deployed site. Ask Claude to run `/check verify 0002` and
   `/check verify 0003` with the web URL.

## 9. Prove the budget alert arrives

The budget `fraud-compliance-showcase-rg-showcase-budget` alerts at 80% and
100% of 10 per month. To prove an email really arrives, lower it below this
month's spend (see **Cost Management** in the Azure portal), then put it
back:

```bash
az deployment sub create \
  --location uksouth \
  --template-file infra/azure/subscription.bicep \
  --parameters \
    resourceGroupName=fraud-compliance-showcase-rg \
    location=uksouth \
    monthlyBudgetAmount=1 \
    budgetAlertEmail='<monitored mailbox>' \
    budgetStartDate='2026-09-01'
```

Azure checks budgets a few times a day, so the email can take up to a day.
Once it arrives, rerun the same command with `monthlyBudgetAmount=10`.

## 10. Rollback drill

This proves you can switch the database off quickly.

1. In Doppler, delete `DATABASE_URL` from the showcase config. Turning the
   flags off alone is not enough (see "The one rule to keep").
2. In GitHub, set the four variables back to `false`, `false`, `false` and
   `0`.
3. Rerun the deploy with only **confirm_deploy** ticked.
4. Check: the Cases tab shows "Not saved: case history is off in this
   environment", and the live feed and charts show their fallbacks. In
   Neon's **Monitoring** page, no new connections appear after the deploy.

Then repeat steps 5 and 6 to switch it back on.

## 11. Record the results

Tell Claude the outcome of steps 7 to 10. It will record them in ADR-021's
addendum and the progress tracker. Once every ADR-021 Verification item is
recorded, the public database is fully enabled.
