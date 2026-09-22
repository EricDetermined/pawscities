# Supabase migrations — working convention

Every schema change must exist in **two** places, kept in lockstep:

1. **This folder** — a numbered `NNN_description.sql` file committed to the repo.
2. **Supabase → SQL Editor → saved queries** — a saved query named with the
   **same number + description** (e.g. `034 Widen engagement_queue.source`).

## Process for any new migration (per Eric, 2026-09-21)

Do NOT run migrations in a throwaway "Untitled query" scratch tab. Instead:

1. Create the next-numbered `.sql` file here and commit it.
2. In the Supabase SQL Editor, **create a new query**, paste the SQL, **Save it**,
   and **rename it** to `NNN description` (matching the file). Add a one-line
   description.
3. **Run** it. Confirm success.

This keeps the Supabase saved-query list as a canonical, numbered, executed
record that always matches the repo — so nothing is applied "invisibly."

## Notes

- Editing in the Supabase Monaco editor auto-closes brackets and mangles pasted
  multi-line SQL. Reliable path: write the SQL to the clipboard
  (`navigator.clipboard.writeText(...)`), then paste — no auto-close corruption.
- 031–034 were originally applied via scratch tabs and back-filled as saved,
  numbered queries on 2026-09-21 so Supabase (was 30) matched the repo (34).
