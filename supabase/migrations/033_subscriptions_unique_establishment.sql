-- 033: the Stripe webhook upserts subscriptions with onConflict:'establishment_id'
-- but only a non-unique index existed, so the upsert would fail and the
-- subscription record (holding stripe IDs for the billing portal + renewal/
-- cancel handling) would never persist. One active subscription per
-- establishment is correct, so enforce it. (2026-09-20 Stripe readiness audit.)
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_establishment_id_key UNIQUE (establishment_id);
