# Consume meal: pantry only

Run `supabase/migrations/20260912_consume_meal_from_pantry.sql` in FoodWorth's Supabase SQL editor. It creates a function using existing meals, meal_items and pantry tables. No consumption table, dates, nutrition history or home screen changes are included.

Clicking Consume meal deducts each ingredient's recipe amount from the signed-in user's pantry.amount_remaining. Missing ingredients are skipped. If 100g is needed but only 60g remains, the available 60g is removed. Rows are deleted when they reach zero.

The database performs the whole operation in one transaction and locks matching pantry rows. Errors roll back all deductions. The client disables the button while saving and never automatically retries: without a persisted request ledger, a lost response cannot be safely retried automatically. Check the pantry before submitting again after a connection failure.

This replaces the previously proposed nutrition-logging migration, which should not be run for this feature. No hosted database changes have been made by Codex.

Tests: node --test tests/mealConsumption.test.cjs
For SQL tests, install @electric-sql/pglite in a temporary directory, set FOODWORTH_PGLITE_PATH to that module directory, and run node --test tests/mealConsumption.sql.test.cjs. These use isolated PostgreSQL fixtures, not the live Supabase project.
