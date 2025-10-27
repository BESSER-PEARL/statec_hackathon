# Ageing Luxembourg Dashboard

Interactive dashboard prepared for the STATEC Hackathon 2025 (“Ageing Luxembourg” theme). It distils openly available census data into key indicators on population ageing, labour-force pressure, and narrative takeaways for policymakers.

## Prerequisites

- Node.js ≥ 18
- Python ≥ 3.10 (to refresh the datasets)

## 1. Refresh the data extract

```bash
# 1a. Pull the SDMX extract for age-by-sex population counts
python scripts/sdmx_fetch_data.py \
  --flow DSD_CENSUS_GROUP1_3@DF_B1600 \
  --structure census_structure.json \
  --dim SEX=_T,M,F \
  --dim AGE=Y_LT15,Y15T19,Y20T24,Y25T29,Y30T34,Y35T39,Y40T44,Y45T49,Y50T54,Y55T59,Y60T64,Y65T69,Y70T74,Y75T79,Y80T84,Y85T89,Y90T94,Y95T99,Y_GE100 \
  --dim LMS=_T \
  --output data/census_age_detail.csv

# 1b. Aggregate into dashboard-ready JSON (copies into dashboard/public/data/)
python scripts/prepare_dashboard_data.py
```

## 2. Install dependencies

```bash
cd dashboard
npm install
```

## 3. Run the dashboard locally

```bash
npm run dev
# visit http://localhost:5173
```

## 4. Build for production

```bash
npm run build
# outputs to dashboard/dist
```

## Notes

- The dashboard currently focuses on the 2021 census (legal marital status by sex and age).
- Additional indicators can be layered by extending the Python preparation scripts and updating the front-end charts.
