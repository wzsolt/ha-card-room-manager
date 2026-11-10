export const cardStyles = `
:host {
  display: block;
  container-type: inline-size;
  --room-text: var(--primary-text-color, light-dark(#24262a, #f0f0f0));
  --room-muted: var(--secondary-text-color, light-dark(#555d64, #b3b3b3));
  --room-surface: var(--secondary-background-color, light-dark(#f0f2f5, #252525));
  --room-line: var(--divider-color, light-dark(#c8cdd3, #484848));
  --room-amber: light-dark(#865400, #ffc44c);
  --room-blue: light-dark(#006b95, #61c5f0);
  --room-green: light-dark(#23763a, #77ca89);
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
h2, h3, h4 { margin: 0; overflow-wrap: anywhere; }
h2 { font-size: 1.2rem; line-height: 1.25; font-weight: 650; }
h3 { font-size: 1rem; font-weight: 650; }
h4 { font-size: .81rem; font-weight: 600; color: var(--room-muted); margin: 4px 0 7px; }
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
  min-height: 23px;
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
button.chip { min-height: 32px; cursor: pointer; }
button.chip:disabled { cursor: default; }
button.chip:not(:disabled):hover { border-color: currentColor; }
.chip.quiet { --accent: var(--room-muted); }
.chip.warn { --accent: var(--room-amber); }
.chip.info { --accent: var(--room-blue); }
.chip.good { --accent: var(--room-green); }
.sections { margin-top: 13px; background: var(--room-surface); border-radius: 16px; overflow: hidden; }
.section { padding: 12px; border-top: 1px solid var(--room-line); }
.section:first-of-type, .section[data-first] { border-top: 0; }
.section-header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 9px; }
.sensors, .lights { --accent: var(--room-amber); }
.switches { --accent: var(--room-blue); }
.sensor-group + .sensor-group { margin-top: 10px; }
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
.tile {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  border: 1px solid transparent;
  border-radius: 11px;
  min-width: 0;
  color: var(--room-text);
  background: color-mix(in srgb, var(--room-text) 3%, transparent);
}
.tile[data-active] {
  background: color-mix(in srgb, var(--accent) 11%, transparent);
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
}
.tile[data-unavailable] .tile-state { color: var(--room-muted); }
.tile[data-group="presence"] { --accent: var(--room-blue); }
.tile[data-group="openings"]:not([data-active]):not([data-unavailable]) { --accent: var(--room-green); }
.tile:not([data-active]) .glyph { --accent: var(--room-muted); }
.tile[data-group="openings"]:not([data-active]):not([data-unavailable]) .glyph { --accent: var(--room-green); }
.tile-main, .details {
  color: inherit;
  border: 0;
  background: transparent;
  cursor: pointer;
  font: inherit;
}
.tile-main { display: flex; align-items: center; gap: 8px; min-width: 0; text-align: start; padding: 6px; min-height: 52px; }
.tile-main:disabled { cursor: default; }
.tile-main .glyph { width: 30px; height: 30px; }
.tile-main .glyph ha-icon { --mdc-icon-size: 17px; }
.tile-text { display: grid; min-width: 0; }
.tile-name { font-size: .88rem; font-weight: 600; overflow-wrap: anywhere; }
.tile-state { font-size: .78rem; color: var(--room-muted); overflow-wrap: anywhere; }
.tile[data-active] .tile-state { color: var(--accent); }
.details { align-self: center; width: 32px; min-height: 36px; padding: 0; margin-inline-end: 2px; color: var(--room-muted); }
.details ha-icon { --mdc-icon-size: 17px; }
.brightness {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 35px;
  align-items: center;
  gap: 6px;
  padding: 0 9px 4px;
  color: var(--room-muted);
  font-size: .72rem;
  text-align: end;
}
.brightness input { width: 100%; margin: 0; min-height: 24px; accent-color: var(--accent); }
.brightness output { font-variant-numeric: tabular-nums; }
.notice { margin: 10px 0 0; color: var(--room-muted); overflow-wrap: anywhere; }
.error { color: var(--error-color, light-dark(#a22329, #ff9f9e)); }
button:focus-visible, input:focus-visible {
  outline: 2px solid var(--primary-color, #1686b7);
  outline-offset: 1px;
}
@container (max-width: 400px) {
  .room { padding: 10px; }
  .section { padding: 9px; }
  .grid { grid-template-columns: minmax(0, 1fr); }
}
`;

export const editorStyles = `
:host { display: block; color: var(--primary-text-color, CanvasText); }
:host([data-theme-mode="dark"]) { color-scheme: dark; }
:host([data-theme-mode="light"]) { color-scheme: light; }
[hidden] { display: none !important; }
form { display: grid; gap: 12px; margin: 8px 0; }
label, .pick { display: grid; gap: 5px; min-width: 0; font-size: .875rem; }
label span, summary { font-weight: 600; }
input, select, button {
  min-width: 0;
  box-sizing: border-box;
  font: inherit;
  color: inherit;
  border-radius: 6px;
  border: 1px solid var(--divider-color, #888);
  padding: 7px;
  background: var(--card-background-color, Canvas);
}
input::placeholder { color: var(--secondary-text-color, #666); }
button { cursor: pointer; }
button:disabled { opacity: .55; cursor: default; }
:is(input, select, button, summary):focus-visible {
  outline: 2px solid var(--primary-color, #1686b7);
  outline-offset: 1px;
}
details { border: 1px solid var(--divider-color, #888); border-radius: 8px; padding: 8px; }
summary { cursor: pointer; padding: 3px; }
.panel, .entries, .overrides { display: grid; gap: 6px; }
details[open] > .panel { margin-top: 8px; }
.field-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 5px; }
.saved-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 5px; align-items: center; }
.saved-name { overflow-wrap: anywhere; font-size: .83rem; }
.override-row { display: grid; gap: 6px; }
.override-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 130px), 1fr)); gap: 6px; }
`;
