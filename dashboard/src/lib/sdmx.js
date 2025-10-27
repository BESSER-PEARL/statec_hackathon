const DEFAULT_ACCEPT =
  "application/vnd.sdmx.data+json; version=2; charset=utf-8";

/**
 * Build a request URL for the SDMX REST API.
 */
function buildUrl({ baseUrl, flowId, key, params }) {
  const normalizedBase = (baseUrl ?? "https://lustat.statec.lu").replace(
    /\/$/,
    "",
  );
  const query = params && Object.keys(params).length
    ? `?${new URLSearchParams(params).toString()}`
    : "";
  return `${normalizedBase}/rest/data/${flowId}/${key}${query}`;
}

/**
 * Fetch SDMX JSON data from the specified dataflow and key.
 */
export async function fetchSdmxDataset({
  baseUrl,
  flowId,
  key,
  params,
  signal,
}) {
  const url = buildUrl({ baseUrl, flowId, key, params });
  const response = await fetch(url, {
    headers: {
      Accept: DEFAULT_ACCEPT,
    },
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `SDMX request failed (${response.status} ${response.statusText})\n` +
        (errorText ? errorText.slice(0, 280) : ""),
    );
  }

  return response.json();
}

/**
 * Expand SDMX JSON series/observations into flat records.
 */
export function expandSdmxRows(payload) {
  const dataSet = payload?.data?.dataSets?.[0];
  if (!dataSet) {
    return [];
  }

  const structureIndex = dataSet.structure ?? 0;
  const structure = payload?.data?.structures?.[structureIndex];
  if (!structure) {
    return [];
  }

  const seriesDimensions = structure.dimensions?.series ?? [];
  const observationDimensions = structure.dimensions?.observation ?? [];
  const observationAttributes = structure.attributes?.observation ?? [];

  const rows = [];

  Object.entries(dataSet.series ?? {}).forEach(([seriesKey, seriesValue]) => {
    const seriesIndices = seriesKey.split(":").map((index) => Number(index));
    const baseRecord = {};

    seriesDimensions.forEach((dimension, position) => {
      const valueMeta = dimension.values?.[seriesIndices[position]];
      const code = valueMeta?.id ?? valueMeta?.name ?? "";
      const label = valueMeta?.name ?? valueMeta?.id ?? "";
      baseRecord[dimension.id] = code;
      baseRecord[`${dimension.id}_label`] = label;
    });

    Object.entries(seriesValue.observations ?? {}).forEach(
      ([observationKey, observationValue]) => {
        const observationIndices = observationKey
          .split(":")
          .map((index) => Number(index));

        const record = { ...baseRecord };

        observationDimensions.forEach((dimension, position) => {
          const valueMeta = dimension.values?.[observationIndices[position]];
          const code = valueMeta?.id ?? valueMeta?.name ?? "";
          const label = valueMeta?.name ?? valueMeta?.id ?? "";
          record[dimension.id] = code;
          record[`${dimension.id}_label`] = label;
        });

        record.OBS_VALUE = Number(observationValue?.[0] ?? 0);

        if (observationValue?.length > 1 && observationAttributes?.length) {
          observationAttributes.forEach((attribute, attributePosition) => {
            const attributeIndex = observationValue[attributePosition + 1];
            if (attributeIndex === undefined || attributeIndex === null) {
              return;
            }
            const attrMeta = attribute.values?.[attributeIndex];
            const code = attrMeta?.id ?? attrMeta?.name ?? "";
            const label = attrMeta?.name ?? attrMeta?.id ?? "";
            record[attribute.id] = code;
            record[`${attribute.id}_label`] = label;
          });
        }

        rows.push(record);
      },
    );
  });

  return rows;
}
