# Meals implementation notes

The user reports executing the relational meals setup in Supabase on 12 September 2026.
This is a schema contract from their supplied SQL, not a live database verification.

- `meals`: generated bigint `id`, `user_id`, `meal_name` (1–100 trimmed characters), optional `description` (500), optional `instructions` (5000), timestamps.
- Meal names are unique per user ignoring case and outer spaces. Maximum 10 meals per user.
- `meal_items`: generated bigint `id`, `meal_id`, exactly one of `product_barcode` or `generic_product_id`, `amount` numeric(12,3), timestamps.
- Amount is >0 and <=100000, in the linked product's g/ml unit. Maximum 50 distinct ingredients per meal.
- Partial unique indexes prevent duplicate products per meal. Adding an existing ingredient increases its amount; editing replaces its amount.
- Meal ownership is enforced through RLS; ingredients inherit it through their parent meal. Deleting a meal cascades to its ingredients. Product deletion is restricted while referenced by a meal.
- Recipe quantities are separate from `pantry.amount_remaining`; creating/editing meals never changes pantry stock.
- The current triggers update each edited row's `updated_at`. Ingredient edits do not update the parent meal timestamp, so the list is ordered by creation time.

React Native flow: Meals list → create metadata → details → search/scan → review ingredient amount → add to meal. Metadata and each ingredient save individually; errors keep the editor open for retry. Generic products remain read-only. Barcode corrections use the same shared catalogue submission as pantry entry, without adding pantry stock.

The user confirmed installing the pantry-only RPC. Consume meal now opens a date selector and an optional pantry checkbox (checked by default), then logs all ingredients through the new food-consumption RPC. That new RPC still needs installing in Supabase. Home screen integration remains deferred. See [food-consumption.md](food-consumption.md) for setup and validation; [meal-consumption.md](meal-consumption.md) documents the earlier pantry-only operation.
