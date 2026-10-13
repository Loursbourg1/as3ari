# As3ari (أسعari)

Community Grocery Price Intelligence and Nutrition Optimization Platform for Algeria.

## Problem Statement

Algerian households, particularly large working families with fixed incomes, face sharp market volatility and price fragmentation across retail shops and open-air markets. 

1. **Information Asymmetry**: Identical staples (vegetables, poultry, oil, legumes) often vary by 20% to 50% between markets located just a few kilometers apart.
2. **Budget Exhaustion**: Families often discover the true cost of their weekly grocery basket at the cash register, leaving them vulnerable to running out of money before the end of the month.
3. **Nutritional Compromise**: Sticking to a strict budget usually forces households into cheap, low-nutrient carbohydrates, sacrificing protein and essential micronutrients.

## The Solution

As3ari eliminates guesswork by turning collective community observations into verifiable price intelligence and actionable meal plans:

- **Crowdsourced Price Verification**: Shoppers report in-store shelf prices on the ground. A corroboration engine cross-checks submissions across multiple independent users within a geographic radius before public confirmation.
- **Budget-First Meal Optimization**: Rather than giving generic recipes, our engine builds complete 7-day meal plans calibrated to local real-time prices. Families input their exact budget and household size to receive balanced, culturally authentic menus that never exceed their spending limits.
- **Automated Shopping Logistics**: Planned meals translate directly into unified shopping lists with estimated cost totals, eliminating impulse spending and food waste.

## Business Model and Monetization Potential

As community engagement scales, the platform unlocks two distinct revenue channels without compromising core utility for low-income families:

1. **Targeted Merchant Placement & Verified Promoted Listings**: Local supermarket chains, butcheries, and neighborhood grocers can sponsor verified price drops, run promotional campaigns, or highlight location inventory directly to consumers actively planning grocery shopping within their wilaya.
2. **Premium Household & Enterprise Subscriptions**: A freemium model offering power users advanced tooling:
   - Detailed multi-store basket optimization (showing which combination of stores produces the cheapest overall basket).
   - Custom dietary restrictions (diabetic, cardiovascular, athlete macros) integrated into algorithmic budget constraints.
   - Bulk purchasing recommendations for cooperative consumer buying groups and micro-caterers.

## Technical Architecture

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, PWA support, full Arabic RTL layout.
- **Database & Identity**: Supabase (PostgreSQL with Row Level Security, pg_cron, PostgREST RPC functions).
- **Security & Authorization**: Strict database-level role enforcement (`admin`, `moderator`, `authenticated`), advisory transaction locks against duplicate spam, and strict origin verification.
- **AI Planning Engine**: Algorithmic budget constraint solver combined with Google Gemini API through an authenticated serverless proxy.

## Governance & Moderation

Price data integrity is governed by dedicated platform moderators. Pending reports require manual review or consensus verification through the moderation dashboard at `/moderate` before entering the public observations index.

## Verification & Build

```bash
npm install
npm run typecheck
npm test
npm run build
```

Confidential and proprietary project. All rights reserved.
