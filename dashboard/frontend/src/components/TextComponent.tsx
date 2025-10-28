import React from "react";
import { applyStyle, StyleData } from "../utils/applyStyle";

interface TextProps {
  id: string;
  content: string;
  styles: StyleData[];
  tag?: React.ElementType;
}

export const TextComponent: React.FC<TextProps> = ({
  id,
  content,
  styles,
  tag,
}) => {
  const style = applyStyle(`#${id}`, styles);
  const Component = tag || "p";
  return React.createElement(Component, { id, style }, content);
};