# Importing verified shops and genuine prices

The script converts a reviewed CSV into SQL. **It never sends anything anywhere and needs no keys.**
You read the generated SQL, then run it yourself in the Supabase SQL Editor.

Templates: `data/import/shops.template.csv`, `data/import/prices.template.csv`.

## 1. Shops (`npm run import:shops -- <file.csv>`)

| Column | Rule |
| --- | --- |
| `name` | 2–120 characters, as written on the shop |
| `kind` | `shop`, `market`, `supermarket`, `butcher`, `bakery`, `greengrocer`, `grocery` |
| `wilaya_code` | 1–58 |
| `area_id` | a commune id from `src/data/reference/geography.ts` (e.g. `djelfa`) or empty |
| `address_text` | optional, ≤ 200 characters |
| `lat`, `lng` | the **shop's** coordinates (decimal degrees), within Algeria |
| `provenance` | `verified_visit`, `official_source` or `openstreetmap` (`demo` is refused) |
| `provenance_note` | how it was verified, e.g. "Visited 2026-10-12, coordinates from phone at entrance" |

Rules for genuine locations:

- Take the coordinates at the shop, not at your home, and never use a contributor's location.
- From OpenStreetMap: copy the node's coordinates, put the OSM id in `provenance_note`, and keep ODbL attribution.
- If you are not sure a shop still exists, leave it out.

```bash
npm run import:shops -- data/import/shops.csv > supabase/imports/shops-2026-10-12.sql
```

New communes: add them to `LOCAL_AREAS` in `src/data/reference/geography.ts`, run
`npm run seed:generate`, and run the `local_areas` insert from `supabase/seed.sql`.

## 2. Price observations (`npm run import:prices -- <file.csv>`)

Use this for prices **you or your team observed** (for example a field survey). Imported rows
are stored as `approved` with `source = 'import'` and no contributor account.

| Column | Rule |
| --- | --- |
| `product_id` | a product id from `src/data/reference/catalog.ts` (e.g. `potatoes`) |
| `shop_name` + `wilaya_code` | must match an imported (non-demo) shop exactly |
| `price` | DZD, max 2 decimals |
| `quantity` + `unit` | package size, e.g. `2` + `kg`, `30` + `piece`; unit must fit the product |
| `observed_on` | `YYYY-MM-DD`, the day the price was seen |
| `provenance_note` | who observed it and how, e.g. "Founder survey, shelf label" |

The script rejects unknown products, units of the wrong kind and prices outside the
product's plausibility bounds. The SQL recomputes the unit price with the trusted
`normalize_price()` function.

```bash
npm run import:prices -- data/import/prices.csv > supabase/imports/prices-2026-10-12.sql
```

Each row inserts nothing if the shop name doesn't match, so check the row counts the SQL
Editor reports.

## 3. Afterwards

- Set `VITE_SHOW_DEMO_DATA=false` in Vercel once enough genuine data exists, and delete the demo rows (see DEPLOYMENT.md).
- Never edit or delete historical observations to "fix" a price. Reject it through moderation and add a new observation instead.
