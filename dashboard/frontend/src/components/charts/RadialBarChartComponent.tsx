import React, { CSSProperties } from "react";
import {
  Legend,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
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

const resolveFill = (
  explicit?: string,
  options?: Record<string, any>,
  styles?: CSSProperties
) =>
  explicit ||
  options?.barColor ||
  (styles && (styles as any)["--chart-bar-color"]) ||
  "#EC4899";

export const RadialBarChartComponent: React.FC<Props> = ({
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

  const showLegend = options?.showLegend ?? true;
  const showTooltip = options?.showTooltip ?? true;

  return (
    <div id={id} style={containerStyle}>
      {title && <h3 style={{ textAlign: "center" }}>{title}</h3>}
      <ResponsiveContainer width="100%" height="80%">
        <RadialBarChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          innerRadius={options?.innerRadius || 20}
          outerRadius={options?.outerRadius || 140}
          startAngle={options?.startAngle || 0}
          endAngle={options?.endAngle || 360}
        >
          <PolarAngleAxis dataKey={labelField} />
          <RadialBar
            background
            dataKey={dataField}
            fill={resolveFill(color, options, styles)}
          />
          {showTooltip && <Tooltip />}
          {showLegend && <Legend verticalAlign={options?.legendPosition || "bottom"} />}
        </RadialBarChart>
      </ResponsiveContainer>
    </div>
  );
};