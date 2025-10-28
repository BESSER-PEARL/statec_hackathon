import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import Papa from "papaparse";

const position: [number, number] = [49.75, 6.2]; // Center of Luxembourg
// Define bounds for Luxembourg (with a small margin)
const luxBounds: [[number, number], [number, number]] = [
  [49.40, 5.65], // Southwest corner
  [50.25, 6.60]  // Northeast corner
];

const geoJsonStyle = {
  color: "#3388ff",
  weight: 2,
  fillColor: "#66cc99",
  fillOpacity: 0.5,
};


interface MapComponentProps {
  breakdown: string;
  marital: string;
  sex: string;
}

const MapComponent: React.FC<MapComponentProps> = ({ breakdown, marital, sex }) => {

  const [geoData, setGeoData] = useState<any>(null);
  const [communeData, setCommuneData] = useState<Record<string, any>>({});

  useEffect(() => {
    fetch("/LIMADM_COMMUNES.geojson")
      .then((res) => res.json())
      .then((data) => setGeoData(data));
  }, []);

  useEffect(() => {
    // Only use CSV for the first breakdown
    if (breakdown !== "Population by canton and municipality, legal marital status and sex") {
      setCommuneData({});
      return;
    }
    fetch("/data.csv")
      .then((res) => res.text())
      .then((csvText) => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results: Papa.ParseResult<any>) => {
            // Filter rows by comboboxes
            const filtered = results.data.filter((row: any) => {
              // Match sex and marital status
              let sexMatch = false;
              let maritalMatch = false;
              // Sex
              if (sex === "Total") {
                sexMatch = row["SEX"] === "_T" || row["Sex"] === "Total";
              } else if (sex === "Male") {
                sexMatch = row["SEX"] === "M" || row["Sex"] === "Male";
              } else if (sex === "Female") {
                sexMatch = row["SEX"] === "F" || row["Sex"] === "Female";
              }
              // Marital status
              if (marital === "Total") {
                maritalMatch = row["LMS"] === "_T" || row["Legal marital status"] === "Total";
              } else if (marital.startsWith("Never married")) {
                maritalMatch = row["LMS"] === "SIN";
              } else if (marital.startsWith("Married or in registered partnership")) {
                maritalMatch = row["LMS"] === "MAR_REP";
              } else if (marital.startsWith("Widowed")) {
                maritalMatch = row["LMS"] === "WID_DTHREP";
              } else if (marital.startsWith("Divorced")) {
                maritalMatch = row["LMS"] === "DIV_DISREP";
              } else if (marital === "Not stated") {
                maritalMatch = row["LMS"] === "UNK";
              }
              return sexMatch && maritalMatch;
            });
            // Map by last 4 digits of commune code (for LAU2 matching)
            const data: Record<string, any> = {};
            filtered.forEach((row: any) => {
              const geoCode = row["GEO"] || row["Geographic level"];
              if (geoCode && geoCode.length >= 4) {
                const lau2 = geoCode.slice(-4); // last 4 digits
                data[lau2] = row;
              }
            });
            setCommuneData(data);
          },
        });
      });
  }, [breakdown, marital, sex]);


  // Get population values for color scale
  const populations = Object.values(communeData)
    .map((row: any) => Number(row["OBS_VALUE"]))
    .filter((v) => !isNaN(v));
  const minPop = populations.length ? Math.min(...populations) : 0;
  const maxPop = populations.length ? Math.max(...populations) : 1;
  const blueRedGradient = [
    "#e0f3f8", // very light blue
    "#91bfdb", // light blue
    "#4575b4", // medium blue
    "#313695", // deep navy
    "#d73027", // red
    "#a50026"  // intense red
  ];
  function getColor(pop: number | null) {
    if (pop === null || isNaN(pop)) return "#cccccc";
    const logMin = Math.log(minPop + 1);
    const logMax = Math.log(maxPop + 1);
    const logPop = Math.log(pop + 1);
    const t = (logPop - logMin) / (logMax - logMin || 1);
    const idx = Math.max(0, Math.min(blueRedGradient.length - 1, Math.floor(t * (blueRedGradient.length - 1))));
    return blueRedGradient[idx];
  }
  const legendSteps = blueRedGradient.length;
  const legendValues = Array.from({ length: legendSteps }, (_, i) => {
    const t = i / (legendSteps - 1);
    const logMin = Math.log(minPop + 1);
    const logMax = Math.log(maxPop + 1);
    const logValue = logMin + t * (logMax - logMin);
    const value = Math.round(Math.exp(logValue) - 1);
    return value;
  });

  return (
    <div style={{ height: "500px", width: "100%", position: "relative" }}>
      <MapContainer
        center={position}
        zoom={9}
        minZoom={8}
        maxZoom={14}
        maxBounds={luxBounds}
        maxBoundsViscosity={1.0}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {geoData && (
          <GeoJSON
            key={JSON.stringify(communeData)}
            data={geoData}
            style={(feature: any) => {
              let communeCode = feature.properties?.LAU2;
              let hasData = communeCode && communeData[communeCode];
              let population = hasData ? Number(communeData[communeCode]["OBS_VALUE"]) : null;
              return {
                color: "#3388ff",
                weight: 2,
                fillColor: getColor(population),
                fillOpacity: 0.7,
              };
            }}
            onEachFeature={(feature: any, layer: any) => {
              let communeCode = feature.properties?.LAU2;
              let communeName = feature.properties?.COMMUNE || feature.properties?.NOM_COM || feature.properties?.name || feature.properties?.NOM || feature.properties?.commune || "Commune";
              let hasData = communeCode && communeData[communeCode];
              let population = hasData ? communeData[communeCode]["OBS_VALUE"] : null;
              let sexValue = hasData ? (communeData[communeCode]["Sex"] || communeData[communeCode]["SEX"]) : null;
              let maritalValue = hasData ? (communeData[communeCode]["Legal marital status"] || communeData[communeCode]["LMS"]) : null;
              // HTML content for tooltip
              let tooltipContent = `
                <div class='commune-tooltip'>
                  <div style='font-weight:bold;font-size:1.1em;margin-bottom:4px;'>${communeName}</div>
                  ${hasData ? `
                    <div><span style='color:#3388ff;font-weight:600;'>Population:</span> ${population}</div>
                    <div><span style='color:#3388ff;font-weight:600;'>Sex:</span> ${sexValue}</div>
                    <div><span style='color:#3388ff;font-weight:600;'>Marital status:</span> ${maritalValue}</div>
                  ` : `<div style='color:#888;'>No data available.</div>`}
                </div>
              `;
              layer.bindTooltip(tooltipContent, {
                direction: "top",
                opacity: 0.95,
                className: "custom-commune-tooltip",
                interactive: true,
                permanent: false
              });
            }}
          />
        )}
      </MapContainer>
      {/* Color scale legend for map conventions */}
      <div className="map-legend">
        <div style={{ fontWeight: "bold", marginBottom: 4 }}>Population</div>
        <div style={{ display: "flex", alignItems: "center" }}>
          {blueRedGradient.map((color, i) => (
            <div key={i} style={{
              background: color,
              width: 24,
              height: 18,
              borderRadius: 3,
              marginRight: 2,
              border: "1px solid #ccc"
            }} />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9em", marginTop: 2 }}>
          <span>Low</span>
          <span>High</span>
        </div>
      </div>
      {/* Tooltip and legend styles */}
      <style>{`
        .custom-commune-tooltip {
          background: #fff;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          padding: 10px 14px;
          color: #222;
          font-family: 'Segoe UI', Arial, sans-serif;
          font-size: 1em;
          min-width: 180px;
        }
        .commune-tooltip div {
          margin-bottom: 4px;
        }
        .map-legend {
          position: absolute;
          right: 18px;
          bottom: 18px;
          background: rgba(255,255,255,0.95);
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.10);
          padding: 10px 16px 8px 16px;
          font-family: 'Segoe UI', Arial, sans-serif;
          font-size: 1em;
          z-index: 1000;
          min-width: 160px;
        }
      `}</style>
    </div>
  );
};

export default MapComponent;
