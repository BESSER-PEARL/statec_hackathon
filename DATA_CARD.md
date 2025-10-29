# Data Card – Ageing Insights Dashboard

## Summary
This project curates open demographic and socio-economic indicators to analyse ageing in Luxembourg. Indicators include age pyramids, dependency ratios, labour market participation, social protection expenditure, long-term care utilisation, health status, and housing affordability. Data are aggregated by commune/canton, gender, and age cohort.

## Data Sources
- **STATEC LUSTAT Census & Demography API** – SDMX feeds for population counts, age structure, life expectancy, and migration.
- **STATEC LUSTAT Labour & Social Protection API** – Employment, pension, and care-service indicators.
- **Eurostat Regional Database (NUTS2/NUTS3)** – Benchmarking Luxembourg against neighbouring regions.
- **Luxembourg Open Data Portal** – Auxiliary geospatial boundaries, health facilities, and housing statistics.
- **INSPIRE Administrative Units** – Harmonised geographic layers for cross-border visualisation.

## Collection & Transformation
1. Download raw SDMX datasets via authenticated API calls with explicit dataset IDs and filters.
2. Harmonise identifiers using ISO country codes, STATEC commune codes, and NUTS classifications.
3. Aggregate to yearly cohorts (5-year age bands) and compute derived metrics (old-age dependency ratio, median age, pension coverage).
4. Join socio-economic indicators with geospatial features (GeoJSON/TopoJSON) for mapping.
5. Validate schemas against control totals from official publications, logging provenance metadata (source, timestamp, parameters).

## Refresh Schedule
- Automated nightly pipeline for baseline indicators with manual approval for structural changes.
- Ad-hoc refresh when new census releases or policy indicators become available.

## Known Limitations & Biases
- Census undercounts and delayed updates can obscure recent migration dynamics.
- Eurostat comparisons rely on harmonised definitions that may not perfectly align with national methodologies.
- Aggregated indicators may mask intra-commune inequalities and vulnerable micro-populations.
- Housing and care-service datasets are occasionally missing historical data prior to 2010.

## Licences & Access
- All ingested datasets are open, licensed under CC BY 4.0 (or equivalent). Licence notices are preserved in the repository.
- No personal data are processed; only aggregated, anonymised statistics are stored.
- API rate limits and fair-use policies must be respected when refreshing data.
