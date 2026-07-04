# Dharohar Capital Partners — Investor Portal

Separate app from the main dharoharcapital.in site. Will be deployed at `portal.dharoharcapital.in`.

Stack: Next.js 14 (App Router) + Tailwind, Supabase (Postgres + Auth + RLS), Google Sheets API sync, Resend (email), Vercel (hosting + cron).

## Status

Phase 0 (accounts + scaffolding) in progress. See the full build plan for phase details.

GitHub remote (not yet pushed): https://github.com/Kushal641/dharohar-investor-portal.git
Supabase project ref: rfwusbottzgddrnxioyl

## Local setup

```bash
npm install
cp .env.local.example .env.local   # fill in values once Supabase/Google/Resend accounts exist
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view it.

## Env vars

See `.env.local.example` for the full list and where each value comes from.
