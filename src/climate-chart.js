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
  const tooltip = element("span", "chart-tooltip");
  const graph = element("span", "chart-graph", plot, marker, tooltip);
  graph.setAttribute("aria-hidden", "true");
  const title = element("span", "chart-title");
  const value = element("span", "chart-value");
  const content = element("span", "chart-label", glyph, title, value);
  const node = button(`climate-chart ${kind}`, action, content, graph);

  let history;
  let formatSample;
  let shownSample;
  const hideSample = () => {
    marker.hidden = true;
    tooltip.hidden = true;
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
    if (sample !== shownSample) {
      tooltip.textContent = formatSample(sample);
      shownSample = sample;
    }
    marker.hidden = false;
    tooltip.hidden = false;
    const position = sample.x / plotWidth;
    marker.style.left = `${position * 100}%`;
    marker.style.setProperty("--sample-y", `${sample.y / plotHeight * 100}%`);
    const half = tooltip.offsetWidth / 2;
    const x = position * width;
    const offset = half + 8;
    let center = x + offset;
    if (center + half > width) center = x - offset;
    tooltip.style.left = `${Math.max(half, Math.min(width - half, center))}px`;
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
