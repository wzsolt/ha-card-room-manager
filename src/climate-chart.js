import { button, element } from "./dom.js";
import { plotHeight, plotWidth, sampleAt } from "./history.js";

export function climateChart(kind, glyph, action) {
  const namespace = "http://www.w3.org/2000/svg";
  const plot = document.createElementNS(namespace, "svg");
  const area = document.createElementNS(namespace, "path");
  const line = document.createElementNS(namespace, "path");
  plot.setAttribute("viewBox", `0 0 ${plotWidth} ${plotHeight}`);
  plot.setAttribute("preserveAspectRatio", "none");
  area.setAttribute("class", "chart-area");
  line.setAttribute("class", "chart-line");
  plot.append(area, line);

  const marker = element("span", "chart-marker");
  const readout = element("span", "chart-readout");
  const graph = element("span", "chart-graph", plot, marker);
  graph.setAttribute("aria-hidden", "true");
  const title = element("span", "chart-title");
  const value = element("span", "chart-value");
  const content = element("span", "chart-label", glyph, title, value);
  const node = button(`climate-chart ${kind}`, action, content, graph, readout);

  let history;
  let formatSample;
  let shownSample;
  const hideSample = () => {
    marker.hidden = true;
    readout.textContent = "";
    shownSample = undefined;
  };
  hideSample();
  node.addEventListener("pointerleave", hideSample);
  node.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch" || !history) return;
    const { left, right, top, bottom, width } = graph.getBoundingClientRect();
    if (!width || event.clientX < left || event.clientX >= right
        || event.clientY < top || event.clientY >= bottom) {
      hideSample();
      return;
    }
    const sample = sampleAt(history, (event.clientX - left) / width * plotWidth);
    if (!sample) {
      hideSample();
      return;
    }
    if (sample === shownSample) return;
    readout.textContent = formatSample(sample);
    shownSample = sample;
    marker.hidden = false;
    marker.style.left = `${sample.x / plotWidth * 100}%`;
    marker.style.setProperty("--sample-y", `${sample.y / plotHeight * 100}%`);
  });

  return {
    node, title, value,
    setHistory(next, format) {
      formatSample = format;
      if (next === history) return;
      history = next;
      line.setAttribute("d", next?.line ?? "");
      area.setAttribute("d", next?.area ?? "");
      hideSample();
    },
  };
}
