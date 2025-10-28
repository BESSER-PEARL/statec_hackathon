import React, { CSSProperties } from "react";
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface Props {
  id: string;
  title?: string;
  color?: string;
  data: any[];
  labelField: string;
  dataField: string;
  options?: Record<string, any>;
  styles?: CSSProperties;
}

const pickColor = (
  explicit?: string,
  options?: Record<string, any>,
  styles?: CSSProperties
) =>
  explicit ||
  options?.lineColor ||
  (styles && (styles as any)["--chart-line-color"]) ||
  "#0EA5E9";

export const RadarChartComponent: React.FC<Props> = ({
  id,
  title,
  color,
  data,
  labelField,
  dataField,
  options,
  styles,
}) => {
  const containerStyle: CSSProperties = {
    width: "100%",
    minHeight: "320px",
    marginBottom: "20px",
    ...styles,
  };

  const showGrid = options?.showGrid ?? true;
  const showTooltip = options?.showTooltip ?? true;
  const showLegend = options?.showLegend ?? true;
  const showRadiusAxis = options?.showRadiusAxis ?? true;

  return (
    <div id={id} style={containerStyle}>
      {title && <h3 style={{ textAlign: "center" }}>{title}</h3>}
      <ResponsiveContainer width="100%" height="80%">
        <RadarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          {showGrid && <PolarGrid gridType={options?.gridType || "polygon"} />}
          <PolarAngleAxis dataKey={labelField} />
          {showRadiusAxis && <PolarRadiusAxis />}
          {showTooltip && <Tooltip />}
          {showLegend && <Legend />}
          <Radar
            name={title || dataField}
            dataKey={dataField}
            stroke={pickColor(color, options, styles)}
            fill={pickColor(color, options, styles)}
            fillOpacity={0.35}
            dot={{ r: options?.dotSize || 3 }}
            strokeWidth={options?.strokeWidth || 2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};