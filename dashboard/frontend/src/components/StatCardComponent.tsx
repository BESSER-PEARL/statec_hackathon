import React, { CSSProperties } from "react";

interface StatCardComponentProps {
  id: string;
  title?: string;
  value: string;
  subtitle?: string;
  styles?: CSSProperties;
}

export const StatCardComponent: React.FC<StatCardComponentProps> = ({
  id,
  title,
  value,
  subtitle,
  styles,
}) => {
  const baseStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    gap: "0.75rem",
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    padding: "1.5rem",
    boxShadow: "0 18px 28px rgba(15, 23, 42, 0.08)",
    minHeight: "150px",
  };

  const mergedStyle = {
    ...baseStyle,
    ...styles,
  };

  return (
    <div id={id} style={mergedStyle}>
      {title ? (
        <h3
          style={{
            margin: 0,
            fontSize: "1.125rem",
            fontWeight: 600,
            color: "#0f172a",
          }}
        >
          {title}
        </h3>
      ) : null}
      <span
        style={{
          fontSize: "2.25rem",
          fontWeight: 700,
          lineHeight: 1.1,
          color: "#111827",
        }}
      >
        {value}
      </span>
      {subtitle ? (
        <span
          style={{
            marginTop: "auto",
            fontSize: "0.95rem",
            color: "#64748b",
          }}
        >
          {subtitle}
        </span>
      ) : null}
    </div>
  );
};
