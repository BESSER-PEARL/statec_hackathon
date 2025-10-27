import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const AGE_ORDER = [
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

function formatNumber(value) {
  return value.toLocaleString("en-GB");
}

function App() {
  const [dataset, setDataset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/data/dashboard_data.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load dataset (${response.status})`);
        }
        return response.json();
      })
      .then((json) => {
        setDataset(json);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const ageChartData = useMemo(() => {
    if (!dataset) {
      return [];
    }
    return AGE_ORDER.map((code) => {
      const entries = dataset.population_detailed.filter(
        (item) => item.age_code === code,
      );
      if (!entries.length) return null;
      const male = entries.find((item) => item.sex_code === "M");
      const female = entries.find((item) => item.sex_code === "F");
      return {
        age: entries[0].age_band,
        male: male ? male.value : 0,
        female: female ? female.value : 0,
      };
    }).filter(Boolean);
  }, [dataset]);

  const summaryBySex = useMemo(() => {
    if (!dataset) {
      return [];
    }
    const grouped = dataset.population_summary.reduce((acc, item) => {
      if (!acc[item.sex]) {
        acc[item.sex] = {};
      }
      acc[item.sex][item.group] = item;
      return acc;
    }, {});

    return SUMMARY_ORDER.map((group) => ({
      group,
      female: grouped.Female?.[group]?.share ?? 0,
      male: grouped.Male?.[group]?.share ?? 0,
      total: grouped.Total?.[group]?.share ?? 0,
    }));
  }, [dataset]);

  const kpis = useMemo(() => {
    if (!dataset) {
      return null;
    }
    const totalSummary = dataset.population_summary.filter(
      (item) => item.sex === "Total",
    );
    const totalPopulation = totalSummary.reduce(
      (sum, item) => sum + item.value,
      0,
    );
    const seniors = totalSummary.find(
      (item) => item.group === "Seniors (65+)",
    );
    const children = totalSummary.find(
      (item) => item.group === "Children (0-14)",
    );
    const dependency = dataset.old_age_dependency.find(
      (item) => item.sex === "Total",
    );
    const femaleDependency = dataset.old_age_dependency.find(
      (item) => item.sex === "Female",
    );
    const maleDependency = dataset.old_age_dependency.find(
      (item) => item.sex === "Male",
    );

    return {
      year: dataset.year,
      totalPopulation,
      seniorsShare: seniors?.share ?? 0,
      seniorsCount: seniors?.value ?? 0,
      childrenShare: children?.share ?? 0,
      dependencyRatio: dependency?.old_age_dependency_ratio ?? 0,
      maleDependency: maleDependency?.old_age_dependency_ratio ?? 0,
      femaleDependency: femaleDependency?.old_age_dependency_ratio ?? 0,
    };
  }, [dataset]);

  if (loading) {
    return (
      <main className="app app--loading">
        <div className="loader" />
        <p>Loading dataset…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="app app--error">
        <h1>Ageing Luxembourg Dashboard</h1>
        <p className="error-message">{error}</p>
      </main>
    );
  }

  return (
    <main className="app">
      <header className="hero">
        <div className="hero__titles">
          <p className="hero__kicker">STATEC Hackathon · Ageing Luxembourg</p>
          <h1>Understanding Luxembourg&apos;s ageing population</h1>
          <p className="hero__lede">
            Insights derived from the 2021 population census highlight how the
            country&apos;s demographic shifts are reshaping society and the
            economy. Explore population composition by age and sex, quantify the
            pressure on the labour force, and surface focus areas for
            policymakers.
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
            Residents enumerated in the 2021 Luxembourg census.
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
              A young base fuels the large 30–44 cohort, while the senior
              population widens noticeably after 70—especially among women.
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
                <YAxis tickFormatter={(value) => formatNumber(value)} />
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
              Working-age residents remain the majority, yet the senior share
              already exceeds one fifth of the total population.
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
                <YAxis tickFormatter={(value) => `${value}%`} />
                <Tooltip formatter={(value) => `${value}%`} />
                <Legend />
                <Bar dataKey="female" name="Female share" fill="#CE6F9C" />
                <Bar dataKey="male" name="Male share" fill="#4A90E2" />
              </BarChart>
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
              population, with women dominating the 80+ brackets. Health and
              long-term-care planning must anticipate more complex needs and
              target gender-specific longevity gaps.
            </p>
          </div>
          <div>
            <h3>2. Safeguard the labour force</h3>
            <p>
              The old-age dependency ratio at {kpis.dependencyRatio.toFixed(1)}%
              signals that every five working-age residents support roughly one
              senior. Immigration and participation policies are key to
              stabilise the workforce and pension finances.
            </p>
          </div>
          <div>
            <h3>3. Invest in healthy ageing &amp; inclusion</h3>
            <p>
              Growing senior cohorts call for age-friendly housing, mobility,
              and lifelong learning. Programs that empower older adults to stay
              active reduce isolation risks and help transfer knowledge across
              generations.
            </p>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div>
          <h3>Data sources</h3>
          <p>
            STATEC census tables sourced via the LUSTAT SDMX API (
            <code>DSD_CENSUS_GROUP1_3@DF_B1600</code>) and processed with the
            provided Python scripts. All figures correspond to census year{" "}
            {kpis.year}.
          </p>
        </div>
        <div>
          <h3>Reproduce this dashboard</h3>
          <ol>
            <li>
              Run <code>python scripts/sdmx_fetch_data.py ...</code> to refresh
              the census extract.
            </li>
            <li>
              Execute <code>python scripts/prepare_dashboard_data.py</code> to
              rebuild <code>data/dashboard_data.json</code>.
            </li>
            <li>
              Install dependencies with <code>npm install</code> inside{" "}
              <code>dashboard/</code> and launch <code>npm run dev</code>.
            </li>
          </ol>
        </div>
      </footer>
    </main>
  );
}

export default App;
