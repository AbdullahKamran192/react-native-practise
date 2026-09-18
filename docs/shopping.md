# Shopping and spending

Value grades use A ≥90%, B ≥70%, C ≥50%, D ≥30%, E below 30%. Run `supabase/migrations/20260918_value_grade_thresholds.sql` after shopping setup to update checkout and regrade historical overall letters from their saved percentages. Prices, amounts and nutrition snapshots are unchanged. Exactly 100% shows **Meets target**; above 100% shows **Exceeds target**. Overall coverage still averages calories and protein with each capped at 100%.

Whole-trip deletion now offers **Also remove these purchased amounts from my pantry**, unchecked each time the confirmation opens. Run `supabase/migrations/20260918_delete_shopping_trip_pantry.sql` to install the atomic deletion RPC. It combines repeated product lines, subtracts at most the available stock, deletes exhausted pantry rows, then deletes the trip and its items. Missing products or changed measurement units are skipped and reported. The UI refreshes pantry, meal availability and spending totals. Stock is pooled, so deduction can include later purchases. Individual-item deletion remains history-only. No extra columns or cleanup jobs are used.

Shopping details display current public catalogue images where accessible, with placeholders otherwise. Saved names, prices and value scores stay unchanged. Calorie, protein and overall grades use aligned A–E colour badges. **Edit** on a trip reveals individual item bins. Run `supabase/migrations/20260918_delete_shopping_item.sql` to enable item deletion: one owner-checked transaction removes the selected item and recalculates the trip total, or removes the trip when empty. Pantry stock is unaffected. Spending totals refresh after deletion. No new columns are added.

Run `supabase/migrations/20260918_shopping.sql` once in Supabase SQL Editor, then reload the app. No Edge Function, secret or additional dependency is needed.

The pantry has a spending chart, **Start shopping**, and **Purchase history**. The top-right **+** still adds stock directly without recording a purchase.

Shopping supports scanning and search, amount/quantity editing, total price per line, and calorie/protein/overall value grades. A trip can contain up to 100 lines. A zero price is allowed; its value grade is unknown. The cart is saved in AsyncStorage separately for each account, so reopening the app keeps it. It is local to that device, not synced across devices.

**Complete shopping** calls one authenticated database function. It saves `shopping_trips` and `shopping_trip_items` and adds all amounts to `pantry.amount_remaining` in the same transaction. A failure rolls everything back. An uncertain network response keeps the cart locked for a safe retry with the same trip ID. No consumption log is created. Completing two separate carts on separate devices records two purchases.

History has 20 trips per page. Purchase details cannot be edited, but **Edit** reveals bin icons to permanently delete whole trips after confirmation. The whole-trip deletion RPC above checks ownership. The existing cascade removes the trip's items, and the spending graph refreshes; pantry stock is unchanged unless the checkbox is selected. No deletion-tracking columns are added. The graph's tracking start is recalculated from the earliest remaining trip. A locally pending checkout must be confirmed before that trip can be deleted. Once a trip is deleted its retry identifier is also gone, so an old checkout request replayed from another device can recreate it.

Names, brands when supplied, purchased amounts, prices and value scores are snapshots. Server-side scores use the current product/personal correction values and current user settings at checkout, so a changed catalogue or target can differ from an older cart preview. History never depends on remaining pantry stock. Deleting an account cascades to its shopping history and items; shared product photos are unaffected.

The chart displays this year's cumulative purchases through today. Its dashed budget line accumulates over the same days, starting on the first purchase date or January 1 when tracking began in a prior year. It uses the current daily food budget. Unrecorded purchases and quick additions are excluded. Purchase timestamps are stored in UTC and displayed/grouped by the device's local time.

Verify on device: scan and search into the cart, buy multiple packages, edit the price, close/reopen, complete, inspect pantry increments and history, then check the chart. For network errors use **Retry checkout**; do not create a second cart to retry the same purchase.
