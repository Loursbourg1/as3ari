# Meal planner

Code: `src/planner/`. It is deterministic: the same inputs and prices always produce the same plan.
No AI model estimates prices, quantities or totals.

## Inputs

Household size (1–20), weekly budget (DZD, optional), pantry items (ingredient + quantity + unit),
dietary exclusions (red meat, poultry, fish, eggs, dairy, gluten, legumes), preferred ingredients,
and the selected area (prices come from that wilaya).

## Prices

For each ingredient's pricing product, take the **latest observation per shop** in the area
(`src/planner/prices.ts`):

- if any are current (not stale), use the **median** of the current ones → basis `recent`;
- otherwise use the median of the stale ones → basis `stale` (shown as uncertain);
- otherwise the price is **unknown** → the cost is `null`, never 0;
- staples (salt and spices) are assumed to be at home and not costed.

## Algorithm

14 slots: lunch and dinner for 7 days. Recipes serve 4 and are scaled by `household / 4`.

1. Filter recipes by exclusions (hard rule).
2. Greedy pass. For each slot, pick the recipe with the lowest score:
   `marginal cost of what still has to be bought`
   `+ 15 per new ingredient` (fewer distinct items to buy)
   `− 20 per pantry ingredient used` `− 30 per preferred ingredient`
   `+ 120 × times already used` `+ 150 per ingredient with unknown price` (scoring only).
   Constraints: at most twice per week, never the same dish twice in a row.
3. Variety pass: while the total stays within budget, swap repeated dishes for unused ones.
4. Budget pass: while over budget, apply the single swap that saves the most money (a dish may then appear 3 times).
5. If the plan is still over budget, say so and suggest how much to add, the biggest cost
   items (to check the pantry), and relaxing exclusions.

## Outputs

Shopping quantities are aggregated across recipes, pantry stock is subtracted, and amounts are
rounded **up** to whole grams/ml/items. Costs are computed with `big.js`. The summary
separates `recentCost` and `staleCost` and lists ingredients with missing prices. The total is
shown as "≥ X" when prices are missing.

The checklist (`/lists`) is stored on the device. You can tick items as acquired and edit
quantities; costs are recomputed from the same unit prices.

Plans are not medical or nutritional advice.
