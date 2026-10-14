# Data model and price rules

## Entities

| Concept | Table | Notes |
| --- | --- | --- |
| Wilaya / commune | `wilayas`, `local_areas` | 58 wilayas as reference data. Only the pilot (Djelfa) has a map centre. Being listed does not mean having data. |
| Canonical product | `products` | Slug id, category, dimension (`mass` / `volume` / `count`), names in EN/FR/AR, synonyms, **plausibility bounds**. Different varieties or package types are separate products (e.g. pasteurised bagged milk vs UHT milk). |
| Physical location | `shops` | Coordinates of the shop itself, bounded to Algeria, with **provenance** (`verified_visit`, `official_source`, `openstreetmap`, `demo`). |
| Observation | `price_reports` | Product + shop + price + quantity + unit + date seen + submission time + contributor + status + source. Never overwritten: history is kept. |
| Recipes | `ingredients`, `recipes`, `recipe_ingredients` | Exact quantities and units; every non-staple ingredient maps to a product for pricing. |
| Private data | `profiles`, `meal_plans`, `meal_plan_items`, `saved_lists`, `saved_list_items` | Owner-only (RLS). The current UI keeps plans on the device. |
| Governance | `user_roles`, `report_flags`, `moderation_events` | Roles assigned by SQL only; flags and moderation are audited. |

`shops.business_verified_at` and `report_source = 'business'` are reserved for future
verified-business profiles. They are unused, and paid placement must never change organic ranking.

## Units and normalization

Submitted units: `g`, `kg`, `ml`, `l`, `piece`. Comparison units: **DZD/kg**, **DZD/L**, **DZD/item**.

```
normalized = round(price / quantity_in_comparison_unit, 2)      (half-up)
180 DZD for 2 kg      -> 90.00 DZD/kg
90 DZD for 500 g      -> 180.00 DZD/kg
660 DZD for 30 eggs   -> 22.00 DZD/item
```

- Money is `numeric(12,2)` in PostgreSQL and `big.js` in TypeScript (no binary floats). A test checks that the SQL and TypeScript implementations agree.
- A unit must match the product's dimension: a per-item product is never compared with a per-weight unit.
- Observations are only compared within the **same product** and comparison unit.

## Freshness (per category, configurable in `categories`)

| Category | Recent up to | Stale after |
| --- | --- | --- |
| Vegetables | 7 days | 21 days |
| Meat & poultry | 10 days | 30 days |
| Fish | 5 days | 14 days |
| Dairy & eggs | 14 days | 45 days |
| Grains, pasta & legumes | 30 days | 90 days |
| Bread | 14 days | 45 days |
| Oil & pantry | 30 days | 90 days |

States shown in the UI:

- **recent**
- **older**: still current, but flagged
- **stale**: kept in history and shown under "Older observations"; never shown as a current price and never "lowest"

The category artwork uses Font Awesome Free Solid SVG icon definitions from
`@fortawesome/free-solid-svg-icons` (CC BY 4.0; Fonticons, Inc.;
https://fontawesome.com/license/free).

Change thresholds in `src/data/reference/catalog.ts`, then run `npm run seed:generate` and re-run the categories part of `seed.sql`.

## Report states

| State | Meaning |
| --- | --- |
| `pending` | Submitted. Visible only to its author and moderators. |
| `approved` | Public. |
| `rejected` | Hidden. The reason is shown to the author. |
| stale | Computed from the date (see above). |
| corroborated | Computed: other *distinct* contributors' approved reports for the same product and shop within 3 days and 5 % of the price. |
| business-provided | Reserved, unused. |
| demo | `source = 'demo'` or shop provenance `demo`: always badged, never counted as community data. |

## Comparison wording

- "Lowest reported" appears only when ≥ 2 shops have current observations, and only on current ones.
- Every comparison states its basis ("Based on recent reports from N shops. Coverage is limited.").
- The UI never says "cheapest in Djelfa". The lowest reported price is distinguished from the cheapest practical trip.

## Demo data

`src/data/demo/fixtures.ts` generates 8 synthetic shops named "Demo …" near the Djelfa centre,
with deterministic synthetic prices. They are used for the in-browser demo mode and, if
you choose, `supabase/demo_seed.sql`. They are not real locations or prices.
