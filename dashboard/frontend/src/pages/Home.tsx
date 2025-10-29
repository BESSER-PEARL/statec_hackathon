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
import { StatCardComponent } from "../components/StatCardComponent";
import { applyStyle, StyleData } from "../utils/applyStyle";
import MapComponent from "../components/MapComponent";

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
  category_count: number;
  applicable_category_count: number;
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
  dimensions: {
    code: string;
    label: string;
    category_count: number;
    applicable_category_count: number;
  }[];
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

const chartOptions: { value: "bar" | "pie"; label: string }[] = [
  { value: "bar", label: "Bar chart" },
  { value: "pie", label: "Pie chart" },
];

const valueOptions: { value: "share" | "value"; label: string }[] = [
  { value: "share", label: "Percentage share" },
  { value: "value", label: "Population count" },
];

const MAP_BREAKDOWN_OPTIONS = [
  {
    value: "Population by canton and municipality, legal marital status and sex",
    label: "Population by marital status and sex",
  },
  {
    value: "Population by canton and municipality and sex",
    label: "Population by sex",
  },
];

const MAP_MARITAL_OPTIONS = [
  { value: "Total", label: "All marital statuses" },
  { value: "Married or in registered partnership", label: "Married or in registered partnership" },
  {
    value: "Widowed or registered partnership ended with the death of partner (and not remarried or in a registered partnership)",
    label: "Widowed",
  },
  {
    value: "Divorced or registered partnership legally dissolved (and not remarried or in a registered partnership)",
    label: "Divorced",
  },
  { value: "Never married and never in a registered partnership", label: "Never married" },
  { value: "Not stated", label: "Not stated" },
];

const MAP_SEX_OPTIONS = [
  { value: "Total", label: "All residents" },
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" },
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

const safeNumber = (value: number | null | undefined): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const clampShare = (value: number): number => Math.min(100, Math.max(0, value));

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

  const [selectedDimension, setSelectedDimension] = useState<string>("");
  const [chartType, setChartType] = useState<"bar" | "pie">("bar");
  const [valueType, setValueType] = useState<"share" | "value">("share");
  const [mapBreakdown, setMapBreakdown] = useState<string>(MAP_BREAKDOWN_OPTIONS[0].value);
  const [mapMarital, setMapMarital] = useState<string>(MAP_MARITAL_OPTIONS[0].value);
  const [mapSex, setMapSex] = useState<string>(MAP_SEX_OPTIONS[1].value);

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

  const applicableDimensions = useMemo(
    () =>
      (datasetDetail?.dimensions ?? []).filter(
        (dimension) => dimension.applicable_category_count > 1
      ),
    [datasetDetail]
  );

  const dimensionOptions = useMemo(
    () =>
      applicableDimensions.map((dimension) => ({
        value: dimension.code,
        label: dimension.label || dimension.code,
      })),
    [applicableDimensions]
  );

  useEffect(() => {
    if (!datasetDetail || applicableDimensions.length === 0) {
      setSelectedDimension("");
      return;
    }
    setSelectedDimension((current) => {
      if (
        current &&
        applicableDimensions.some((dimension) => dimension.code === current)
      ) {
        return current;
      }
      const preferred = applicableDimensions.find(
        (dimension) => dimension.applicable_category_count > 1
      );
      return preferred?.code ?? applicableDimensions[0].code;
    });
  }, [datasetDetail, applicableDimensions]);

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
    if (!applicableDimensions.length) {
      return [];
    }
    // Filter out dimensions that should not be shown in filters
    // (e.g., the dimension being explored, or dimensions with only one category)
    return applicableDimensions.filter((dimension) => {
      if (dimension.code === selectedDimension) {
        return false; // Don't show the dimension we're exploring
      }
      if (dimension.applicable_category_count <= 1) {
        return false; // No point filtering on single-category dimensions
      }
      return true;
    });
  }, [applicableDimensions, selectedDimension]);

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
    if (!selectedDataset || !dimensionCode) {
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
    if (!datasetDetail || !selectedDimension) {
      return;
    }
    fetchDimensionCategories(selectedDimension);
  }, [datasetDetail, selectedDataset, selectedDimension, fetchDimensionCategories]);

  useEffect(() => {
    if (!selectedDataset || !datasetDetail || !selectedDimension) {
      return;
    }

    const fetchAggregates = async () => {
      try {
        setWidgetLoading(true);
        setWidgetError(null);

        const params = new URLSearchParams();
        params.set("dimension", selectedDimension);

        const hasTimeDimension = datasetDetail.dimensions.some(
          (dimension) => dimension.code === "TIME_PERIOD"
        );
        if (hasTimeDimension && activeInsights?.time_period) {
          params.set("TIME_PERIOD", activeInsights.time_period);
        }

        Object.entries(dimensionFilters).forEach(([dimensionCode, filterValue]) => {
          if (!filterValue || dimensionCode === selectedDimension) {
            return;
          }
          params.set(dimensionCode, filterValue);
        });

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
  }, [activeInsights?.time_period, datasetDetail, dimensionFilters, selectedDataset, selectedDimension]);

  const handleDimensionFilterChange = (dimensionCode: string, value: string) => {
    setDimensionFilters((prev) => ({ ...prev, [dimensionCode]: value }));
  };

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

  const heroStats = useMemo(() => {
    if (!activeInsights) {
      return [
        {
          id: "hero-seniors",
          label: "Population 65+",
          value: "--",
          context: "Select a dataset to view ageing insights",
        },
        {
          id: "hero-veryold",
          label: "Share aged 80+",
          value: "--",
          context: "Longevity signals appear here",
        },
        {
          id: "hero-dependency",
          label: "Old-age dependency",
          value: "--",
          context: "Compare pressure on workers",
        },
      ];
    }

    return [
      {
        id: "hero-seniors",
        label: "Population 65+",
        value: formatNumber(activeInsights.seniors_population),
        context: `${formatNumber(activeInsights.share_seniors, 1)}% of residents`,
      },
      {
        id: "hero-veryold",
        label: "Share aged 80+",
        value: `${formatNumber(activeInsights.share_80_plus, 1)}%`,
        context: "Growing longevity cohort",
      },
      {
        id: "hero-dependency",
        label: "Old-age dependency",
        value: formatNumber(activeInsights.old_age_dependency_ratio, 1),
        context: "Seniors per 100 workers",
      },
    ];
  }, [activeInsights]);

  const metrics = useMemo(
    () => {
      if (!activeInsights) {
        return [
          {
            id: "metric-seniors",
            title: "Residents aged 65+",
            value: "---",
            subtitle: "Load ageing summary to surface key indicators.",
          },
          {
            id: "metric-children",
            title: "Children 0-14",
            value: "---",
            subtitle: "Add a dataset to benchmark youth support.",
          },
          {
            id: "metric-veryold",
            title: "Share aged 80+",
            value: "---",
            subtitle: "Longevity cohort appears after data loads.",
          },
          {
            id: "metric-dependency",
            title: "Old-age dependency",
            value: "---",
            subtitle: "Compare seniors per 100 workers once data loads.",
          },
        ];
      }

      const seniorsPopulation = safeNumber(activeInsights.seniors_population);
      const childrenPopulation = safeNumber(activeInsights.children_population);
      const shareSeniors = clampShare(safeNumber(activeInsights.share_seniors));
      const shareChildren = clampShare(safeNumber(activeInsights.share_children));
      const shareVeryOld = clampShare(safeNumber(activeInsights.share_80_plus));
      const dependencyRatio = safeNumber(activeInsights.old_age_dependency_ratio);

      return [
        {
          id: "metric-seniors",
          title: "Residents aged 65+",
          value: formatNumber(seniorsPopulation),
          subtitle: `${shareSeniors.toFixed(1)}% of total population`,
        },
        {
          id: "metric-children",
          title: "Children 0-14",
          value: formatNumber(childrenPopulation),
          subtitle: `${shareChildren.toFixed(1)}% of residents`,
        },
        {
          id: "metric-veryold",
          title: "Share aged 80+",
          value: `${shareVeryOld.toFixed(1)}%`,
          subtitle: "Longevity pressure point",
        },
        {
          id: "metric-dependency",
          title: "Old-age dependency",
          value: formatNumber(dependencyRatio, 1),
          subtitle: "Seniors per 100 working-age residents",
        },
      ];
    },
    [activeInsights]
  );

  const populationBalance = useMemo(() => {
    if (!activeInsights) {
      return [
        {
          id: "children",
          label: "Children 0-14",
          share: 0,
          shareLabel: "--",
          color: "#0EA5E9",
          absoluteLabel: "-- residents",
          description:
            "Select a dataset to reveal the youth base supporting Luxembourg's future workforce.",
        },
        {
          id: "working",
          label: "Working age 15-64",
          share: 0,
          shareLabel: "--",
          color: "#4F46E5",
          absoluteLabel: "-- residents",
          description:
            "Active population insights appear once a dataset with ageing summary is selected.",
        },
        {
          id: "seniors",
          label: "Seniors 65+",
          share: 0,
          shareLabel: "--",
          color: "#F97316",
          absoluteLabel: "-- residents",
          description:
            "Reveal longevity dynamics by loading a dataset enriched with ageing signals.",
        },
      ];
    }

    const shareChildren = clampShare(safeNumber(activeInsights.share_children));
    const shareSeniors = clampShare(safeNumber(activeInsights.share_seniors));
    const totalPopulation = safeNumber(activeInsights.population_total);
    const workingPopulation = safeNumber(activeInsights.working_age_population);
    const workingShare = totalPopulation
      ? clampShare((workingPopulation / totalPopulation) * 100)
      : clampShare(100 - shareChildren - shareSeniors);
    const shareVeryOld = clampShare(safeNumber(activeInsights.share_80_plus));

    return [
      {
        id: "children",
        label: "Children 0-14",
        share: shareChildren,
        shareLabel: `${formatNumber(shareChildren, 1)}%`,
        color: "#0EA5E9",
        absoluteLabel: `${formatNumber(safeNumber(activeInsights.children_population))} residents`,
        description: "Future workforce pipeline keeping Luxembourg innovative.",
      },
      {
        id: "working",
        label: "Working age 15-64",
        share: workingShare,
        shareLabel: `${formatNumber(workingShare, 1)}%`,
        color: "#4F46E5",
        absoluteLabel: `${formatNumber(workingPopulation)} residents`,
        description: "Active contributors sustaining pensions, care and growth.",
      },
      {
        id: "seniors",
        label: "Seniors 65+",
        share: shareSeniors,
        shareLabel: `${formatNumber(shareSeniors, 1)}%`,
        color: "#F97316",
        absoluteLabel: `${formatNumber(safeNumber(activeInsights.seniors_population))} residents`,
        description: `${formatNumber(shareVeryOld, 1)}% are already 80+, raising longevity needs.`,
      },
    ];
  }, [activeInsights]);
  const readinessSignals = useMemo(() => {
    if (!activeInsights) {
      return [
        {
          id: "signal-pressure",
          status: "Ageing signal",
          title: "Dependency ratio outlook",
          body: "Choose a dataset to quantify how many seniors each worker supports.",
          variant: "neutral",
        },
        {
          id: "signal-longevity",
          status: "Longevity",
          title: "Healthy ageing preparedness",
          body: "Load life expectancy and healthy life years data to evidence long-term care needs.",
          variant: "neutral",
        },
        {
          id: "signal-youth",
          status: "Workforce",
          title: "Future workforce pipeline",
          body: "Bring in datasets to monitor education, migration and youth retention.",
          variant: "neutral",
        },
      ];
    }

    const dependency = safeNumber(activeInsights.old_age_dependency_ratio);
    const shareChildren = clampShare(safeNumber(activeInsights.share_children));
    const shareSeniors = clampShare(safeNumber(activeInsights.share_seniors));
    const shareVeryOld = clampShare(safeNumber(activeInsights.share_80_plus));
    const totalPopulation = safeNumber(activeInsights.population_total);
    const workingPopulation = safeNumber(activeInsights.working_age_population);
    const workingShare = totalPopulation
      ? clampShare((workingPopulation / totalPopulation) * 100)
      : clampShare(100 - shareChildren - shareSeniors);

    const dependencyVariant = dependency >= 55 ? "critical" : dependency >= 40 ? "alert" : "balanced";
    const dependencyStatus =
      dependencyVariant === "critical"
        ? "High pressure"
        : dependencyVariant === "alert"
        ? "Watch closely"
        : "Stable support";

    const longevityVariant = shareVeryOld >= 10 ? "critical" : shareVeryOld >= 8 ? "alert" : "balanced";
    const longevityStatus =
      longevityVariant === "critical"
        ? "Accelerating longevity"
        : longevityVariant === "alert"
        ? "Steady growth"
        : "Emerging cohort";

    const youthVariant = shareChildren <= 16 ? "alert" : "balanced";
    const youthStatus = youthVariant === "alert" ? "Shrinking youth base" : "Resilient pipeline";

    return [
      {
        id: "signal-pressure",
        status: dependencyStatus,
        title: "Dependency ratio outlook",
        body: `Every 100 workers support ${formatNumber(dependency, 1)} seniors. Prioritise workforce participation and inclusive pension measures.`,
        variant: dependencyVariant,
      },
      {
        id: "signal-longevity",
        status: longevityStatus,
        title: "Longevity preparedness",
        body: `${formatNumber(shareVeryOld, 1)}% of residents are 80+. Plan health, care and housing services that match rising longevity.`,
        variant: longevityVariant,
      },
      {
        id: "signal-youth",
        status: youthStatus,
        title: "Future workforce pipeline",
        body: `${formatNumber(shareChildren, 1)}% of residents are children while ${formatNumber(workingShare, 1)}% are of working age. Blend education, skills and migration levers to keep the support ratio sustainable.`,
        variant: youthVariant,
      },
    ];
  }, [activeInsights]);

  const actionPlaybook = useMemo(() => {
    const datasetLabel =
      datasets.find((dataset) => dataset.code === selectedDataset)?.name ??
      selectedDataset ??
      "Selected dataset";
    const dimensionLabel =
      dimensionOptions.find((option) => option.value === selectedDimension)?.label ??
      (selectedDimension ? selectedDimension : "any dimension");

    if (!activeInsights) {
      return [
        {
          id: "action-load",
          title: "Load ageing evidence",
          summary:
            "Select a dataset with ageing insights to surface personalised hackathon recommendations.",
          actions: [
            "Start with the census age pyramid dataset to explore the baseline.",
            "Use the filters to compare communes, sexes or age brackets.",
            "Pin insights that resonate with demographic, economic and wellbeing angles.",
          ],
        },
        {
          id: "action-theme",
          title: "Shape the narrative",
          summary:
            "Align the hero copy, highlights and storytelling cards with the Ageing Luxembourg pillars.",
          actions: [
            "Explain demographic change, economic impact, health capacity and social inclusion.",
            "List additional datasets (life expectancy, employment 55+, care beds) you intend to blend.",
            "Sketch the user journey from overview to actionable insight builder.",
          ],
        },
        {
          id: "action-demo",
          title: "Prepare the live demo",
          summary:
            "Plan how you will navigate the dashboard during judging to highlight the most compelling visuals.",
          actions: [
            "Practice switching filters quickly to answer jury questions.",
            "Capture screenshots for a backup slide deck.",
            "Note API endpoints that enable future extensions (dependency, employment, health).",
          ],
        },
      ];
    }

    const shareSeniors = formatNumber(clampShare(safeNumber(activeInsights.share_seniors)), 1);
    const dependency = formatNumber(safeNumber(activeInsights.old_age_dependency_ratio), 1);
    const shareVeryOld = formatNumber(clampShare(safeNumber(activeInsights.share_80_plus)), 1);
    const seniorsPopulation = formatNumber(safeNumber(activeInsights.seniors_population));
    const censusYear = activeInsights.time_period;

    return [
      {
        id: "action-territories",
        title: "Target priority territories",
        summary: `Use ${datasetLabel} with the ${dimensionLabel} lens to surface communes where seniors concentrate.`,
        actions: [
          `Filter the insight builder to highlight communes above ${shareSeniors}% seniors (${seniorsPopulation} people).`,
          "Capture the map view and annotate high-pressure cantons for your pitch deck.",
          "Layer poverty or healthcare datasets from LUSTAT to build integrated interventions.",
        ],
      },
      {
        id: "action-economy",
        title: "Frame the economic storyline",
        summary: `Link the ${dependency} dependency ratio with employment indicators to discuss inclusive growth.`,
        actions: [
          "Combine Eurostat labour market data (55–64 employment) with census structure in a dual-axis chart.",
          "Quantify productivity gains from extending working lives or targeted migration.",
          "Use storytelling cards to explain how each scenario reduces dependency pressure.",
        ],
      },
      {
        id: "action-care",
        title: "Build a healthy longevity narrative",
        summary: `${shareVeryOld}% of residents are already 80+. Align care capacity and age-friendly services.`,
        actions: [
          "Blend healthy life years or care beds datasets to evidence health infrastructure gaps.",
          `Show trend text in the storytelling panel referencing census ${censusYear} to keep the narrative current.`,
          "Design a KPI card for healthy ageing outcomes and link to recommended policy pilots.",
        ],
      },
    ];
  }, [activeInsights, datasets, selectedDataset, dimensionOptions, selectedDimension]);

  const focusCards = useMemo(
    () =>
      activeInsights
        ? [
            {
              id: "focus-demography",
              eyebrow: "Demographic structure",
              title: "Seniors are the fastest growing group",
              description:
                "Track how the share of older residents evolves across communes and age brackets to anticipate infrastructure needs.",
              figure: `${formatNumber(activeInsights.share_seniors, 1)}%`,
              footer: "of Luxembourg's population is already aged 65+",
            },
            {
              id: "focus-economy",
              eyebrow: "Economic pressure",
              title: "Dependency ratios keep climbing",
              description:
                "Assess the balance between the working-age population and seniors to understand labour market and pension pressure.",
              figure: formatNumber(activeInsights.old_age_dependency_ratio, 1),
              footer: "seniors for every 100 people aged 15–64",
            },
            {
              id: "focus-longevity",
              eyebrow: "Longevity",
              title: "An expanding 80+ cohort",
              description:
                "Analyse longevity by sex and region to align healthcare and long-term care services with the ageing population.",
              figure: `${formatNumber(activeInsights.share_80_plus, 1)}%`,
              footer: "of residents have already celebrated their 80th birthday",
            },
            {
              id: "focus-inclusion",
              eyebrow: "Active ageing",
              title: "Highlight employment and wellbeing",
              description:
                "Combine labour participation, healthy life years and poverty indicators to spot gaps in inclusive ageing.",
              figure: activeInsights.time_period,
              footer: "Latest census vintage feeding the dashboard",
            },
          ]
        : [
            {
              id: "focus-demography",
              eyebrow: "Demographic structure",
              title: "Investigate the ageing curve",
              description:
                "Choose a dataset to reveal how age groups are distributed across Luxembourg's communes and districts.",
              figure: "—",
              footer: "Age pyramid insight",
            },
            {
              id: "focus-economy",
              eyebrow: "Economic pressure",
              title: "Quantify the support ratio",
              description:
                "Use the dependency ratio datasets to estimate the demand on the active labour force.",
              figure: "—",
              footer: "Seniors per 100 workers",
            },
            {
              id: "focus-longevity",
              eyebrow: "Longevity",
              title: "Life expectancy lens",
              description:
                "Blend life expectancy and healthy life year data for a qualitative view on ageing.",
              figure: "—",
              footer: "Healthy ageing baseline",
            },
            {
              id: "focus-inclusion",
              eyebrow: "Active ageing",
              title: "Spot inequalities",
              description:
                "Investigate poverty and employment among seniors to highlight inclusive policy levers.",
              figure: "—",
              footer: "Social resilience angle",
            },
          ],
    [activeInsights]
  );

  const storyCards = useMemo(
    () =>
      [
        {
          id: "story-demography",
          title: "Demography",
          body:
            "Compare population pyramids and year-on-year growth to see how Luxembourg's communes are ageing at different speeds.",
        },
        {
          id: "story-economy",
          title: "Economy & labour",
          body:
            "Cross dependency ratios with 55–64 employment data to monitor how well older workers remain active in the labour market.",
        },
        {
          id: "story-health",
          title: "Health & care",
          body:
            "Follow longevity and healthy life years indicators to align healthcare capacity and long-term care beds with local needs.",
        },
        {
          id: "story-social",
          title: "Social cohesion",
          body:
            "Overlay poverty-at-risk and social participation metrics to surface communities needing additional support.",
        },
      ],
    []
  );

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
    if (!selectedDimension) {
      return valueType === "share" ? "Percentage share" : "Population count";
    }
    const option = dimensionOptions.find((entry) => entry.value === selectedDimension);
    const label = option?.label ?? selectedDimension;
    const metricLabel = valueType === "share" ? "percentage share" : "population count";
    return `${label} - ${metricLabel}`;
  }, [dimensionOptions, selectedDimension, valueType]);

  const handleFetchObservations = async () => {
    if (!selectedDataset) {
      return;
    }
    if (applicableDimensions.length > 0) {
      await Promise.all(
        applicableDimensions.map((dimension) => fetchDimensionCategories(dimension.code))
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

  const styles = useMemo(
    () => (stylesData.styles ?? []) as StyleData[],
    []
  );
  const pageStyle: React.CSSProperties = useMemo(() => {
    if (!page) {
      return { width: "100%" };
    }

    const computed = {
      ...(applyStyle(`#${page.id}`, styles) ?? {}),
    } as Record<string, any>;

    [
      "padding",
      "paddingLeft",
      "paddingRight",
      "paddingTop",
      "paddingBottom",
      "margin",
      "marginLeft",
      "marginRight",
      "marginTop",
      "marginBottom",
      "display",
      "flex",
      "flexDirection",
      "flexWrap",
      "justifyContent",
      "alignItems",
      "alignContent",
      "gap",
      "rowGap",
      "columnGap",
      "width",
    ].forEach((prop) => {
      if (prop in computed) {
        delete computed[prop];
      }
    });

    return {
      width: "100%",
      ...(computed as React.CSSProperties),
    };
  }, [page, styles]);

  const generatedComponents = useMemo(
    () =>
      page
        ? (page.components ?? []).filter(
            (component: any) => !["hero-section", "headline-metrics"].includes(component.id)
          )
        : [],
    [page]
  );

  return (
    <div className="page">
      <section className="hero">
        <div className="hero__content">
          <span className="hero__eyebrow">Ageing Luxembourg</span>
          <h1>Evidence hub for Luxembourg&apos;s demographic transition</h1>
          <p>
            Explore how population structure, dependency ratios and quality-of-life indicators evolve across regions. Combine
            census and Eurostat feeds to build policy-ready insights that keep Luxembourg inclusive for all generations.
          </p>
          <button
            className="hero__cta"
            type="button"
            onClick={() => {
              const playground = document.querySelector(".playground");
              playground?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            Jump to insight builder
          </button>
        </div>
        <div className="hero__stats">
          {heroStats.map((item) => (
            <div key={item.id} className="hero__stat">
              <span className="hero__stat-label">{item.label}</span>
              <strong className="hero__stat-value">{item.value}</strong>
              <span className="hero__stat-context">{item.context}</span>
            </div>
          ))}
        </div>
      </section>

      <div
        className="page__generated"
        id={page?.id ?? "generated-layout"}
        style={pageStyle}
      >
        {page ? (
          generatedComponents.map((component: any) => (
            <Renderer key={component.id} component={component} styles={styles} />
          ))
        ) : (
          <div className="page--error">No screens defined in the generated GUI model.</div>
        )}
      </div>

      {highlightInsights.length > 0 && (
        <section className="insight-highlights">
          <h2>Ageing signals at a glance</h2>
          <ul>
            {highlightInsights.map((item, index) => (
              <li key={`highlight-${index}`}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="metrics-section">
        <div className="metrics-section__header">
          <h2>Key indicators</h2>
          <p>Use the highlights below to benchmark senior population, longevity and dependency pressure.</p>
        </div>
        <div className="metrics-grid">
          {metrics.map((metric) => (
            <StatCardComponent
              key={metric.id}
              id={metric.id}
              title={metric.title}
              value={metric.value}
              subtitle={metric.subtitle}
            />
          ))}
        </div>
      </section>

      <section className="population-structure">
        <div className="population-structure__header">
          <h2>Population structure insight</h2>
          <p>
            Balance Luxembourg&apos;s demographic pyramid by monitoring how children, workers and seniors share the population. Use
            these signals to prioritise policy levers for the Ageing Luxembourg challenge.
          </p>
        </div>
        <div className="population-structure__bars" role="list">
          {populationBalance.map((segment) => (
            <div key={segment.id} className="population-structure__item" role="listitem">
              <div className="population-structure__item-header">
                <span className="population-structure__item-label">{segment.label}</span>
                <span className="population-structure__item-value">{segment.shareLabel}</span>
              </div>
              <div
                className="population-structure__bar"
                role="progressbar"
                aria-valuenow={Math.round(segment.share)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="population-structure__bar-fill"
                  style={{
                    width: `${Math.min(100, Math.max(0, segment.share))}%`,
                    backgroundColor: segment.color,
                  }}
                />
              </div>
              <div className="population-structure__item-meta">
                <span>{segment.absoluteLabel}</span>
                <span>{segment.description}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="population-structure__signals">
          {readinessSignals.map((signal) => (
            <article
              key={signal.id}
              className={`population-structure__signal population-structure__signal--${signal.variant}`}
            >
              <span className="population-structure__signal-status">{signal.status}</span>
              <h3>{signal.title}</h3>
              <p>{signal.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="focus-grid">
        {focusCards.map((card) => (
          <article key={card.id} className="focus-card">
            <span className="focus-card__eyebrow">{card.eyebrow}</span>
            <h3>{card.title}</h3>
            <p>{card.description}</p>
            <div className="focus-card__figure">{card.figure}</div>
            <span className="focus-card__footer">{card.footer}</span>
          </article>
        ))}
      </section>

      <section className="map-section">
        <div className="map-section__header">
          <h2>Luxembourg communes spotlight</h2>
          <p>
            Switch between datasets to colour the map by dependency ratios, senior share or health outcomes. The map pairs with
            the filters below so you can zoom into urban and rural contrasts.
          </p>
        </div>
        <div className="map-section__controls">
          <div className="map-section__control">
            <label htmlFor="map-breakdown-select">Dataset breakdown</label>
            <select
              id="map-breakdown-select"
              value={mapBreakdown}
              onChange={(event) => setMapBreakdown(event.target.value)}
            >
              {MAP_BREAKDOWN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="map-section__control">
            <label htmlFor="map-marital-select">Marital status</label>
            <select
              id="map-marital-select"
              value={mapMarital}
              onChange={(event) => setMapMarital(event.target.value)}
            >
              {MAP_MARITAL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="map-section__control">
            <label htmlFor="map-sex-select">Sex</label>
            <select
              id="map-sex-select"
              value={mapSex}
              onChange={(event) => setMapSex(event.target.value)}
            >
              {MAP_SEX_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="map-section__canvas">
          <MapComponent breakdown={mapBreakdown} marital={mapMarital} sex={mapSex} />
        </div>
      </section>

      <section className="story-grid">
        <h2>Storylines for policy teams</h2>
        <div className="story-grid__cards">
          {storyCards.map((card) => (
            <article key={card.id} className="story-card">
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="action-board">
        <div className="action-board__header">
          <h2>Hackathon action board</h2>
          <p>
            Translate insights into winning moves. These playbook cards help you turn data stories into a compelling
            Ageing Luxembourg pitch.
          </p>
        </div>
        <div className="action-board__grid">
          {actionPlaybook.map((item) => (
            <article key={item.id} className="action-card">
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
              <ul>
                {item.actions.map((action, index) => (
                  <li key={`${item.id}-action-${index}`}>{action}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
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
              onChange={(event) => setSelectedDimension(event.target.value)}
              disabled={dimensionOptions.length === 0}
            >
              {dimensionOptions.length === 0 ? (
                <option value="">No dimensions available</option>
              ) : (
                dimensionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))
              )}
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
