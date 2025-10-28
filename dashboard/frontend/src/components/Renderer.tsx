import React, { CSSProperties, useEffect, useState } from "react";
import axios from "axios";

import { Wrapper } from "./Wrapper";
import { TextComponent } from "./TextComponent";
import { LineChartComponent } from "./charts/LineChartComponent";
import { BarChartComponent } from "./charts/BarChartComponent";
import { PieChartComponent } from "./charts/PieChartComponent";
import { RadarChartComponent } from "./charts/RadarChartComponent";
import { RadialBarChartComponent } from "./charts/RadialBarChartComponent";
import { StatCardComponent } from "./StatCardComponent";

import { applyStyle, StyleData } from "../utils/applyStyle";

export interface DataBindingConfig {
  endpoint?: string;
  entity?: string;
  label_field?: string;
  data_field?: string;
  code_field?: string;
  omit_codes?: string[];
  top_n?: number;
}

export interface RendererProps {
  component: any;
  styles: StyleData[];
}

type ChartType =
  | "line-chart"
  | "bar-chart"
  | "pie-chart"
  | "radar-chart"
  | "radial-bar-chart";

const chartComponents: Record<ChartType, React.ComponentType<any>> = {
  "line-chart": LineChartComponent,
  "bar-chart": BarChartComponent,
  "pie-chart": PieChartComponent,
  "radar-chart": RadarChartComponent,
  "radial-bar-chart": RadialBarChartComponent,
};

const resolveEndpoint = (binding?: DataBindingConfig): string | null => {
  if (!binding?.endpoint) return null;
  if (binding.endpoint.startsWith("http")) {
    return binding.endpoint;
  }
  const base =
    (process.env.REACT_APP_BACKEND_URL as string | undefined) ||
    "http://localhost:8000";
  return `${base.replace(/\/$/, "")}${binding.endpoint}`;
};

const extractDataRows = (payload: any, entity?: string): any[] => {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (entity && payload) {
    const key = entity.toLowerCase();
    const scoped = payload[key];
    if (Array.isArray(scoped)) {
      return scoped;
    }
    if (scoped) {
      return Array.isArray(scoped) ? scoped : [scoped];
    }
  }
  if (payload?.results && Array.isArray(payload.results)) {
    return payload.results;
  }
  return [];
};

const getNestedValue = (source: any, path?: string): any => {
  if (!source || !path) {
    return undefined;
  }
  return path.split(".").reduce((acc: any, key: string) => {
    if (acc === null || acc === undefined) {
      return undefined;
    }
    return acc[key];
  }, source);
};

const applyBindingTransforms = (
  rows: any[],
  binding?: DataBindingConfig
): any[] => {
  if (!binding) {
    return rows;
  }

  let result = Array.isArray(rows) ? [...rows] : [];

  if (binding.code_field && binding.omit_codes?.length) {
    const omitSet = new Set(binding.omit_codes);
    result = result.filter(
      (row) => !omitSet.has(getNestedValue(row, binding.code_field))
    );
  }

  if (binding.top_n && Number.isFinite(binding.top_n)) {
    result = result.slice(0, binding.top_n);
  }

  return result;
};

const formatNumericValue = (
  value: number,
  format: string | undefined,
  decimals?: number
): string => {
  const formatter = Intl.NumberFormat("en-GB", {
    maximumFractionDigits: decimals ?? (format === "decimal" ? 1 : 0),
    minimumFractionDigits:
      format === "decimal" || format === "percent"
        ? decimals ?? 1
        : undefined,
  });

  if (format === "percent") {
    return `${formatter.format(value)}%`;
  }
  return formatter.format(value);
};

export const Renderer: React.FC<RendererProps> = ({ component, styles }) => {
  const binding: DataBindingConfig | undefined = component.data_binding;
  const style = applyStyle(
    `#${component.id}`,
    styles
  ) as CSSProperties;

  const [fetchedData, setFetchedData] = useState<any[]>([]);
  const [rawPayload, setRawPayload] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const needsBinding = Boolean(binding?.endpoint);
    if (!needsBinding) {
      setFetchedData([]);
      setRawPayload(null);
      setLoading(false);
      setError(null);
      return;
    }
    const endpoint = resolveEndpoint(binding);
    if (!endpoint) {
      setFetchedData([]);
      setRawPayload(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    axios
      .get(endpoint)
      .then((response) => {
        if (cancelled) {
          return;
        }
        setRawPayload(response.data);
        const rows = extractDataRows(response.data, binding?.entity);
        const transformed = applyBindingTransforms(rows, binding);
        setFetchedData(transformed);
      })
      .catch((err) => {
        console.error("Failed to fetch chart data", err);
        if (!cancelled) {
          setError("Unable to load data");
          setFetchedData([]);
        }
      })
      .finally(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [component.id, binding]);

  if (component.type === "container" || component.type === "wrapper") {
    return (
      <Wrapper
        id={component.id}
        components={component.children}
        styles={styles}
      />
    );
  }

  if (component.type === "text") {
    return (
      <TextComponent
        id={component.id}
        content={component.content || ""}
        styles={styles}
        tag={component.tag}
      />
    );
  }

  if (component.type === "button") {
    const handleClick = () => {
      const transitions =
        component.events?.flatMap((evt: any) => evt.actions || []) || [];
      const navigation = transitions.find(
        (action: any) => action.kind === "Transition"
      );
      if (navigation?.target_screen) {
        console.info(
          `Navigate to screen: ${navigation.target_screen} (navigation wiring pending)`
        );
      }
    };

    return (
      <button id={component.id} style={style} onClick={handleClick}>
        {component.label || component.name || "Button"}
      </button>
    );
  }

  if (component.type === "input") {
    return (
      <input
        id={component.id}
        style={style}
        placeholder={component.name}
        type={(component.input_type || "text").toString()}
      />
    );
  }

  if (component.type === "menu") {
    return (
      <nav id={component.id} style={style}>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {(component.items ?? []).map((item: any, index: number) => {
            const label = item?.label || item?.url || `item-${index}`;
            if (item?.url) {
              return (
                <li key={`${label}-${index}`}>
                  <a href={item.url} target={item.target || undefined} rel={item.rel || undefined}>
                    {item.label || item.url}
                  </a>
                </li>
              );
            }
            return <li key={`${label}-${index}`}>{label}</li>;
          })}
        </ul>
      </nav>
    );
  }

  if (component.type === "data-list") {
    return (
      <div id={component.id} style={style}>
        <strong>{component.name || "List"}</strong>
        <pre style={{ whiteSpace: "pre-wrap" }}>
          {JSON.stringify(component.data_sources ?? [], null, 2)}
        </pre>
      </div>
    );
  }

  if (component.type === "stat-card") {
    if (binding?.endpoint) {
      if (loading) {
        return <div id={component.id}>Loading metric…</div>;
      }
      if (error) {
        return <div id={component.id}>{error}</div>;
      }
    }

    const statConfig = component.stat || {};
    let rowsForStat = fetchedData;

    if (
      statConfig.match_field &&
      statConfig.match_value !== undefined &&
      statConfig.match_value !== null
    ) {
      rowsForStat = rowsForStat.filter(
        (row) =>
          getNestedValue(row, statConfig.match_field) ===
          statConfig.match_value
      );
    }

    if (statConfig.top_n && Number.isFinite(statConfig.top_n)) {
      rowsForStat = rowsForStat.slice(0, statConfig.top_n);
    }

    const itemIndex =
      Number.isInteger(statConfig.item_index) && statConfig.item_index >= 0
        ? statConfig.item_index
        : 0;

    let selectedItem =
      rowsForStat[itemIndex] ?? rowsForStat[0] ?? fetchedData[0] ?? null;

    if (!selectedItem && rawPayload) {
      selectedItem = rawPayload;
    }

    const valueField =
      statConfig.value_field ||
      binding?.data_field ||
      binding?.label_field ||
      "value";
    const rawValue =
      selectedItem !== null && selectedItem !== undefined
        ? getNestedValue(selectedItem, valueField)
        : statConfig.fallback_value;

    let formattedValue = "—";
    if (rawValue !== undefined && rawValue !== null) {
      if (typeof rawValue === "number") {
        formattedValue = formatNumericValue(
          rawValue,
          statConfig.value_format,
          statConfig.decimals
        );
      } else if (!Number.isNaN(Number(rawValue))) {
        formattedValue = formatNumericValue(
          Number(rawValue),
          statConfig.value_format,
          statConfig.decimals
        );
      } else {
        formattedValue = String(rawValue);
      }
    }

    if (statConfig.value_suffix) {
      formattedValue = `${formattedValue}${statConfig.value_suffix}`;
    }

    let subtitle: string | undefined =
      component.subtitle || statConfig.subtitle_text;
    if (statConfig.subtitle_field) {
      const subtitleSource =
        (statConfig.subtitle_source === "payload" ? rawPayload : selectedItem) ??
        selectedItem;
      const rawSubtitle = getNestedValue(
        subtitleSource,
        statConfig.subtitle_field
      );
      if (rawSubtitle !== undefined && rawSubtitle !== null) {
        if (
          statConfig.subtitle_format === "date" ||
          statConfig.subtitle_format === "datetime"
        ) {
          const parsed = new Date(rawSubtitle);
          if (!Number.isNaN(parsed.getTime())) {
            subtitle =
              statConfig.subtitle_format === "date"
                ? parsed.toLocaleDateString()
                : parsed.toLocaleString();
          } else {
            subtitle = String(rawSubtitle);
          }
        } else {
          subtitle = String(rawSubtitle);
        }
      }
    }

    return (
      <StatCardComponent
        id={component.id}
        title={component.title || component.name}
        value={formattedValue}
        subtitle={subtitle}
        styles={style}
      />
    );
  }

  const ChartComponent = chartComponents[component.type as ChartType];
  if (ChartComponent) {
    const labelField = binding?.label_field || "label";
    const dataField = binding?.data_field || "value";

    if (loading) {
      return <div id={component.id}>Loading data...</div>;
    }
    if (error) {
      return <div id={component.id}>{error}</div>;
    }

    return (
      <ChartComponent
        id={component.id}
        title={component.title || component.name}
        color={component.color}
        data={fetchedData}
        labelField={labelField}
        dataField={dataField}
        options={component.chart || {}}
        styles={style}
      />
    );
  }

  if (component.type === "image") {
    return (
      <img
        id={component.id}
        style={style}
        src={component.src}
        alt={component.alt || component.name || "Image"}
      />
    );
  }

  if (component.type === "link") {
    return (
      <a
        id={component.id}
        style={style}
        href={component.url || "#"}
        target={component.target || undefined}
        rel={component.rel || undefined}
      >
        {component.label || component.name || component.url || "Link"}
      </a>
    );
  }

  if (component.type === "embedded-content") {
    return (
      <iframe
        id={component.id}
        style={style}
        src={component.src}
        title={component.alt || component.name || "Embedded content"}
      />
    );
  }

  return (
    <div id={component.id} style={style}>
      <strong>{component.name || component.type}</strong>
      <pre style={{ whiteSpace: "pre-wrap" }}>
        {JSON.stringify(component, null, 2)}
      </pre>
    </div>
  );
};
