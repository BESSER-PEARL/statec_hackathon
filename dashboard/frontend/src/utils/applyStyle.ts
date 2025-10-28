export interface StyleData {
  selectors: string[];
  style: Record<string, string | number | undefined>;
}

export function applyStyle(
  selector: string,
  styles: StyleData[]
): Record<string, string | number> {
  const match = styles.find((entry) => entry.selectors.includes(selector));
  if (!match) {
    return {};
  }

  const filtered: Record<string, string | number> = {};
  Object.entries(match.style).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      filtered[key] = value;
    }
  });
  return filtered;
}