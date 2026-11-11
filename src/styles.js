export const cardStyles = `
:host {
  display: block;
  container-type: inline-size;
  --room-text: var(--primary-text-color, light-dark(#24262a, #f0f0f0));
  --room-muted: var(--secondary-text-color, light-dark(#555d64, #b3b3b3));
  --room-line: var(--divider-color, light-dark(#c8cdd3, #484848));
  --room-amber: light-dark(#865400, #ffc44c);
  --room-blue: light-dark(#006b95, #61c5f0);
  --room-green: light-dark(#23763a, #77ca89);
  --room-red: light-dark(#a52c34, #ff8585);
  color: var(--room-text);
  font-family: var(--primary-font-family, inherit);
}
:host([data-theme-mode="dark"]) { color-scheme: dark; }
:host([data-theme-mode="light"]) { color-scheme: light; }
[hidden] { display: none !important; }
ha-card {
  display: block;
  overflow: hidden;
  background: var(--ha-card-background, var(--card-background-color, light-dark(#fff, #1c1c1c)));
}
.room { padding: 14px; }
.header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.room-title, .section-title { display: flex; align-items: center; gap: 10px; min-width: 0; }
h2, h3 { margin: 0; overflow-wrap: anywhere; }
h2 { font-size: 1.2rem; line-height: 1.25; font-weight: 650; }
h3 { font-size: 1rem; font-weight: 650; }
.glyph {
  display: inline-grid;
  flex: none;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  color: var(--accent, var(--room-muted));
  background: color-mix(in srgb, currentColor 14%, transparent);
}
.glyph ha-icon { --mdc-icon-size: 20px; }
.room-title .glyph { width: 42px; height: 42px; --accent: var(--room-amber); }
.summary, .section-badges { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 26px;
  padding: 1px 8px;
  border-radius: 999px;
  border: 1px solid transparent;
  box-sizing: border-box;
  background: color-mix(in srgb, currentColor 12%, transparent);
  color: var(--accent, var(--room-muted));
  font: inherit;
  font-size: .77rem;
  font-weight: 650;
  line-height: 1.3;
}
.chip ha-icon { --mdc-icon-size: 15px; }
button.chip { cursor: pointer; }
button.chip:disabled { cursor: default; }
button.chip:not(:disabled):hover { border-color: currentColor; }
.chip.quiet { --accent: var(--room-muted); }
.chip.warn { --accent: var(--room-amber); }
.chip.info { --accent: var(--room-blue); }
.chip.good { --accent: var(--room-green); }
.chip.danger { --accent: var(--room-red); }
.sections { margin-top: 10px; }
.section { padding: 12px 0; border-top: 1px solid var(--room-line); }
.section[data-first] { border-top: 0; }
.climate { display: grid; gap: 6px; padding-bottom: 10px; }
.climate-chart {
  position: relative;
  overflow: hidden;
  display: block;
  width: 100%;
  padding: 6px 8px 4px;
  border: 0;
  border-radius: 10px;
  color: var(--room-text);
  background: color-mix(in srgb, var(--room-text) 6%, transparent);
  text-align: start;
  font: inherit;
  cursor: pointer;
}
.climate-chart.temperature { --accent: var(--room-green); }
.climate-chart.humidity { --accent: var(--room-blue); }
.chart-label { display: flex; align-items: center; gap: 8px; }
.chart-label .glyph { width: 27px; height: 27px; }
.chart-label .glyph ha-icon { --mdc-icon-size: 17px; }
.chart-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .83rem; font-weight: 600; }
.chart-value { margin-inline-start: auto; white-space: nowrap; color: var(--accent); font-size: .83rem; font-weight: 650; }
.chart-graph { display: block; position: relative; height: 30px; cursor: crosshair; }
.chart-graph svg { display: block; width: 100%; height: 100%; pointer-events: none; }
.chart-area { fill: var(--accent); opacity: .14; }
.chart-line { fill: none; stroke: var(--accent); stroke-width: 1.4; vector-effect: non-scaling-stroke; stroke-linecap: round; }
.chart-marker, .chart-tooltip { position: absolute; pointer-events: none; }
.chart-graph:not(:hover) > :is(.chart-marker, .chart-tooltip) { visibility: hidden; }
.chart-marker {
  inset-block: 0;
  border-left: 1px dashed color-mix(in srgb, var(--accent) 65%, transparent);
}
.chart-marker::after {
  content: "";
  position: absolute;
  top: var(--sample-y);
  left: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  transform: translate(-50%, -50%);
}
.chart-tooltip {
  top: 0;
  width: max-content;
  max-width: 100%;
  box-sizing: border-box;
  padding: 2px 6px;
  border-radius: 5px;
  background: var(--ha-card-background, var(--card-background-color, light-dark(#fff, #1c1c1c)));
  color: var(--room-text);
  font-size: .69rem;
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transform: translateX(-50%);
}
.section-header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 9px; }
.covers, .lights { --accent: var(--room-amber); }
.switches { --accent: var(--room-blue); }
.security { --accent: var(--room-green); }
.security[data-alert] .section-title .glyph { --accent: var(--room-amber); }
.security[data-open] .section-title .glyph { --accent: var(--room-red); }
.grid { display: grid; grid-template-columns: repeat(var(--room-columns, 2), minmax(0, 1fr)); gap: 7px; }
.tile {
  container-type: inline-size;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  border: 1px solid transparent;
  border-radius: 11px;
  min-width: 0;
  color: var(--room-text);
  --tile-base: color-mix(in srgb, var(--room-text) 6%, transparent);
  background-color: var(--tile-base);
}
.tile[data-active] {
  background-color: color-mix(in srgb, var(--accent) 11%, var(--tile-base));
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
}
.tile[data-level] {
  background-color: var(--tile-base);
  background-image: linear-gradient(90deg,
    color-mix(in srgb, var(--accent) 24%, transparent) 0 var(--level), transparent var(--level));
}
.tile[data-level]:dir(rtl) {
  background-image: linear-gradient(270deg,
    color-mix(in srgb, var(--accent) 24%, transparent) 0 var(--level), transparent var(--level));
}
.tile[data-unavailable] .tile-state { color: var(--room-muted); }
.tile[data-sensor][data-active] { --accent: var(--room-amber); }
.tile[data-sensor][data-open] { --accent: var(--room-red); }
.tile[data-sensor][data-active] { border-color: transparent; }
.tile:not([data-active]) .glyph { --accent: var(--room-muted); }
.tile[data-sensor]:not([data-unavailable]) .glyph { --accent: inherit; }
.tile-main, .details, .cover-action {
  color: inherit;
  border: 0;
  background: transparent;
  cursor: pointer;
  font: inherit;
}
.tile-main { display: flex; align-items: center; gap: 8px; min-width: 0; text-align: start; padding: 6px; min-height: 52px; }
.tile-main:disabled { cursor: default; }
.tile[data-dimmable] .tile-main:not(:disabled) { cursor: ew-resize; touch-action: pan-y; user-select: none; }
.tile-main .glyph { width: 30px; height: 30px; }
.tile-main .glyph ha-icon { --mdc-icon-size: 17px; }
.tile[data-sensor] .tile-main { min-height: 46px; }
.tile-text { display: grid; min-width: 0; }
.tile-name { font-size: .88rem; font-weight: 600; overflow-wrap: anywhere; }
.tile-state { font-size: .78rem; color: var(--room-muted); overflow-wrap: anywhere; }
.tile[data-active] .tile-state { color: var(--accent); }
.tile[data-sensor]:not([data-unavailable]) .tile-state { color: var(--accent); }
.details { align-self: center; width: 32px; min-height: 36px; padding: 0; margin-inline-end: 2px; color: var(--room-muted); }
.details ha-icon { --mdc-icon-size: 17px; }
.cover-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: center;
  gap: 3px;
  padding: 0 3px 4px;
}
.cover-action { flex: 0 1 32px; min-width: 0; min-height: 26px; border-radius: 6px; padding: 0; }
.cover-action ha-icon { --mdc-icon-size: 17px; }
.cover-action:disabled { opacity: .35; cursor: default; }
.cover-action:not(:disabled):hover { background: color-mix(in srgb, var(--accent) 16%, transparent); }
.notice { margin: 10px 0 0; color: var(--room-muted); overflow-wrap: anywhere; }
.error { color: var(--error-color, light-dark(#a22329, #ff9f9e)); }
button:focus-visible {
  outline: 2px solid var(--primary-color, #1686b7);
  outline-offset: 1px;
}
@container (max-width: 400px) {
  .room { padding: 10px; }
  .section { padding: 9px 0; }
  .grid:not([data-columns]) { grid-template-columns: minmax(0, 1fr); }
}
@container (max-width: 135px) {
  .tile-main { gap: 4px; padding: 4px; }
  .tile-main .glyph, .tile[data-sensor] .tile-main .glyph { width: 18px; height: 23px; }
  .tile-main .glyph ha-icon, .details ha-icon { --mdc-icon-size: 14px; }
  .tile-name, .tile-state { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .details { width: 20px; }
}
`;

export const editorStyles = `
:host { display: block; color: var(--primary-text-color, CanvasText); }
:host([data-theme-mode="dark"]) { color-scheme: dark; }
:host([data-theme-mode="light"]) { color-scheme: light; }
ha-form { display: block; margin: 8px 0; }
`;
