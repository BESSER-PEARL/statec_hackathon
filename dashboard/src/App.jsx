import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { expandSdmxRows, fetchSdmxDataset } from "./lib/sdmx.js";

const API_BASE = (
  import.meta.env.VITE_LUSTAT_BASE ?? "https://lustat.statec.lu"
).replace(/\/$/, "");

const CENSUS_FLOW = "DSD_CENSUS_GROUP1_3@DF_B1600";
const CENSUS_KEY =
  [
    "PERS",
    "POP",
    "A10",
    "_T+M+F",
    [
      "Y_LT15",
      "Y15T19",
      "Y20T24",
      "Y25T29",
      "Y30T34",
      "Y35T39",
      "Y40T44",
      "Y45T49",
      "Y50T54",
      "Y55T59",
      "Y60T64",
      "Y65T69",
      "Y70T74",
      "Y75T79",
      "Y80T84",
      "Y85T89",
      "Y90T94",
      "Y95T99",
      "Y_GE100",
    ].join("+"),
    "_T",
    "_Z",
    "_Z",
    "_Z",
    "_Z",
    "_Z",
    "_Z",
    "_Z",
    "_Z",
    "_Z",
    "_Z",
    "_Z",
    "_Z",
    "_Z",
    "_Z",
    "_Z",
    "_Z",
  ].join(".");

const EMPLOYMENT_FLOW = "DF_B3109";
const EMPLOYMENT_KEY = ["S01+S02+S03", "SL01", "A"].join(".");

const CARE_FLOW = "DF_C2206";
const CARE_KEY = ["L01+SL01+SL02", "A"].join(".");

const AGE_CODES = [
  "Y_LT15",
  "Y15T19",
  "Y20T24",
  "Y25T29",
  "Y30T34",
  "Y35T39",
  "Y40T44",
  "Y45T49",
  "Y50T54",
  "Y55T59",
  "Y60T64",
  "Y65T69",
  "Y70T74",
  "Y75T79",
  "Y80T84",
  "Y85T89",
  "Y90T94",
  "Y95T99",
  "Y_GE100",
];

const SUMMARY_ORDER = [
  "Children (0-14)",
  "Working-age (15-64)",
  "Seniors (65+)",
];

const SUMMARY_GROUPS = {
  "Children (0-14)": ["Y_LT15"],
  "Working-age (15-64)": [
    "Y15T19",
    "Y20T24",
    "Y25T29",
    "Y30T34",
    "Y35T39",
    "Y40T44",
    "Y45T49",
    "Y50T54",
    "Y55T59",
    "Y60T64",
  ],
  "Seniors (65+)": [
    "Y65T69",
    "Y70T74",
    "Y75T79",
    "Y80T84",
    "Y85T89",
    "Y90T94",
    "Y95T99",
    "Y_GE100",
  ],
};

const EMPLOYMENT_SERIES_LABELS = {
  S01: "Total",
  S02: "Women",
  S03: "Men",
};

const CARE_LABELS = {
  L01: "Total benefits",
  SL01: "Cash benefits",
  SL02: "Benefits in kind",
};

function formatNumber(value) {
  return Number.isFinite(value) ? value.toLocaleString("en-GB") : "-";
}

function applyPercentage(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)}%` : "-";
}

async function loadCensusRows(signal) {
  const payload = await fetchSdmxDataset({
    baseUrl: API_BASE,
    flowId: CENSUS_FLOW,
    key: CENSUS_KEY,
    params: { startPeriod: "2011" },
    signal,
  });
  return expandSdmxRows(payload);
}

async function loadEmploymentRows(signal) {
  const payload = await fetchSdmxDataset({
    baseUrl: API_BASE,
    flowId: EMPLOYMENT_FLOW,
    key: EMPLOYMENT_KEY,
    params: { startPeriod: "2000" },
    signal,
  });
  return expandSdmxRows(payload);
}

async function loadCareRows(signal) {
  const payload = await fetchSdmxDataset({
    baseUrl: API_BASE,
    flowId: CARE_FLOW,
    key: CARE_KEY,
    params: { startPeriod: "2000" },
    signal,
  });
  return expandSdmxRows(payload);
}

function calculateCensusSummaries(rows) {
  const totals = { _T: 0, F: 0, M: 0 };
  const grouped = {
    _T: Object.fromEntries(
      Object.keys(SUMMARY_GROUPS).map((group) => [group, 0]),
    ),
    F: Object.fromEntries(
      Object.keys(SUMMARY_GROUPS).map((group) => [group, 0]),
    ),
    M: Object.fromEntries(
      Object.keys(SUMMARY_GROUPS).map((group) => [group, 0]),
    ),
  };

  const ageChartMap = new Map();

  rows.forEach((row) => {
    const sex = row.SEX;
    const age = row.AGE;
    const value = row.OBS_VALUE ?? 0;

    if (sex in totals) {
      totals[sex] += value;
      for (const [group, codes] of Object.entries(SUMMARY_GROUPS)) {
        if (codes.includes(age)) {
          grouped[sex][group] += value;
        }
      }
    }

    if (AGE_CODES.includes(age)) {
      const current = ageChartMap.get(age) ?? {
        age: row.AGE_label,
        female: 0,
        male: 0,
      };
      if (sex === "F") {
        current.female += value;
      } else if (sex === "M") {
        current.male += value;
      }
      ageChartMap.set(age, current);
    }
  });

  const share = (sexCode, group) => {
    const total = totals[sexCode] || 0;
    if (!total) return 0;
    return (grouped[sexCode][group] / total) * 100;
  };

  const dependency = (sexCode) => {
    const seniors = grouped[sexCode]["Seniors (65+)"] ?? 0;
    const working = grouped[sexCode]["Working-age (15-64)"] ?? 0;
    if (!working) return 0;
    return (seniors / working) * 100;
  };

  const ageChartData = AGE_CODES.map((code) => ageChartMap.get(code)).filter(
    Boolean,
  );
  const summaryBySex = SUMMARY_ORDER.map((group) => ({
    group,
    female: share("F", group),
    male: share("M", group),
    total: share("_T", group),
  }));

  const totalPopulation = totals._T;
  const seniorsCount = grouped._T["Seniors (65+)"] ?? 0;

  return {
    kpis: {
      year: Number(rows[0]?.TIME_PERIOD ?? rows[0]?.TIME_PERIOD_label ?? 0),
      totalPopulation,
      seniorsShare: share("_T", "Seniors (65+)"),
      seniorsCount,
      childrenShare: share("_T", "Children (0-14)"),
      dependencyRatio: dependency("_T"),
      femaleDependency: dependency("F"),
      maleDependency: dependency("M"),
    },
    ageChartData,
    summaryBySex,
  };
}

function prepareEmploymentSeries(rows) {
  const byYear = new Map();

  rows
    .filter((row) => row.SPECIFICATION === "SL01")
    .forEach((row) => {
      const year = Number(row.TIME_PERIOD);
      if (!Number.isFinite(year)) return;
      if (!byYear.has(year)) byYear.set(year, { year });

      const label =
        EMPLOYMENT_SERIES_LABELS[row.SEX] ?? row.SEX_label ?? row.SEX;
      byYear.get(year)[label] = row.OBS_VALUE;
    });

  const series = Array.from(byYear.values())
    .sort((a, b) => a.year - b.year)
    .filter((item) => item.year >= 2000);

  return {
    series,
    latest: series[series.length - 1] ?? null,
  };
}

function prepareCareSeries(rows) {
  const byYear = new Map();

  rows
    .filter((row) => CARE_LABELS[row.SPECIFICATION])
    .forEach((row) => {
      const year = Number(row.TIME_PERIOD);
      if (!Number.isFinite(year)) return;
      if (!byYear.has(year)) byYear.set(year, { year });

      const label = CARE_LABELS[row.SPECIFICATION];
      byYear.get(year)[label] = row.OBS_VALUE;
    });

  const series = Array.from(byYear.values())
    .sort((a, b) => a.year - b.year)
    .filter((item) => item.year >= 2000);

  return {
    series,
    latest: series[series.length - 1] ?? null,
  };
}

function App() {
  const [viewData, setViewData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    async function hydrate() {
      try {
        setLoading(true);
        setError(null);

        const [censusRows, employmentRows, careRows] = await Promise.all([
          loadCensusRows(controller.signal),
          loadEmploymentRows(controller.signal),
          loadCareRows(controller.signal),
        ]);

        setViewData({
          census: calculateCensusSummaries(censusRows),
          employment: prepareEmploymentSeries(employmentRows),
          care: prepareCareSeries(careRows),
        });
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    }

    hydrate();
    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <main className="app app--loading">
        <div className="loader" />
        <p>Loading datasets from STATEC…</p>
      </main>
    );
  }

  if (error || !viewData) {
    return (
      <main className="app app--error">
        <h1>Ageing Luxembourg Dashboard</h1>
        <p className="error-message">
          {error
            ? error
            : "No data could be retrieved from the SDMX endpoint."}
        </p>
        <p>
          Ensure the API is reachable and that{" "}
          <code>VITE_LUSTAT_BASE</code> (or the Vite proxy) is configured
          correctly.
        </p>
      </main>
    );
  }

  const { census, employment, care } = viewData;
  const { kpis, ageChartData, summaryBySex } = census;

  return (
    <main className="app">
      <header className="hero">
        <div className="hero__titles">
          <p className="hero__kicker">STATEC Hackathon · Ageing Luxembourg</p>
          <h1>Understanding Luxembourg&apos;s ageing population</h1>
          <p className="hero__lede">
            Freshly pulled from the STATEC LUSTAT API, this dashboard connects
            demographic structure, labour-market dynamics, and long-term-care
            demand to highlight how an ageing society reshapes Luxembourg.
          </p>
        </div>
        <div className="hero__badge">
          <span className="hero__year">{kpis.year}</span>
          <span className="hero__label">Latest census</span>
        </div>
      </header>

      <section className="grid kpis">
        <article className="card kpi">
          <h2>Total population</h2>
          <p className="kpi__value">{formatNumber(kpis.totalPopulation)}</p>
          <p className="kpi__hint">
            Residents enumerated in the {kpis.year} Luxembourg census.
          </p>
        </article>
        <article className="card kpi">
          <h2>Seniors (65+) share</h2>
          <p className="kpi__value">
            {kpis.seniorsShare.toFixed(1)}
            <span className="kpi__suffix">%</span>
          </p>
          <p className="kpi__hint">
            {formatNumber(kpis.seniorsCount)} residents aged 65 and above.
          </p>
        </article>
        <article className="card kpi">
          <h2>Old-age dependency</h2>
          <p className="kpi__value">
            {kpis.dependencyRatio.toFixed(1)}
            <span className="kpi__suffix">%</span>
          </p>
          <p className="kpi__hint">
            Seniors relative to the working-age (15–64) population.
          </p>
        </article>
        <article className="card kpi">
          <h2>Dependency by sex</h2>
          <div className="kpi__split">
            <div>
              <span className="kpi__chip kpi__chip--female">Female</span>
              <span className="kpi__split-value">
                {kpis.femaleDependency.toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="kpi__chip kpi__chip--male">Male</span>
              <span className="kpi__split-value">
                {kpis.maleDependency.toFixed(1)}%
              </span>
            </div>
          </div>
          <p className="kpi__hint">
            Women already outnumber men in the 65+ workforce dependency ratio.
          </p>
        </article>
      </section>

      <section className="grid charts">
        <article className="card chart">
          <header>
            <h2>Population by age band and sex</h2>
            <p>
              Luxembourg keeps a broad working-age base, yet the female senior
              population widens sharply after 70.
            </p>
          </header>
          <div className="chart__container">
            <ResponsiveContainer width="100%" height={360}>
              <BarChart
                data={ageChartData}
                margin={{ top: 16, right: 24, left: 0, bottom: 36 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="age" tick={{ fontSize: 12 }} interval={0} />
                <YAxis tickFormatter={formatNumber} />
                <Tooltip
                  formatter={(value) => formatNumber(value)}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Legend />
                <Bar
                  dataKey="female"
                  name="Female"
                  stackId="total"
                  fill="#CE6F9C"
                />
                <Bar
                  dataKey="male"
                  name="Male"
                  stackId="total"
                  fill="#4A90E2"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="card chart">
          <header>
            <h2>Population share by life stage</h2>
            <p>
              Working-age residents dominate, but seniors already represent more
              than one fifth of the population.
            </p>
          </header>
          <div className="chart__container chart__container--small">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={summaryBySex}
                margin={{ top: 16, right: 24, left: 0, bottom: 16 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="group" />
                <YAxis tickFormatter={(value) => `${value.toFixed(0)}%`} />
                <Tooltip
                  formatter={(value) => `${Number(value).toFixed(1)}%`}
                />
                <Legend />
                <Bar dataKey="female" name="Female share" fill="#CE6F9C" />
                <Bar dataKey="male" name="Male share" fill="#4A90E2" />
                <Bar dataKey="total" name="Total share" fill="#1C3F60" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="card chart">
          <header>
            <h2>Employment rate (15–64) by sex</h2>
            <p>
              Labour-force participation recovered after the pandemic, but the
              female rate still trails the male rate, shaping future dependency.
            </p>
          </header>
          <div className="chart__container chart__container--small">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart
                data={employment.series}
                margin={{ top: 16, right: 24, left: 0, bottom: 16 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="year" />
                <YAxis tickFormatter={(value) => `${value.toFixed(0)}%`} />
                <Tooltip formatter={(value) => applyPercentage(value)} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="Total"
                  stroke="#1C3F60"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="Men"
                  stroke="#4A90E2"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="Women"
                  stroke="#CE6F9C"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="card chart">
          <header>
            <h2>Long-term care benefits (million EUR)</h2>
            <p>
              Expenditure on benefits in kind keeps rising faster than cash
              allowances, signalling growing demand for hands-on support.
            </p>
          </header>
          <div className="chart__container chart__container--small">
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart
                data={care.series}
                margin={{ top: 16, right: 24, left: 0, bottom: 16 }}
              >
                <defs>
                  <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F4C542" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#F4C542" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorInKind" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1C3F60" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="#1C3F60" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="year" />
                <YAxis tickFormatter={formatNumber} />
                <Tooltip formatter={(value) => `${formatNumber(value)} €m`} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="Cash benefits"
                  stroke="#F4C542"
                  fill="url(#colorCash)"
                  strokeWidth={2}
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="Benefits in kind"
                  stroke="#1C3F60"
                  fill="url(#colorInKind)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="Total benefits"
                  stroke="#4A90E2"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="card narrative">
        <h2>What this means for policy</h2>
        <div className="narrative__grid">
          <div>
            <h3>1. Prepare for sustained demand in care services</h3>
            <p>
              Seniors already represent {kpis.seniorsShare.toFixed(1)}% of the
              population, and benefits in kind for long-term care keep climbing.
              Luxembourg needs to scale professional care capacity while
              supporting family carers.
            </p>
          </div>
          <div>
            <h3>2. Safeguard the labour force</h3>
            <p>
              The employment rate for 15–64 year-olds remains above pre-pandemic
              levels, but the gap between men and women persists. Retaining and
              re-skilling women will help offset the rising dependency burden.
            </p>
          </div>
          <div>
            <h3>3. Invest in healthy ageing &amp; inclusion</h3>
            <p>
              A larger senior cohort calls for age-friendly housing, mobility,
              and lifelong learning. Programmes that keep older adults active
              help reduce isolation and transfer knowledge across generations.
            </p>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div>
          <h3>Data sources</h3>
          <p>
            STATEC LUSTAT SDMX API — dataflows{" "}
            <code>{CENSUS_FLOW}</code>, <code>{EMPLOYMENT_FLOW}</code>,{" "}
            <code>{CARE_FLOW}</code>. Requests are executed directly from the
            browser with the HTTP header{" "}
            <code>Accept: application/vnd.sdmx.data+json; version=2</code>.
          </p>
        </div>
        <div>
          <h3>Add more datasets</h3>
          <ol>
            <li>
              Look up additional dataflow IDs in the hackathon appendix (e.g.
              social protection, health) and add new loaders alongside{" "}
              <code>loadEmploymentRows</code> and <code>loadCareRows</code>.
            </li>
            <li>
              Transform records with reusable helpers (see{" "}
              <code>prepareEmploymentSeries</code>) and plug them into new
              Recharts components.
            </li>
            <li>
              For local dev without CORS, set <code>VITE_LUSTAT_BASE=/lustat</code>{" "}
              to use the built-in Vite proxy (see <code>dashboard/README.md</code>).
            </li>
          </ol>
        </div>
      </footer>
    </main>
  );
}

export default App;
