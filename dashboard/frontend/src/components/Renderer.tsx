import React, { CSSProperties, useEffect, useState } from "react";
import axios from "axios";

import { Wrapper } from "./Wrapper";
import { TextComponent } from "./TextComponent";
import { LineChartComponent } from "./charts/LineChartComponent";
import { BarChartComponent } from "./charts/BarChartComponent";
import { PieChartComponent } from "./charts/PieChartComponent";
import { RadarChartComponent } from "./charts/RadarChartComponent";
import { RadialBarChartComponent } from "./charts/RadialBarChartComponent";

import { applyStyle, StyleData } from "../utils/applyStyle";

export interface DataBindingConfig {
  endpoint?: string;
  entity?: string;
  label_field?: string;
  data_field?: string;
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

export const Renderer: React.FC<RendererProps> = ({ component, styles }) => {
  const binding: DataBindingConfig | undefined = component.data_binding;
  const style = applyStyle(
    `#${component.id}`,
    styles
  ) as CSSProperties;

  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const chartTypes: ChartType[] = [
      "line-chart",
      "bar-chart",
      "pie-chart",
      "radar-chart",
      "radial-bar-chart",
    ];
    if (!chartTypes.includes(component.type as ChartType)) {
      return;
    }
    const endpoint = resolveEndpoint(binding);
    if (!endpoint) {
      setChartData([]);
      return;
    }

    setLoading(true);
    setError(null);
    axios
      .get(endpoint)
      .then((response) => {
        const rows = extractDataRows(response.data, binding?.entity);
        setChartData(rows);
      })
      .catch((err) => {
        console.error("Failed to fetch chart data", err);
        setError("Unable to load chart data");
        setChartData([]);
      })
      .finally(() => setLoading(false));
  }, [component.id, component.type, binding]);

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
        data={chartData}
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