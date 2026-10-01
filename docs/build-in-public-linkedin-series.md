# Averlynx build in public LinkedIn series

## 1. Before an AI Decision, What Would You Need to Prove?

What would it take to show not just what an AI system decided, but why it decided it and whether the next step was properly authorised?

I did not start Averlynx by training a model. I started by auditing the demo.

Averlynx is a personal portfolio build using synthetic payment scenarios. It does not process real payments, collect customer data, or claim production fraud performance.

The first fixes were unglamorous but necessary. A screen implied a signature had been verified when the code only knew that a signature existed. That language changed. Private infrastructure was made optional, and CI was added to prove the API could run without it.

Then came validation, redacted errors, accessibility checks, dependency scanning and browser tests.

If a system cannot state precisely what was checked, recorded or authorised, an audit trail is only a story about trust.

Later in this series, I will return to the question of independently verifiable decision records. I do not have the finished answer yet.

## 2. Can You Trust a Fraud Model You Cannot Reproduce?

The first model question was not, “How accurate is it?”

It was, “Could I reproduce this result next week and explain exactly where it came from?”

I used Sparkov, a public synthetic card fraud corpus, to exercise the modelling pipeline. The data was checksum pinned. Quality gates rejected unexpected columns, missing values and invalid partitions. Training settings moved out of notebook cells into versioned configuration, while reusable logic moved into tested application code.

The result was a clear comparison: logistic regression as a transparent baseline, and XGBoost as the stronger tabular candidate.

But the important boundary stayed in place. These are simulated data results, not evidence of real world fraud performance. A good benchmark can prove that a pipeline works. It cannot prove that a model is ready to make real financial decisions.

## 3. When Does an AI Recommendation Become Reviewable?

A model score alone is not an explanation.

For Averlynx, I built one narrow AI investigation path: S04, an ambiguous synthetic payment scenario. The agent can use only three server controlled, read only evidence tools. It has a maximum tool budget. Every visible claim must cite evidence returned during that same run.

If the evidence is mixed, it can recommend `CHALLENGE`. If the provider is unavailable, times out, exceeds its tool budget or returns invalid output, the result is an explicit fail safe `HOLD`.

This is the point where the system first produces something worth reviewing: a specific recommendation, a bounded evidence trail and a clear account of what it did not know.

The next challenge is not making the agent sound more confident. It is preserving this decision trail in a way that can be independently checked later.

## 4. Why I Made the AI Fail Safe Instead of Look Clever

Most AI demos are built around the happy path.

I wanted Averlynx to make its failure mode visible.

The public showcase defaults to recorded playback. A live model is optional, switched off by default and limited by time, concurrency and request budgets. There is no second model waiting silently in the background if the first one fails.

When an investigation cannot complete, Averlynx does not pretend it reached a confident conclusion. It records an incomplete investigation, returns `HOLD`, evaluates no authority and takes no simulated action.

That is less dramatic than a seamless AI experience. It is also more honest.

For a payment risk system, “I do not know” should be an operational state, not an error message hidden behind a polished interface.

## 5. From Static Demo Data to a Safe, Replayable Timeline

A static scenario can explain a decision. It cannot honestly show how decisions change over time.

So I added a controlled data layer using Plaid Sandbox history. The import is explicit and separate from the app itself. Data is sanitised and pseudonymised before use, raw responses and tokens stay out of the repository, and the app never calls Plaid while someone is viewing the console.

Each scenario gets its own isolated timeline and deterministic overlay. The same starting state and seed reproduce the same feed.

This was an important distinction: the console can now show a realistic looking time series without pretending it is live customer activity.

The goal is not realism for its own sake. It is a repeatable environment where a decision can be inspected, replayed and tested safely.

## 6. A Dashboard Is Not an Audit Trail

A chart can show that something happened. It cannot tell you enough about one specific decision.

That became clear once the live feed was working.

Averlynx now decides each synthetic payment when a feed starts. Non `PASS` outcomes become saved cases. Each case holds the route, recommendation, evidence count, event sequence, decision basis and relevant model information.

The console can show aggregate routing over time, but a reviewer can also open a particular case and inspect why it became `CHALLENGE` or `HOLD`.

That distinction matters. A dashboard is useful for orientation. A case record is where scrutiny begins.

The next question is how to make that record durable and independently checkable without giving the record keeping layer control over the decision itself.

## 7. I Deleted Most of the Product UI

At one point, Averlynx had separate dashboard, benchmark, transaction, investigation and simulation pages.

They looked polished. They also suggested a more complete product than the backend could honestly support.

So I removed them.

The final interface is one Risk Console with three views: Scenario, Cases and Model. Each corresponds to something the system can actually substantiate: sanitised scenario activity, reviewable saved cases and a clearly labelled mechanics only benchmark.

This was not a retreat from ambition. It was a correction in product design.

A portfolio project should not look more operational than it is. The strongest interface is often the one that removes the most unsupported claims.

## 8. The Model Can Escalate a Payment, But Never Clear One

The next step was letting the model influence a decision without giving it unchecked authority.

Averlynx starts with deterministic rules. A rule can issue `PASS`, `CHALLENGE` or `HOLD`. The XGBoost score is then allowed to do one thing only: raise a rule cleared payment to `CHALLENGE` or `HOLD`.

It can never lower a rule decision.

Every model raised case stores the score, the two applicable thresholds, the model version, the policy version and the original rule result. The demo also uses clearly labelled planted synthetic outliers to show the kind of case the model is designed to catch.

The model is not replacing policy. It is creating an additional reason to look again.

## 9. Can AI Explain Operations Without Inventing Facts?

After building an AI investigator, I built a much less powerful AI feature: a dashboard writer.

The operations overview can summarise the selected scenario, its transaction activity and recommendation counts. But the server builds the facts first. If a live model is enabled, every number it writes must match those facts exactly. If it is unavailable, slow or invents a figure, the console falls back to a labelled template.

The overview cannot change a route, alter a recommendation or create a case.

That boundary is deliberate. Writing about a decision is not the same as making one.

I also finished the public release work here: accessible interaction checks, clearer cold start messaging, a cost bounded weekday warm window and a reviewer guide explaining what the demo does and does not claim.

Averlynx is now a stronger portfolio build because its limits are visible.
