import React, { CSSProperties } from "react";
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

const resolveColor = (
  explicit?: string,
  options?: Record<string, any>,
  styles?: CSSProperties
) =>
  explicit ||
  options?.barColor ||
  (styles && (styles as any)["--chart-bar-color"]) ||
  "#7f56d9";

export const BarChartComponent: React.FC<Props> = ({
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

  const orientation = options?.orientation || "vertical";
  const showGrid = options?.showGrid ?? true;
  const showLegend = options?.showLegend ?? true;
  const showTooltip = options?.showTooltip ?? true;
  const legendPosition = options?.legendPosition || "top";
  const resolvedColor = resolveColor(color, options, styles);

  return (
    <div id={id} style={containerStyle}>
      {title && <h3 style={{ textAlign: "center" }}>{title}</h3>}
      <ResponsiveContainer width="100%" height="80%">
        <BarChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          layout={orientation === "horizontal" ? "vertical" : "horizontal"}
          barSize={options?.barWidth}
          barCategoryGap={options?.barGap}
        >
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" stroke={options?.gridColor} />
          )}
          <XAxis
            type={orientation === "horizontal" ? "number" : "category"}
            dataKey={orientation === "horizontal" ? dataField : labelField}
          />
          <YAxis
            type={orientation === "horizontal" ? "category" : "number"}
            dataKey={orientation === "horizontal" ? labelField : undefined}
          />
          {showTooltip && <Tooltip />}
          {showLegend && <Legend verticalAlign={legendPosition} />}
          <Bar
            dataKey={dataField}
            fill={resolvedColor}
            stackId={options?.stacked ? "stack" : undefined}
            isAnimationActive={options?.animate ?? true}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};