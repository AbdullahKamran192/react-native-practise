# Explore Meals

For an existing installation, run **`supabase/migrations/20260919_public_meal_types.sql`** in FoodWorth's Supabase SQL Editor. Do not rerun the original migration. For a fresh installation, run `20260919_public_meals.sql` first, then the new migration, after the consumption migrations. No Edge Function deployment is needed.

## Add public recipes

Run `supabase/migrations/20260921_public_ingredient_names.sql` after the public meal migrations to add the optional ingredient `name` column. Enter wording such as `Frozen mangoes`, or leave it NULL to display the linked generic food name. Keep `generic_product_id` pointing to the broad food (for example Mango). This label only changes public recipe display; pantry matching, nutrition, logging and saved personal ingredient references still use the linked products.

Use the Supabase Table Editor initially. Only administrators can change the public catalogue; signed-in users can read it.

1. Add a row to `public_meals`: `meal_name`, optional `description` and `instructions`, `meal_type` (one category from the list below), and optional `image_path`.
2. Add its ingredient rows to `public_meal_ingredients`: `public_meal_id`, the existing `generic_product_id`, optional `name`, `amount`, matching `measurement_unit` (`g` or `ml`), `is_optional`, and `sort_order`.
3. Upload the recipe photo to the **public** R2 bucket, for example `public-meals/1/image.webp`, and put that key in `image_path`. Do not enter a signed URL or a private meal-image key.

Use these exact `meal_type` values (also listed in `src/utils/mealTypes.ts`):

- Quick meals
- 30-minute meals
- High-protein meals
- Budget meals
- Slow-cooker meals
- Breakfast
- Lunch
- Dinner
- Snacks
- Desserts
- Other

Existing recipes start in `Other`. Assign categories yourself in Supabase; the database rejects inconsistent category spelling. Explore Meals shows each populated category as a horizontal row of large image cards, with names and descriptions underneath. Each row fetches 20 recipes at a time as you scroll, without loading the entire catalogue.

The migration removes the old servings signatures and column, preserves ingredients and history, and replaces the logging/copy functions with versions using exact stored amounts. Previously committed logs can still be retried by group ID without another deduction. An uncommitted old request with scaled amounts will be rejected safely; reopen the recipe to log its stored amounts.

The app does not insert sample recipes or guess your generic IDs. Recipes appear under **Meals → Explore Meals** once you add them. Keep recipes within the existing 50-selection limit (splitting across pantry products also uses selections).

## User flow

- Each recipe is one complete meal quantity. Ingredient amounts are used exactly as stored, without serving controls or scaling.
- **Check my pantry** matches generic IDs and units, using older pantry rows first and splitting across products if necessary. A pantry row represents aggregated stock, not individual purchase batches.
- Missing amounts stay generic. **Replace** opens exact generic-ingredient matches, then same-food-group alternatives, then similar-name pantry suggestions, plus **Search food** and **Scan food**. Similar names are suggestions for manual choice, never automatically treated as equivalent. A replacement uses the full ingredient amount; it does not add pantry stock. There is no Refresh suggestions button.
- Optional ingredients can be skipped. The overall availability excludes optional ingredients, and stock is never counted twice.
- **Cook and log** logs the selected products without creating a personal meal. Date, meal period and optional pantry deduction use the existing logging controls. Selected amounts are logged in full; only available amounts are deducted. The server rechecks units, recipe amounts and current stock. The whole operation is atomic and retries reuse the saved event ID.
- **Save to My Meals** copies the selected branded products and any remaining generic amounts into the user's existing meal tables. It leaves the public recipe and pantry unchanged. The current 10-meal limit applies. The saved recipe can use the existing personal ingredient replacement feature.

Selections are a temporary screen draft. Leaving the app can discard unsaved selections; a submitted log awaiting retry is retained by the existing logging mechanism.

`meals.public_image_path` keeps the shared recipe photo separate from private uploads. Saved meals display it directly; removing it only clears that personal reference. Replacing it uploads a private photo through the existing system. Deleting a copied meal never deletes the shared image. Direct public-meal logs use the recipe name and ingredient snapshots; their history image uses the existing fallback placeholder because no personal meal was created.

## Checks

`node tests/publicMealMatching.test.cjs` checks unchanged recipe amounts, split stock, generic fallback, units, and avoiding double-counting.

`node tests/publicMeals.sql.test.cjs` uses PGlite (`FOODWORTH_PGLITE_PATH` may point to its installation) to check permissions, copying, direct logging, no personal-meal creation during consumption, optional pantry deduction, retries and rollback.


## Family-aware pantry matching and replacements

Generic products expose their nullable `food_family_id` and read-only `food_families` relationship alongside the existing food group. Branded products reach these through `products.generic_product_id`; generic pantry items use their own generic row. Existing nested queries fetch this information together, without requests per item. This assumes the family schema described in the September 22 database update is already installed; no new migration is needed.

**Check my pantry** uses exact generic matches first, then the same active, non-null family. Within each tier it keeps oldest-stock ordering. Existing splitting covers shortages using compatible stock and keeps any missing portion generic. Matching still requires matching units and available amounts. Missing/inactive family relationships and inconsistent direct/family group assignments cannot establish family compatibility. Two missing family IDs never match.

Both replacement pages show exact matches, compatible family replacements, supplemental name suggestions, then broader group alternatives. Name-only and group-only matches always require manual selection. Suggestions exclude empty stock, incompatible units, inactive generic foods and duplicate products; personal meals also exclude products already in the recipe. Selecting a replacement preserves the amount and does not change stock until consumption. Nutrition uses the selected product as before.

The direct `generic_products.food_group_id` column remains in use. No taxonomy records, nutrition values, consumption RPCs or deletion behaviour are changed. The local schema dump predates families; the supplied delta documents describe the new relationship. Live classification counts and the group-integrity SQL must be checked in Supabase; unit tests do not verify live data.
