# Demo script (about 4 minutes)

Works in demo mode (`npm run dev`) or on the deployed site. Say clearly that the purple-badged
data is synthetic.

1. **Map first.** Open the app: Djelfa map, search bar, no sign-up wall. Point at the demo banner.
2. **Search.** Type `potatos` (typo on purpose) → *Potatoes*. Price pins appear and the list shows
   unit price, the reported package ("95 DZD · 1 kg"), the date seen and a freshness badge.
   Point at the coverage notice ("Coverage is limited"), and at "Lowest reported" as opposed to "cheapest".
3. **Comparability.** Search `milk`: pasteurised bag milk and UHT milk are separate products, never mixed.
4. **Shop.** Tap a pin → the shop panel shows this product's history at that shop and other recent prices.
   "Prices are observations, not official shop prices."
5. **Stale data.** Open *Price history* for a product: older observations are kept and labelled.
   Demo grocery D only has older reports (some already stale).
6. **Meal plan.** Meal plan → 4 people, 9,000 DZD, add 1 kg lentils to the pantry, tick *No red meat* →
   Generate. Show the 7 days, the estimate against the budget, and the recipe steps.
   Try 3,000 DZD: the planner swaps in cheaper dishes and tells you honestly if it still can't fit.
7. **Checklist.** Open the checklist: aggregated quantities, pantry subtracted, price basis and dates,
   unknown prices marked "Price unknown" (never 0). Tick items. No cart, no checkout.
8. **Contribute.** Report a price → sign-in required. With a live backend: submit → **Pending review**,
   absent from the map until approved at `/moderate`.
9. **Arabic / French.** Account menu → العربية: full RTL layout.
