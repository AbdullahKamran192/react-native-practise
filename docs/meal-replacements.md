# Meal ingredient replacements

Run `supabase/migrations/20260917_product_generic_link.sql` once in Supabase SQL
Editor. It adds a nullable indexed foreign key from `products.generic_product_id`
to `generic_products.id`. Deleting a generic catalogue entry clears the link;
it does not delete barcode products. Existing assignments start empty.

Assign links yourself in Supabase. No automated classification or user
classification screen is included.

The meal details screen offers Replace only for barcode ingredients below 80%
exact-product availability. The separate replacement page lists other barcode
products in the user's pantry with positive stock and the same g/ml unit:

- Equivalent replacements share the original product's non-null generic link.
- Similar pantry items share a meaningful name word. These are suggestions to
  adapt the recipe, not guaranteed equivalents or dietary/allergen substitutes.

Already-used recipe products are excluded. Partial stock is allowed and labelled.
Use instead updates the existing ingredient's product reference, keeping the
amount. It refreshes meal data; stock and consumption history are not modified.
The save rechecks stock, candidate suitability and the original ingredient;
an ingredient changed in another screen is not silently overwritten.

Until assignments are populated, only name-based suggestions appear.
