# Ageing Luxembourg Dashboard - STATEC Hackathon 2025

## What This Project Does

This interactive dashboard explores how Luxembourg's ageing population shapes society and the economy. It visualizes demographic trends, labor market dynamics, social protection needs, and living conditions using real-time data from STATEC's LUSTAT API. The dashboard combines temporal analysis (comparing different years) with geospatial dimensions (communes, cantons, European comparisons) to uncover meaningful insights about demographic shifts.

**Key Features:**
- Real-time data integration via SDMX API from LUSTAT (lustat.statec.lu)
- Interactive visualizations of population structure, employment rates, pension systems, poverty indicators, and health metrics
- Geographic analysis using Luxembourg administrative boundaries (shapefiles for communes)

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
- Python 3.8+ (for database initialization and backend API)
- Node.js 16+ and npm (for React frontend)

### Setup Instructions

Follow these steps in order:

**Step 1: Initialize Backend**
```bash
# Run the data fetch script to populate the local database
python script_backend.py
```
This downloads data from LUSTAT SDMX API and creates a local database for the dashboard. Note that it might take a while to fetch the data. It will then initialize the database, install backend dependencies and start the backend API

The backend API will run on `http://localhost:5000` (or configured port).

**Step 2: Install Frontend Dependencies**
```bash
cd dashboard/frontend
npm install
```

**Step 3: Run the Frontend Dashboard**
```bash
# From dashboard/frontend directory
npm start
```
Access the dashboard at `http://localhost:3000`

The page will reload automatically if you make edits. The React app connects to the backend API to retrieve and display the demographic data.


---


**Step 3 (Optional): Running the agent**

If wished for, and if an OpenAI API key is available, you can include the conversational agent in the dashboard frontend. 

Install the agent's requirements by installing the requirements listed in dashboard/backend/requirements.txt

```bash
pip install -r dashboard/backend/database/requirements.txt
```

Add you OpenAI API Key to the config file dashboard/backend/database/config.ini


```
nlp.openai.api_key = YOUR-API-KEY
```

Finally, start the agent by exeucting the agent.py file located in dashboard/backend/database/agent.py

```bash
python run  -r dashboard/backend/database/agent.py
```

---

### Data Sources
All data accessed via official APIs:
- **LUSTAT** (lustat.statec.lu) - STATEC's primary SDMX data portal
- **Shapefiles** - Geographic boundaries from STATEC resources

## License & Deliverables

- **Code License**: EUPL-1.2 (European Union Public License)
- **Data License**: CC BY 4.0 - Original data licenses maintained per source
- **Privacy**: No personal data used; only approved aggregated statistics

**Hackathon Deliverables Included:**
✅ README (this file) - Project overview and running instructions
✅ Reproducible artifact - React dashboard with real-time API integration
✅ Data note - See data/data_card.md for dataset documentation
✅ 5-minute pitch deck - See presentation materials
✅ Licensing & ethics note - EUPL-1.2 code, CC BY 4.0 data, GDPR compliant

---

- **Developed for**: STATEC Hackathon 2025 (October 27-29, 2025)
- **Challenge**: "Ageing Luxembourg" - Developing dashboards to analyze demographic shifts
- **Team**: LIST (Luxembourg Institute of Science and Technology) - BESSER-PEARL
- **Data Provider**: STATEC - National Institute of Statistics and Economic Studies

*This dashboard demonstrates how open statistical data can illuminate societal challenges and empower evidence-based decision-making in an ageing society.*

