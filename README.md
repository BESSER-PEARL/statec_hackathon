# Ageing Luxembourg Dashboard - STATEC Hackathon 2025

## What This Project Does

This project makes the data from LUSTAT more accessible to the people by providing a dashboard combining datasets available on LUSTAT. Instead of different pages for different pages, we have all in one dashboard. Additionally, if an OPENAI API key is provided, an additional layer of accessibility is made available by an agent that responsds to natural language queries and tries to select the best dataset and dimension for the request. 


**Key Features:**
- Data integration via SDMX API from LUSTAT (lustat.statec.lu)
- Interactive visualizations of population structure, employment rates, pension systems, poverty indicators, and health metrics
- Geographic analysis using Luxembourg administrative boundaries (shapefiles for communes)

## Why It Matters for Public Statistics

**Addressing Luxembourg's Demographic Challenge**: This project demonstrates modern approaches to statistical communication, transforming complex official data into accessible insights that support evidence-based policy making.

**Impact Areas:**
- **Open Data Showcase**: Demonstrates the value of Luxembourg's open statistical infrastructure (LUSTAT)
- **Public Awareness**: Makes demographic statistics accessible to citizens, researchers, and journalists
- **Reproducible Research**: All features are usable with this repository

This deliverable fulfills STATEC's mission to "produce a detailed, reliable, and objective picture of society in order to inform public and private decision-making."

## How to Run It

### Prerequisites
- Python 3.11 (for database initialization and backend API)
- Node.js 16+ and npm (for React frontend)

### Setup Instructions

Follow these steps in order:

**Step 1: Initialize Backend**
```bash
# Run the data fetch script to populate the local database
python script_backend.py
```
This downloads data from LUSTAT SDMX API and creates a local database for the dashboard. Note that it might take a while to fetch the data. It will then initialize the database, install backend dependencies and start the backend API

The backend API will run on `http://localhost:8000` (or configured port).

**_The data fetched during backend initialization uses the LUSTAT SDMX API. The full list of endpoints currently used can be found in [`dashboard/backend/database/LustatCensus.txt`](dashboard/backend/database/LustatCensus.txt). Our database is designed to be compatible with any LUSTAT data table, so you can easily add new data tables in [`LustatCensus.txt`](dashboard/backend/database/LustatCensus.txt) by following the API call format for JSON info. Then you can inizialize the backend again to get the new data._**

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
python dashboard/backend/database/agent.py
```

---

- **Developed for**: STATEC Hackathon 2025 (October 27-29, 2025)
- **Challenge**: "Ageing Luxembourg" - Developing dashboards to analyze demographic shifts
- **Team**: LIST (Luxembourg Institute of Science and Technology) - BESSER-PEARL
- **Data Provider**: STATEC - National Institute of Statistics and Economic Studies



## Data note

You can access the detailed [data card here](DATA_CARD.md).

## Licenses
This project is licensed under the [`MIT license`](LICENSE.md).