# Ageing Luxembourg Dashboard

Interactive React dashboard prepared for the STATEC Hackathon 2025 (“Ageing Luxembourg”).
It pulls fresh figures straight from STATEC’s LUSTAT SDMX API—no intermediate CSV or JSON dumps required.

## How it works

- The app requests three official dataflows:
  - `DSD_CENSUS_GROUP1_3@DF_B1600` · legal marital status by sex & age (population structure)
  - `DF_B3109` · employment rate of persons aged 15–64 (labour market pressure)
  - `DF_C2206` · benefits from the long-term care insurance (social protection demand)
- `src/lib/sdmx.js` converts SDMX series/observations into flat records.
- `src/App.jsx` aggregates the records into KPIs, stacked bars, line & area charts, and policy highlights.

## Prerequisites

- Node.js = 18
- (Optional) Python = 3.10 if you want to reuse the SDMX helper scripts for offline experiments.

## Running the dashboard locally

```bash
cd dashboard
npm install
npm run dev
# Visit http://localhost:5173
```

### Avoiding CORS issues

The dev server ships with a proxy at `/lustat` that forwards to `https://lustat.statec.lu`. You have two options:

1. **Use the proxy (default in dev):**
   - Create a `.env.local` file inside `dashboard/` with `VITE_LUSTAT_BASE=/lustat`.
   - `npm run dev` will call `/lustat/rest/data/...`, which Vite proxies to LUSTAT.

2. **Call the API directly:**
   - Set `VITE_LUSTAT_BASE=https://lustat.statec.lu` in `.env.local`.
   - Ensure the browser environment is allowed to reach the LUSTAT domain (CORS must be enabled on the target deployment).

Build for production with:

```bash
npm run build
# Outputs to dashboard/dist
```

## Adding more datasets

1. Look up the SDMX dataflow and key in the hackathon appendix or the LUSTAT API explorer.
2. Duplicate one of the loaders in `src/App.jsx` (e.g., `loadEmploymentRows`) with the new flow/key.
3. Transform the rows and connect them to fresh Recharts visualisations.

## Optional: Offline data snapshots

The Python utilities in `scripts/` still work if you prefer local CSV/JSON extracts (`sdmx_fetch_data.py`, `prepare_dashboard_data.py`), but the dashboard no longer depends on them.
