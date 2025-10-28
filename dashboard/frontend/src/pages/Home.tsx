import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import componentsData from "../data/ui_components.json";
import stylesData from "../data/ui_styles.json";
import { Renderer } from "../components/Renderer";
import { applyStyle, StyleData } from "../utils/applyStyle";
import { StatCardComponent } from "../components/StatCardComponent";

import "./Home.css";

type AggregateItem = {
  category_code: string;
  category_label: string;
  value: number;
  share: number | null;
};

type AggregateResponse = {
  results: AggregateItem[];
};

type AgeingInsights = {
  dataset_code: string;
  time_period: string;
  population_total: number;
  children_population: number;
  working_age_population: number;
  seniors_population: number;
  share_children: number;
  share_seniors: number;
  share_80_plus: number;
  old_age_dependency_ratio: number;
  senior_age_codes: string[];
};

type DatasetSummary = {
  code: string;
  name: string;
  description?: string;
};

type DimensionCategory = {
  code: string;
  name: string;
  label?: string;
  parent_code?: string | null;
};

type DimensionDetailResponse = {
  code: string;
  label: string;
  categories: DimensionCategory[];
};

type DatasetDetail = {
  code: string;
  name: string;
  description?: string;
  provider?: string;
  updated_at?: string;
  dimension_count: number;
  observation_count: number;
  dimensions: { code: string; label: string; category_count: number }[];
};

type ObservationPoint = {
  observation_id: number;
  value: number;
  time_period?: string | null;
  dimensions: Record<string, string>;
};

const DEFAULT_DATASET_CODE = "DSD_CENSUS_GROUP1_3@DF_B1600";
const mainPageId = "ageing-dashboard";
const API_BASE =
  (process.env.REACT_APP_BACKEND_URL as string | undefined) ||
  "http://localhost:8000";
const OBSERVATION_LIMIT = 25;

const dimensionOptions: { value: "AGE" | "LMS" | "SEX"; label: string }[] = [
  { value: "AGE", label: "Age groups" },
  { value: "LMS", label: "Legal marital status" },
  { value: "SEX", label: "Sex" },
];

const chartOptions: { value: "bar" | "pie"; label: string }[] = [
  { value: "bar", label: "Bar chart" },
  { value: "pie", label: "Pie chart" },
];

const valueOptions: { value: "share" | "value"; label: string }[] = [
  { value: "share", label: "Percentage share" },
  { value: "value", label: "Population count" },
];

const BAR_COLORS = ["#4F46E5", "#6366F1", "#7C3AED", "#EC4899", "#F97316", "#0EA5E9"];
const PIE_COLORS = ["#6366F1", "#EC4899", "#F59E0B", "#0EA5E9", "#10B981", "#1D4ED8"];

const formatNumber = (value: number, digits = 0): string =>
  new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);

const tooltipValue = (value: number, type: "share" | "value") =>
  type === "share" ? `${value.toFixed(2)}%` : formatNumber(value);

const Home: React.FC = () => {
  const pages = componentsData.pages ?? [];
  const page = pages.find((p: any) => (mainPageId ? p.id === mainPageId : false)) ?? pages[0];

  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>(DEFAULT_DATASET_CODE);
  const [datasetDetail, setDatasetDetail] = useState<DatasetDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [insights, setInsights] = useState<AgeingInsights | null>(null);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  const [dimensionFilters, setDimensionFilters] = useState<Record<string, string>>({});
  const [dimensionCategories, setDimensionCategories] = useState<Record<string, DimensionCategory[]>>({});
  const [dimensionCategoriesLoading, setDimensionCategoriesLoading] = useState<Record<string, boolean>>({});
  const [dimensionCategoriesError, setDimensionCategoriesError] = useState<Record<string, string>>({});

  const [selectedDimension, setSelectedDimension] = useState<"AGE" | "LMS" | "SEX">("AGE");
  const [chartType, setChartType] = useState<"bar" | "pie">("bar");
  const [valueType, setValueType] = useState<"share" | "value">("share");

  const [widgetData, setWidgetData] = useState<AggregateItem[]>([]);
  const [widgetLoading, setWidgetLoading] = useState(false);
  const [widgetError, setWidgetError] = useState<string | null>(null);

  const [observations, setObservations] = useState<ObservationPoint[]>([]);
  const [obsLoading, setObsLoading] = useState(false);
  const [obsError, setObsError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDatasets = async () => {
      try {
        const response = await axios.get<DatasetSummary[]>(`${API_BASE}/datasets`);
        setDatasets(response.data);
        setSelectedDataset((current) => {
          if (response.data.length === 0) {
            return current;
          }
          if (current && response.data.some((dataset) => dataset.code === current)) {
            return current;
          }
          return response.data[0].code;
        });
      } catch (error) {
        console.error(error);
      }
    };

    fetchDatasets();
  }, []);

  useEffect(() => {
    if (!selectedDataset) {
      return;
    }

    const fetchDetail = async () => {
      try {
        const response = await axios.get<DatasetDetail>(
          `${API_BASE}/datasets/${selectedDataset}`
        );
        const uniqueDimensions = response.data.dimensions.reduce<DatasetDetail["dimensions"]>((acc, dim) => {
          if (!acc.some((entry) => entry.code === dim.code)) {
            acc.push(dim);
          }
          return acc;
        }, []);
        setDatasetDetail({ ...response.data, dimensions: uniqueDimensions });
        setDetailError(null);
      } catch (error) {
        console.error(error);
        setDatasetDetail(null);
        setDetailError("Dataset metadata unavailable.");
      }
    };

    fetchDetail();
  }, [selectedDataset]);

  useEffect(() => {
    if (!selectedDataset) {
      return;
    }

    const fetchInsights = async () => {
      try {
        const response = await axios.get<AgeingInsights>(
          `${API_BASE}/datasets/${selectedDataset}/insights/ageing`
        );
        setInsights(response.data);
        setInsightsError(null);
      } catch (error) {
        console.error(error);
        setInsights(null);
        setInsightsError("Ageing summary unavailable for this dataset.");
      }
    };

    fetchInsights();
  }, [selectedDataset]);

  const filteredDimensions = useMemo(() => {
    if (!datasetDetail) {
      return [];
    }
    // Filter out dimensions that should not be shown in filters
    // (e.g., the dimension being explored, or dimensions with only one category)
    return datasetDetail.dimensions.filter((dimension) => {
      if (dimension.code === selectedDimension) {
        return false; // Don't show the dimension we're exploring
      }
      if (dimension.category_count <= 1) {
        return false; // No point filtering on single-category dimensions
      }
      return true;
    });
  }, [datasetDetail, selectedDimension]);

  const getFilterableCategories = (dimensionCode: string) => {
    const categories = dimensionCategories[dimensionCode];
    if (!categories) {
      return [];
    }
    // Filter out non-applicable categories (those starting with _X or _Z)
    return categories.filter((category) => {
      const code = category.code.toUpperCase();
      // Keep total categories and regular categories
      if (["_T", "TOTAL", "TOT"].includes(code)) {
        return true;
      }
      // Filter out not applicable markers
      if (code.startsWith("_X") || code.startsWith("_Z") || code === "_U" || code === "_N") {
        return false;
      }
      return true;
    });
  };

  useEffect(() => {
    if (!datasetDetail) {
      setDimensionFilters({});
      setDimensionCategories({});
      setDimensionCategoriesLoading({});
      setDimensionCategoriesError({});
      return;
    }

    setDimensionFilters((prev) => {
      const next: Record<string, string> = {};
      filteredDimensions.forEach((dimension) => {
        next[dimension.code] = prev[dimension.code] ?? "_T";
      });
      return next;
    });
    setDimensionCategories({});
    setDimensionCategoriesLoading({});
    setDimensionCategoriesError({});
  }, [datasetDetail, filteredDimensions]);

  const activeInsights =
    insights && insights.dataset_code === selectedDataset ? insights : null;

  const fetchDimensionCategories = useCallback(async (dimensionCode: string) => {
    if (!selectedDataset) {
      return;
    }
    if (dimensionCategories[dimensionCode] || dimensionCategoriesLoading[dimensionCode]) {
      return;
    }

    setDimensionCategoriesLoading((prev) => ({ ...prev, [dimensionCode]: true }));
    try {
      const response = await axios.get<DimensionDetailResponse>(
        `${API_BASE}/datasets/${selectedDataset}/dimensions/${dimensionCode}`
      );
      const uniqueCategories = response.data.categories.reduce<DimensionCategory[]>((acc, category) => {
        if (!acc.some((entry) => entry.code === category.code)) {
          acc.push(category);
        }
        return acc;
      }, []);
      setDimensionCategories((prev) => ({
        ...prev,
        [dimensionCode]: uniqueCategories,
      }));
      setDimensionCategoriesError((prev) => ({ ...prev, [dimensionCode]: "" }));

      setDimensionFilters((prev) => {
        if (prev[dimensionCode]) {
          return prev;
        }
        const totalCategory = response.data.categories.find((category) =>
          ["_T", "TOTAL", "TOT"].includes(category.code)
        );
        const fallback = response.data.categories[0]?.code ?? "_T";
        return {
          ...prev,
          [dimensionCode]: totalCategory?.code ?? fallback,
        };
      });
    } catch (error) {
      console.error(error);
      setDimensionCategoriesError((prev) => ({
        ...prev,
        [dimensionCode]: "Unable to load categories",
      }));
    } finally {
      setDimensionCategoriesLoading((prev) => ({ ...prev, [dimensionCode]: false }));
    }
  }, [selectedDataset, dimensionCategories, dimensionCategoriesLoading]);

  useEffect(() => {
    if (!datasetDetail) {
      return;
    }
    fetchDimensionCategories(selectedDimension);
  }, [datasetDetail, selectedDataset, selectedDimension, fetchDimensionCategories]);

  useEffect(() => {
    if (!selectedDataset) {
      return;
    }

    const fetchAggregates = async () => {
      try {
        setWidgetLoading(true);
        setWidgetError(null);

        const params = new URLSearchParams();
        params.set("dimension", selectedDimension);
        const timePeriod = activeInsights?.time_period ?? "2021";
        params.set("TIME_PERIOD", timePeriod);
        params.set("MEASURE", "POP");
        params.set("UNIT_MEASURE", "PERS");
        params.set("FREQ", "A10");

        if (datasetDetail) {
          filteredDimensions.forEach((dimension) => {
            const filterValue = dimensionFilters[dimension.code] ?? "_T";
            params.set(dimension.code, filterValue);
          });
        }

        const response = await axios.get<AggregateResponse>(
          `${API_BASE}/datasets/${selectedDataset}/aggregates`,
          { params }
        );

        const withoutTotals = response.data.results.filter(
          (item) => item.category_code !== "_T"
        );
        setWidgetData(withoutTotals);
      } catch (error) {
        console.error(error);
        setWidgetError("Unable to load the selected insight. Please adjust the filters.");
        setWidgetData([]);
      } finally {
        setWidgetLoading(false);
      }
    };

    fetchAggregates();
  }, [selectedDataset, selectedDimension, dimensionFilters, datasetDetail, filteredDimensions, activeInsights?.time_period]);

  const handleDimensionFilterChange = (dimensionCode: string, value: string) => {
    setDimensionFilters((prev) => ({ ...prev, [dimensionCode]: value }));
  };

  const metrics = useMemo(() => {
    if (!activeInsights) {
      return [
        {
          id: "metric-population",
          title: "Population covered",
          value: "�",
          subtitle: "Select a dataset with ageing insight",
        },
        {
          id: "metric-senior-share",
          title: "Share aged 65+",
          value: "�",
          subtitle: "People, % of population",
        },
        {
          id: "metric-veryold",
          title: "Very old (80+)",
          value: "�",
          subtitle: "Population share",
        },
        {
          id: "metric-dependency",
          title: "Old-age dependency",
          value: "�",
          subtitle: "Seniors per 100 workers",
        },
      ];
    }

    return [
      {
        id: "metric-population",
        title: "Population covered",
        value: formatNumber(activeInsights.population_total),
        subtitle: `Census ${activeInsights.time_period}`,
      },
      {
        id: "metric-senior-share",
        title: "Share aged 65+",
        value: `${formatNumber(activeInsights.share_seniors, 1)}%`,
        subtitle: `${formatNumber(activeInsights.seniors_population)} people`,
      },
      {
        id: "metric-veryold",
        title: "Very old (80+)",
        value: `${formatNumber(activeInsights.share_80_plus, 1)}%`,
        subtitle: "Population share",
      },
      {
        id: "metric-dependency",
        title: "Old-age dependency",
        value: formatNumber(activeInsights.old_age_dependency_ratio, 1),
        subtitle: "Seniors per 100 workers",
      },
    ];
  }, [activeInsights]);

  const highlightInsights = useMemo(() => {
    if (!activeInsights) {
      return [];
    }

    return [
      `Luxembourg counts ${formatNumber(
        activeInsights.seniors_population
      )} residents aged 65+, representing ${formatNumber(activeInsights.share_seniors, 1)}% of the population.`,
      `Very old residents (80+) already account for ${formatNumber(
        activeInsights.share_80_plus,
        1
      )}% of the population.`,
      `The old-age dependency ratio reaches ${formatNumber(
        activeInsights.old_age_dependency_ratio,
        1
      )}, meaning roughly that many seniors for every 100 working-age residents.`,
    ];
  }, [activeInsights]);

  const widgetDataset = useMemo(() => {
    if (!widgetData.length) {
      return [];
    }

    return widgetData.map((item) => ({
      label: item.category_label,
      code: item.category_code,
      value: valueType === "share"
        ? Number((item.share ?? 0).toFixed(2))
        : Number(item.value.toFixed(0)),
      rawShare: item.share ?? 0,
      rawValue: item.value,
    }));
  }, [widgetData, valueType]);

  const chartTitle = useMemo(() => {
    const label =
      dimensionOptions.find((option) => option.value === selectedDimension)?.label ??
      selectedDimension;
    return `${label} � ${valueType === "share" ? "percentage share" : "population count"}`;
  }, [selectedDimension, valueType]);

  const handleFetchObservations = async () => {
    if (!selectedDataset) {
      return;
    }
    if (datasetDetail) {
      await Promise.all(
        datasetDetail.dimensions.map((dimension) => fetchDimensionCategories(dimension.code))
      );
    }

    try {
      setObsLoading(true);
      setObsError(null);
      const response = await axios.get<ObservationPoint[]>(
        `${API_BASE}/datasets/${selectedDataset}/observations`,
        { params: { limit: OBSERVATION_LIMIT } }
      );
      setObservations(response.data);
    } catch (error) {
      console.error(error);
      setObsError("Unable to fetch observations sample.");
      setObservations([]);
    } finally {
      setObsLoading(false);
    }
  };

  const filteredObservations = useMemo(() => {
    if (!observations.length) {
      return [];
    }

    return observations.filter((observation) => {
      return Object.entries(dimensionFilters).every(([dimensionCode, selectedValue]) => {
        if (!selectedValue || selectedValue === "_T") {
          return true;
        }
        return observation.dimensions?.[dimensionCode] === selectedValue;
      });
    });
  }, [observations, dimensionFilters]);

  const getCategoryDisplay = (dimensionCode: string, categoryCode: string | undefined) => {
    if (!categoryCode) {
      return "�";
    }
    if (categoryCode === "_T") {
      return "Total";
    }
    const categories = dimensionCategories[dimensionCode];
    const match = categories?.find((category) => category.code === categoryCode);
    if (!match) {
      return categoryCode;
    }
    const label = match.label || match.name;
    return label ? `${label} (${categoryCode})` : categoryCode;
  };

  const styles = (stylesData.styles ?? []) as StyleData[];
  const pageStyle: React.CSSProperties =
    page !== undefined
      ? {
          width: "100%",
          ...applyStyle(`#${page.id}`, styles),
        }
      : {
          width: "100%",
        };

  return (
    <div className="page">
      <div
        className="page__generated"
        id={page?.id ?? "generated-layout"}
        style={pageStyle}
      >
        {page ? (
          (page.components ?? []).map((component: any) => (
            <Renderer key={component.id} component={component} styles={styles} />
          ))
        ) : (
          <div className="page--error">No screens defined in the generated GUI model.</div>
        )}
      </div>

      <section className="metrics-grid">
        {metrics.map((metric) => (
          <StatCardComponent
            key={metric.id}
            id={metric.id}
            title={metric.title}
            value={metric.value}
            subtitle={metric.subtitle}
          />
        ))}
      </section>

      <section className="playground">
        <div className="playground__intro">
          <div>
            <h2>Build your own insight</h2>
            <p>
              Select a dataset, mix and match the available dimensions, and the insight builder
              will query the STATEC API on the fly. It is a rapid way to validate hypotheses
              during the hackathon.
            </p>
          </div>
          {highlightInsights.length > 0 && (
            <aside>
              <h4>Quick facts</h4>
              <ul>
                {highlightInsights.map((item, index) => (
                  <li key={`insight-${index}`}>{item}</li>
                ))}
              </ul>
            </aside>
          )}
        </div>

        <div className="playground__controls">
          <div className="playground__control">
            <label htmlFor="dataset-select">Dataset</label>
            <select
              id="dataset-select"
              value={selectedDataset}
              onChange={(event) => setSelectedDataset(event.target.value)}
            >
              {datasets.length === 0 && (
                <option value={selectedDataset}>{selectedDataset}</option>
              )}
              {datasets.map((dataset) => (
                <option key={dataset.code} value={dataset.code}>
                  {dataset.name || dataset.code}
                </option>
              ))}
            </select>
          </div>

          <div className="playground__control">
            <label htmlFor="dimension-select">Dimension to explore</label>
            <select
              id="dimension-select"
              value={selectedDimension}
              onChange={(event) =>
                setSelectedDimension(event.target.value as "AGE" | "LMS" | "SEX")
              }
            >
              {dimensionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="playground__control">
            <label htmlFor="chart-type-select">Widget</label>
            <select
              id="chart-type-select"
              value={chartType}
              onChange={(event) => setChartType(event.target.value as "bar" | "pie")}
            >
              {chartOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="playground__control">
            <label htmlFor="value-type-select">Metric</label>
            <select
              id="value-type-select"
              value={valueType}
              onChange={(event) => setValueType(event.target.value as "share" | "value")}
            >
              {valueOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredDimensions.length > 0 && (
          <div className="playground__filters">
            {filteredDimensions.map((dimension) => {
              const allCategories = dimensionCategories[dimension.code] || [];
              const categories = getFilterableCategories(dimension.code);
              const selectedValue = dimensionFilters[dimension.code] ?? "_T";
              
              // Skip if no filterable categories
              if (categories.length === 0 && allCategories.length > 0) {
                return null;
              }
              
              return (
                <div className="playground__filter" key={dimension.code}>
                  <label htmlFor={`filter-${dimension.code}`}>
                    {dimension.label || dimension.code}
                  </label>
                  <select
                    id={`filter-${dimension.code}`}
                    value={selectedValue}
                    onFocus={() => fetchDimensionCategories(dimension.code)}
                    onChange={(event) =>
                      handleDimensionFilterChange(dimension.code, event.target.value)
                    }
                  >
                    <option value="_T">All categories</option>
                    {categories.map((category) => (
                      <option key={category.code} value={category.code}>
                        {category.label || category.name || category.code}
                      </option>
                    ))}
                  </select>
                  {dimensionCategoriesLoading[dimension.code] && (
                    <span className="playground__hint">Loading…</span>
                  )}
                  {dimensionCategoriesError[dimension.code] && (
                    <span className="playground__hint playground__hint--error">
                      {dimensionCategoriesError[dimension.code]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {datasetDetail && (
          <div className="playground__dataset-summary">
            <div>
              <h4>{datasetDetail.name}</h4>
              <p>{datasetDetail.description || "No description available."}</p>
            </div>
            <ul>
              <li>
                <strong>Dimensions:</strong> {datasetDetail.dimension_count}
              </li>
              <li>
                <strong>Observations:</strong> {formatNumber(datasetDetail.observation_count)}
              </li>
              <li>
                <strong>Provider:</strong> {datasetDetail.provider ?? "STATEC"}
              </li>
            </ul>
          </div>
        )}

        {detailError && (
          <div className="playground__alert playground__alert--warning">{detailError}</div>
        )}

        <div className="playground__chart">
          {insightsError && (
            <div className="playground__alert playground__alert--warning">
              {insightsError}
            </div>
          )}
          {widgetLoading ? (
            <div className="playground__placeholder">Loading widget�</div>
          ) : widgetError ? (
            <div className="playground__alert playground__alert--error">{widgetError}</div>
          ) : !widgetDataset.length ? (
            <div className="playground__placeholder">
              Choose another combination to display data.
            </div>
          ) : (
            <div className="playground__visual">
              <h3>{chartTitle}</h3>
              {chartType === "bar" ? (
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart data={widgetDataset} margin={{ top: 12, right: 20, bottom: 12, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis
                      tickFormatter={(value) =>
                        valueType === "share" ? `${value.toFixed(0)}%` : formatNumber(value)
                      }
                    />
                    <Tooltip formatter={(value: number) => tooltipValue(value, valueType)} />
                    <Legend />
                    <Bar dataKey="value">
                      {widgetDataset.map((_, index) => (
                        <Cell key={`bar-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height={360}>
                  <PieChart>
                    <Pie
                      data={widgetDataset}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={70}
                      outerRadius={120}
                      paddingAngle={4}
                    >
                      {widgetDataset.map((entry, index) => (
                        <Cell key={`slice-${entry.code}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => tooltipValue(value, valueType)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </div>

        <div className="playground__observations">
          <div className="playground__observations-header">
            <div>
              <h3>Observation sample</h3>
              <p>Preview raw records (limit {OBSERVATION_LIMIT}). Filters above are applied.</p>
            </div>
            <button type="button" onClick={handleFetchObservations} disabled={obsLoading}>
              {obsLoading ? "Fetching�" : "Refresh sample"}
            </button>
          </div>

          {obsError && (
            <div className="playground__alert playground__alert--error">{obsError}</div>
          )}

          {!obsError && !obsLoading && filteredObservations.length === 0 && (
            <div className="playground__placeholder">
              No observations match the current selection.
            </div>
          )}

          {!obsError && filteredObservations.length > 0 && (
            <div className="playground__observations-table-wrapper">
              <table className="playground__observations-table">
                <thead>
                  <tr>
                    <th>Observation</th>
                    <th>Value</th>
                    <th>Time period</th>
                    {datasetDetail?.dimensions.map((dimension) => (
                      <th key={`head-${dimension.code}`}>{dimension.label || dimension.code}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredObservations.map((observation) => (
                    <tr key={observation.observation_id}>
                      <td>{observation.observation_id}</td>
                      <td>{formatNumber(observation.value)}</td>
                      <td>{observation.time_period ?? "�"}</td>
                      {datasetDetail?.dimensions.map((dimension) => (
                        <td key={`cell-${observation.observation_id}-${dimension.code}`}>
                          {getCategoryDisplay(
                            dimension.code,
                            observation.dimensions?.[dimension.code]
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Home;
