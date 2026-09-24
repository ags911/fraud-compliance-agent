"""Durable showcase investigation cases (spec 0002, proposed, internal only).

A case is one completed showcase run, stored from the accepted
public-showcase-events.v1 payloads the API already emits. Storage is off unless
``SHOWCASE_CASES_ENABLED`` and ``DATABASE_URL`` are both set, and it can never
alter or block the investigation stream.
"""
