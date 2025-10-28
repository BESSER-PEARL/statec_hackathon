# Ageing Luxembourg Dashboard - STATEC Hackathon 2025

## What This Project Does

This interactive dashboard explores how Luxembourg's ageing population shapes society and the economy. It visualizes demographic trends, labor market dynamics, social protection needs, and living conditions using real-time data from STATEC's LUSTAT API. The dashboard combines temporal analysis (comparing different years) with geospatial dimensions (communes, cantons, European comparisons) to uncover meaningful insights about demographic shifts.

**Key Features:**
- Real-time data integration via SDMX API from LUSTAT (lustat.statec.lu)
- Interactive visualizations of population structure, employment rates, pension systems, poverty indicators, and health metrics
- Geographic analysis using Luxembourg administrative boundaries (shapefiles for communes/cantons/districts)
- Temporal comparisons showing demographic evolution over time
- Multi-indicator insights combining different statistical datasets

## Why It Matters for Public Statistics

**Addressing Luxembourg's Demographic Challenge**: This project demonstrates modern approaches to statistical communication, transforming complex official data into accessible insights that support evidence-based policy making.

**Impact Areas:**
- **Policy Support**: Enables policymakers to understand ageing impacts on healthcare, pensions, housing, and labor markets
- **Open Data Showcase**: Demonstrates the value of Luxembourg's open statistical infrastructure (LUSTAT, Eurostat, data.public.lu)
- **Statistical Innovation**: Aligns with STATEC's vision to evolve into a "leading data engineering institute" capable of addressing major economic, social, and environmental challenges
- **Public Awareness**: Makes demographic statistics accessible to citizens, researchers, and journalists
- **Reproducible Research**: Provides transparent, open-source analytics using official statistical APIs

This deliverable fulfills STATEC's mission to "produce a detailed, reliable, and objective picture of society in order to inform public and private decision-making."

## How to Run It

### Prerequisites
- Node.js 16+ and npm (for dashboard)
- Python 3.8+ (for data utilities)

### Quick Start

**1. Install Dependencies**
```bash
# Dashboard (React + Vite)
cd dashboard
npm install

# Optional data utilities
pip install -r requirements.txt
```

**2. Run the Dashboard**
```bash
cd dashboard
npm run dev
```

Access the dashboard at `http://localhost:5173`

**Note on CORS**: The LUSTAT SDMX API requires CORS proxy configuration. See [dashboard/README.md](dashboard/README.md) for proxy setup instructions.

### Repository Structure
```
├── dashboard/              # Vite + React interactive dashboard (main deliverable)
├── scripts/               # Python utilities for SDMX data fetching
├── data/                  # STATEC resources (shapefiles, PDFs, reference data)
├── requirements.txt       # Python dependencies
└── README.md             # This file
```

### Data Sources
All data accessed via official APIs:
- **LUSTAT** (lustat.statec.lu) - STATEC's primary SDMX data portal
- **Eurostat** (ec.europa.eu/eurostat) - European statistics for comparisons
- **Luxembourg Open Data Portal** (data.public.lu) - Additional datasets
- **Shapefiles** - Geographic boundaries from STATEC resources

## License & Deliverables

**Code License**: EUPL-1.2 (European Union Public License)
**Data License**: CC BY 4.0 - Original data licenses maintained per source
**Privacy**: No personal data used; only approved aggregated statistics

**Hackathon Deliverables Included:**
✅ README (this file) - Project overview and running instructions
✅ Reproducible artifact - React dashboard with real-time API integration
✅ Data note - See data/data_card.md for dataset documentation
✅ 5-minute pitch deck - See presentation materials
✅ Licensing & ethics note - EUPL-1.2 code, CC BY 4.0 data, GDPR compliant

---

**Developed for**: STATEC Hackathon 2025 (October 27-29, 2025)
**Challenge**: "Ageing Luxembourg" - Developing dashboards to analyze demographic shifts
**Team**: LIST (Luxembourg Institute of Science and Technology) - BESSER-PEARL
**Data Provider**: STATEC - National Institute of Statistics and Economic Studies

*This dashboard demonstrates how open statistical data can illuminate societal challenges and empower evidence-based decision-making in an ageing society.*

