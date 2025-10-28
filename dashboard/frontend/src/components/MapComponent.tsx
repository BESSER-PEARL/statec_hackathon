import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const position: [number, number] = [49.75, 6.2]; // Center of Luxembourg

const geoJsonStyle = {
  color: "#3388ff",
  weight: 2,
  fillColor: "#66cc99",
  fillOpacity: 0.5,
};

const MapComponent: React.FC = () => {
  const [geoData, setGeoData] = useState<any>(null);

  useEffect(() => {
    fetch("/LIMADM_COMMUNES.geojson")
      .then((res) => res.json())
      .then((data) => setGeoData(data));
  }, []);

  return (
    <div style={{ height: "500px", width: "100%" }}>
      <MapContainer center={position} zoom={9} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {geoData && (
          <GeoJSON
            data={geoData}
            style={() => geoJsonStyle}
            onEachFeature={(feature, layer) => {
              let communeName = feature.properties?.NOM_COM || feature.properties?.name || feature.properties?.NOM || feature.properties?.commune || "Commune";
              // Generate random population data for age groups
              const ageGroups = [
                { label: "0-10 years", value: Math.floor(Math.random() * 500 + 100) },
                { label: "10-20 years", value: Math.floor(Math.random() * 500 + 100) },
                { label: "20-40 years", value: Math.floor(Math.random() * 800 + 200) },
                { label: "40-60 years", value: Math.floor(Math.random() * 700 + 150) },
                { label: "60+ years", value: Math.floor(Math.random() * 400 + 50) },
              ];
              let popupText = `${communeName}\n`;
              ageGroups.forEach(group => {
                popupText += `${group.label}: ${group.value} people\n`;
              });
              layer.bindPopup(popupText);
            }}
          />
        )}
      </MapContainer>
    </div>
  );
};

export default MapComponent;
