import React, { CSSProperties } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
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

const defaultPalette = ["#5850EC", "#0EA5E9", "#10B981", "#F97316", "#F43F5E"];

export const PieChartComponent: React.FC<Props> = ({
  id,
  title,
  color,
  data,
  labelField,
  dataField,
  options,
  styles,
}) => {
  const palette =
    options?.colorPalette ||
    (styles && (styles as any)["--chart-color-palette"]) ||
    options?.palette ||
    defaultPalette;

  const pieColors = Array.isArray(palette) ? palette : [palette];
  if (color && pieColors.length === 1) {
    pieColors[0] = color;
  }

  const showLegend = options?.showLegend ?? true;
  const showTooltip = options?.showTooltip ?? true;
  const showLabels = options?.showLabels ?? true;

  const containerStyle: CSSProperties = {
    width: "100%",
    minHeight: "320px",
    marginBottom: "20px",
    ...styles,
  };

  return (
    <div id={id} style={containerStyle}>
      {title && <h3 style={{ textAlign: "center" }}>{title}</h3>}
      <ResponsiveContainer width="100%" height="80%">
        <PieChart margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <Pie
            data={data}
            dataKey={dataField}
            nameKey={labelField}
            innerRadius={options?.innerRadius}
            outerRadius={options?.outerRadius || 120}
            paddingAngle={options?.paddingAngle || 0}
            startAngle={options?.startAngle || 0}
            endAngle={options?.endAngle || 360}
            label={showLabels}
            labelLine={showLabels}
          >
            {data.map((entry, index) => (
              <Cell
                key={`${id}-slice-${index}`}
                fill={pieColors[index % pieColors.length]}
              />
            ))}
          </Pie>
          {showTooltip && <Tooltip />}
          {showLegend && <Legend />}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
