# As3ari (أسعاري) — Map-First Grocery Price Intelligence & Smart Meal Planning for Algeria

[![Tests](https://img.shields.io/badge/tests-119%20passed-brightgreen.svg)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)]()
[![React](https://img.shields.io/badge/React-19-61dafb.svg)]()
[![TailwindCSS](https://img.shields.io/badge/Tailwind-v4-38bdf8.svg)]()
[![Gemini](https://img.shields.io/badge/AI-Google%20Gemini-8e75ff.svg)]()

**As3ari** is a community-driven grocery price intelligence platform for Algeria. It helps Algerian families navigate food inflation by crowdsourcing real, dated grocery prices from local shops and markets, and offers an AI-powered meal planner that generates affordable weekly menus based on real market costs.

> **Note:** As3ari is an informational transparency tool, not an e-commerce store. There is no cart, payment, or delivery. Shopping lists are offline checklists for physical shopping.

---

## ✨ Key Features

### 1. 🗺️ Map-First Price Explorer & Recent Feed
- **Interactive Geospatial Map (Leaflet)**: Find the lowest reported prices at physical grocers, supermarkets, and local markets across Algeria's 58 wilayas.
- **Swipeable Recent Prices Feed**: Fast, mobile-first feed displaying newly contributed prices with community accuracy voting and shop metadata.
- **Unit Normalization**: Automatically normalizes and compares items in standard units (`DZD/kg`, `DZD/L`, `DZD/item`) with exact decimal math.

### 2. 🤖 Smart Gemini AI Meal Planner
- **AI-Driven Menu Optimization**: Integrates Google Gemini (`gemini-1.5-flash` / `gemini-2.0-flash`) to generate culturally tailored 7-day Algerian meal plans.
- **Real Price Estimation**: Costed against real As3ari price observations with full transparency on missing or stale prices.
- **Daily Nutrition Estimates (Per Person)**: Deterministically calculates daily calories, protein, carbohydrates, fat, and fiber based on 16 traditional Algerian recipe benchmarks.
- **Interactive Dish Swapping**: Swap any lunch or dinner slot with automatic live recalculation of costs, remaining budget, and nutritional balance.
- **Deterministic Resilience**: If the Gemini API key is missing or quota is exhausted, seamlessly falls back to a deterministic budget optimizer.

### 3. 📈 Price Trends & Volatility Tracker
- **Trend Visualizations**: Interactive SVG charts tracking price fluctuations (daily and weekly) per product and wilaya.
- **Category Navigation**: Filter by category (Produce, Dairy, Bakery, Meat, Pantry, Drinks, Hygiene) to monitor market trends.

### 4. 🛒 Community Price Reports & Custom Products
- **Contribution Engine**: Registered users can submit observed prices directly from markets, with optional GPS tagging.
- **Custom Product Submission**: Community members can add completely new local groceries to the catalog if not already listed.
- **Anti-Spam & Moderation**: Protected by Google reCAPTCHA v3, rate limiting, and an admin moderation workflow.

### 5. 🌍 Trilingual & Native RTL Support
- Full internationalization across **English**, **French (Français)**, and **Arabic (العربية)** with layout direction switching (LTR / RTL).

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript (strict), Vite 8, Tailwind CSS v4, Lucide React
- **Geodata**: Leaflet, OpenStreetMap
- **Backend & Database**: Supabase (PostgreSQL, Row Level Security, RPC functions, Edge Functions)
- **AI & LLM**: Google Gemini API (`gemini-1.5-flash`)
- **Testing**: Vitest, JSDOM, PGlite (in-memory Postgres for migration and RLS testing)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- npm 10+

### Installation

```bash
git clone https://github.com/Loursbourg1/as3ari.git
cd as3ari
npm install
```

### Running Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. Without Supabase credentials, As3ari automatically starts in **Demo Mode** with synthetic Algerian grocery data.

---

## ⚙️ Environment Variables

Create a `.env.local` file or configure these variables in your deployment settings (e.g. Vercel):

| Variable | Description | Default / Required |
| --- | --- | --- |
| `Gemini` or `VITE_GEMINI_API_KEY` | Google Gemini API key for AI meal planning | Optional (UI allows browser key input) |
| `VITE_SUPABASE_URL` | Supabase project URL | Optional (runs demo mode without it) |
| `VITE_SUPABASE_ANON_KEY` | Supabase public anonymous key | Optional (runs demo mode without it) |
| `RECAPTCHA_SITE_KEY` | Google reCAPTCHA v3 site key | Uses Google official test key if unset |
| `DEMO_DATA` | Set `'false'` to hide synthetic demo items in production | `'true'` |
| `REQUIRE_EMAIL_VERIFICATION` | Require email confirmation before accepting price submissions | `'false'` |

---

## 🧪 Testing & Verification

```bash
# Run all unit tests and database migration / security tests (119+ tests)
npm run test:all

# Run TypeScript typecheck
npm run typecheck

# Production build
npm run build
```

---

## 📂 Project Structure

```
src/
  auth/          Supabase authentication & route protection
  components/    Reusable UI components (buttons, search, cards, trends)
  config/        Build-time & runtime environment configuration
  data/          Data access layer (Supabase & offline Demo repositories)
  domain/        Core business logic (units, money math, nutrition benchmarks)
  i18n/          English, French, and Arabic translation dictionaries
  pages/         Page routes (Feed, Explore, Map, Plan, Trends, Contribute)
  planner/       Gemini AI meal planner & deterministic shopping optimizer
supabase/
  migrations/    PostgreSQL schema, RLS policies, and RPC procedures
  functions/     Supabase Edge Functions (submit-report)
tests/
  db/            PGlite database security and migration tests
  unit/          Unit tests for domain math, search, and schemas
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
