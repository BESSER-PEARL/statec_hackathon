# Data Card – Ageing Insights Dashboard

## Summary
This project curates open demographic and socio-economic indicators to analyse ageing in Luxembourg. Indicators include age pyramids, dependency ratios, labour market participation, social protection expenditure, long-term care utilisation, health status, and housing affordability. Data are aggregated by commune/canton, gender, and age cohort.

## Data Sources
- **STATEC LUSTAT Census & Demography API** – SDMX feeds for population counts, age structure, life expectancy, and migration.
- **Shapefiles** - Geographic boundaries from STATEC resources

## Collection & Transformation
1. Download raw SDMX datasets in JSON format via authenticated API calls with explicit dataset IDs and filters.
2. Map to our defined database schema and store it in our own database.
3. Display result on dashboard and perform necessary joins and other operations if requested in the dashboard.

## Refresh Schedule
- Manually triggered pulls by running the backend script. 

## Known Limitations & Biases
- Only used the flat data from 2021, thus not the data timeseries option. 

## Licences & Access
- All ingested datasets are open, licensed under CC BY 4.0 (or equivalent). Licence notices are preserved in the repository.
- No personal data are processed; only aggregated, anonymised statistics are stored.
- API rate limits and fair-use policies must be respected when refreshing data.
