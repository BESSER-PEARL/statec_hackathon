import React, { CSSProperties } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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
) => {
  return (
    explicit ||
    options?.lineColor ||
    (styles && (styles as any)["--chart-line-color"]) ||
    "#4a90e2"
  );
};

export const LineChartComponent: React.FC<Props> = ({
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

  const strokeWidth = options?.lineWidth ?? 2;
  const resolvedColor = resolveColor(color, options, styles);
  const showGrid = options?.showGrid ?? true;
  const showLegend = options?.showLegend ?? true;
  const showTooltip = options?.showTooltip ?? true;
  const legendPosition = options?.legendPosition || "top";

  return (
    <div id={id} style={containerStyle}>
      {title && <h3 style={{ textAlign: "center" }}>{title}</h3>}
      <ResponsiveContainer width="100%" height="80%">
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={options?.gridColor} />}
          <XAxis dataKey={labelField} />
          <YAxis />
          {showTooltip && <Tooltip />}
          {showLegend && <Legend verticalAlign={legendPosition} />}
          <Line
            type={options?.curveType || "monotone"}
            dataKey={dataField}
            stroke={resolvedColor}
            strokeWidth={strokeWidth}
            dot={options?.dotSize ? { r: options.dotSize } : true}
            isAnimationActive={options?.animate ?? true}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};