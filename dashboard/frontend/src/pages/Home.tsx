import React from "react";
import componentsData from "../data/ui_components.json";
import stylesData from "../data/ui_styles.json";
import { Renderer } from "../components/Renderer";
import { applyStyle, StyleData } from "../utils/applyStyle";

const mainPageId = "icnh";

const Home: React.FC = () => {
  const pages = componentsData.pages ?? [];
  const page =
    pages.find((p: any) => (mainPageId ? p.id === mainPageId : false)) ??
    pages[0];

  if (!page) {
    return <div>No screens defined in the generated GUI model.</div>;
  }

  const styles = (stylesData.styles ?? []) as StyleData[];
  const pageStyle = {
    width: "100%",
    minHeight: "100vh",
    ...applyStyle(`#${page.id}`, styles),
  };

  return (
    <div id={page.id} style={pageStyle}>
      {(page.components ?? []).map((component: any) => (
        <Renderer key={component.id} component={component} styles={styles} />
      ))}
    </div>
  );
};

export default Home;