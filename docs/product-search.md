# Product name search

Run `supabase/migrations/20260917_product_search.sql` in Supabase SQL Editor
before using the updated app. No Edge Function deployment is needed.

The migration adds pg_trgm GIN indexes on both catalogue name columns and a
read-only `search_food_products` RPC. It runs with the caller's permissions and
existing RLS policies. No catalogue rows or permissions on the tables change.

Search still runs only on submit, preserves case-insensitive contains matching,
and lists packaged products first, then generic foods. Stable name/ID ordering
handles duplicate names. One RPC returns at most 51 rows; the app displays 50
and uses row 51 to enable Next. Previous remains available, and the page label
now reads “Page 2” rather than requiring an exact total. The shared meal ingredient
search benefits too.

This is a practical improvement, not a million-row performance guarantee.
One/two-character or very broad searches may still scan/sort many rows. Deep
pages still use OFFSET, and catalogue edits between requests can shift results.
Keyset pagination can be considered later if measurements justify it.

For an already large live catalogue, schedule index creation during a quiet
period: this simple transactional migration uses standard CREATE INDEX, which
can block writes while building. For a large busy database, build these indexes
CONCURRENTLY outside a transaction instead.

Verification: `tests/productSearch.test.cjs` tests the client page boundary;
`tests/productSearch.sql.test.cjs` tests actual pg_trgm creation, RLS and combined
pagination in PGlite. It is not a production-scale benchmark.
