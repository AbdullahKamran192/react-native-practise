# Food and meal logging

## Supabase setup

1. Run `supabase/migrations/20260912_food_consumption.sql` once if the table is not already installed.
2. Run `supabase/migrations/20260912_log_food_consumption.sql` to install the logging RPC.
3. For home-page Edit mode, run `supabase/migrations/20260912_remove_consumption_entry.sql`. This installs an owner-scoped function that physically deletes the whole consumption group and does not change pantry stock. No new columns or tables are added.

If the abandoned soft-deletion migration was installed, run `20260912_undo_delete_food_consumption.sql` BEFORE the new removal migration to remove the old function and deleted_at column. Do not run the undo script afterward, as it drops the deletion function.

Edit beside Today's Meals reveals red bin buttons. Each asks for confirmation. The cross exits Edit mode. Successful deletion removes the group from cached history and refetches it, recalculating daily totals and date colours. It never deletes catalogue products or saved recipes.

The hosted SQL has not been executed by Codex. The new function expects the existing products, product_corrections, generic_products, meals, meal_items and pantry schema. The old pantry-only function remains installed for compatibility, but the current meal screen uses the new logging function.

## Current behaviour

- Single food: select the amount, consumption date and pantry checkbox, then Log Food.
- Meal: Consume meal opens the date and pantry options, then Log meal saves the whole recipe.
- Both pantry checkboxes default to checked. Unchecked logs only; checked also deducts available stock and deletes exhausted rows. Missing stock never prevents logging.
- Single foods create one food_consumption row. Meals create one row per ingredient, all with the same group UUID.
- Snapshot nutrient columns contain totals for the consumed amount. Unknown values remain NULL. Recipe or catalogue edits never recalculate saved totals.
- Dates use the device's local calendar and time zone. Future dates are rejected. No 30-day retention cleanup or history display restriction is implemented yet.
- The home page displays saved consumption for a selected date, with a horizontal date strip and calendar covering today plus the previous 29 days. It uses the user's current targets, never historical targets.
- All seven nutrient totals are horizontally scrollable. Foods appear individually; meal ingredients are grouped by consumption group and expandable. Deleted recipes still display their saved meal names.
- The calorie dashboard and all nutrient cards include SVG progress rings that animate from zero over 2 seconds when the date or progress changes. Exact amounts remain visible; rings clamp at 100% and respect Reduce Motion. The main calorie card shows consumed calories, current target and remaining/over-target amount.
- Date colours use the lower of calorie and protein target completion: green >=100%, yellow >=75%, orange >=50%, red below 50%. No logs, missing calorie/protein values or unset targets show neutral grey. These are completion indicators; calorie excess is shown separately in the dashboard.
- History refreshes after logging (query invalidation), when returning to Home, when the app resumes, and on pull-to-refresh. The local calendar window advances at midnight while Home is open.
- Reads are paginated to avoid Supabase's row cap truncating totals. No new SQL is needed for the home page.

## Data sources and transactions

For scanned barcode foods, the existing catalogue submission helper saves the user's corrections first (and creates a missing shared product through the existing trigger). This separate catalogue save never changes pantry stock. The logging RPC then calculates nutrition using the user's saved corrections with shared values as fallback, matching single-product lookup. It rejects mixed g/ml units.

Generic foods and meal ingredients use the curated/shared catalogue respectively. Meal nutrition therefore matches the meal details calculation. The catalogue currently has no brand columns; single-food brands are captured from the screen when available, while meal ingredient brands remain NULL.

The logging RPC derives user ownership from auth.uid(), validates meal ownership, and inserts all snapshots and optional pantry deductions in one transaction. Any failure rolls back the log and stock changes together. It does not modify recipes.

## Retry handling

Before sending a log, the app persists the group UUID, original choices and time zone in AsyncStorage under the current user and food/meal. A failed or interrupted response leaves a Retry previous log action. Retrying reuses the saved payload, including after reopening that product or meal screen. The RPC serializes this user's requests and returns existing rows for an already-saved group without deducting again. A successful new intentional log receives a new UUID.

This uses the existing consumption rows, with no separate request table. Physically deleting a consumption group also removes its deduplication record: an old pending logging request replayed afterward can log again. There is no server-side deletion ledger, as requested. If the recipe is deleted before an uncertain request is resolved, the RPC can still replay a saved group, but navigating to the deleted recipe to retry is not currently supported.

## Verification

Client tests: `node --test tests/logConsumption.test.cjs`.

SQL tests: install the optional `@electric-sql/pglite` module outside the project, set `FOODWORTH_PGLITE_PATH` to its module directory, then run `node --test tests/foodConsumption.sql.test.cjs tests/logConsumption.sql.test.cjs`.

The SQL tests run the actual migrations in isolated PostgreSQL with schema fixtures. They cover single barcode/generic foods, checked/unchecked meals, partial/exact depletion, snapshots after meal deletion, retries, ownership, invalid inputs and transaction rollback. Live Supabase and device behaviour still require checking after installation.
