import { CARD_TYPE, CONTROL_GROUPS, GROUPS, MEASUREMENTS, buildRoom, isActive, isAvailable, isCoverAvailable, normalizeConfig, supportsBrightness, validateConfig } from "./room.js";
import { applyThemeMode, button, element, icon, mount, orderChildren } from "./dom.js";
import { cardStyles } from "./styles.js";
import { labels } from "./text.js";
import { RoomManagerEditor } from "./editor.js";
import { TemperatureRange } from "./temperature.js";
import { ClimateHistory } from "./history.js";
import { climateChart } from "./climate-chart.js";
import { enableBrightnessDrag } from "./brightness.js";

const glyphs = {
  security: "mdi:shield-home-outline",
  covers: "mdi:window-shutter",
  lights: "mdi:lightbulb-group-outline",
  switches: "mdi:power-socket-eu",
};

const coverControls = [
  { key: "open", feature: 1, icon: "mdi:arrow-up", service: "open_cover" },
  { key: "stop", feature: 8, icon: "mdi:stop", service: "stop_cover" },
  { key: "close", feature: 2, icon: "mdi:arrow-down", service: "close_cover" },
];

const measurementIcons = { temperature: "mdi:thermometer", humidity: "mdi:water-percent" };

function chip(name, action) {
  const value = element("span");
  const node = action ? button("chip", action, icon(name), value) : element("span", "chip", icon(name), value);
  if (!action) node.setAttribute("role", "img");
  return { node, value };
}

function updateChip(chip, value, tone, label = value, visible = true) {
  chip.value.textContent = value;
  chip.node.className = `chip ${tone}`;
  chip.node.title = label;
  chip.node.setAttribute("aria-label", label);
  chip.node.hidden = !visible;
}

function glyph(name) {
  return element("span", "glyph", icon(name));
}

function section(name, content, ...badges) {
  const title = element("h3");
  const header = element("div", "section-header",
    element("div", "section-title", glyph(glyphs[name]), title),
    element("div", "section-badges", ...badges.map((badge) => badge.node)),
  );
  return { title, node: element("section", `section ${name}`, header, content) };
}

function tileIcon(item) {
  if (item.icon) return item.icon;
  if (item.group === "lights") return item.state?.state === "on" ? "mdi:lightbulb-on" : "mdi:lightbulb-outline";
  if (item.group === "covers") return isActive(item) ? "mdi:window-shutter-open" : glyphs.covers;
  if (item.group !== "security") return glyphs[item.group];
  if (item.securityType === "presence") return isActive(item) ? "mdi:motion-sensor" : "mdi:motion-sensor-off";
  switch (item.deviceClass) {
    case "window": return "mdi:window-closed-variant";
    case "garage_door": return "mdi:garage";
    default: return item.securityType === "opening" ? "mdi:door-closed" : glyphs.security;
  }
}

function tileState(item, text) {
  const available = item.group === "covers" ? isCoverAvailable : isAvailable;
  if (!available(item.state)) return item.state?.state === "unknown" ? text.unknown : text.unavailable;
  if (item.group === "covers") return text[item.state.state];
  const on = item.state.state === "on";
  if (item.securityType === "opening") return on ? text.open : text.closed;
  if (item.group === "security") return on ? text.active : text.inactive;
  return on ? text.on : text.off;
}

function securityStatus(hasOpenings, open, on, unavailable, text) {
  if (!on) return unavailable ? text.unknown : hasOpenings ? text.allClosed : text.inactive;
  return [open ? text.countOpen(open) : "", on > open ? text.detected : ""].filter(Boolean).join(" · ");
}

function canRunCover(item, action) {
  const state = item.state;
  if (!isCoverAvailable(state) || !(state.attributes?.supported_features & action.feature)) return false;
  if (action.key === "stop") return state.state === "opening" || state.state === "closing";
  if (state.attributes.assumed_state) return true;
  return action.key === "open" ? !["open", "opening"].includes(state.state)
    || (state.state === "open" && state.attributes.current_position < 100)
    : !["closed", "closing"].includes(state.state);
}

class RoomManagerCard extends HTMLElement {
  static getStubConfig() {
    return {};
  }

  static async getConfigElement() {
    if (!customElements.get("ha-form")) {
      // The built-in Entities editor registers the Lovelace form and its selectors.
      await window.loadCardHelpers?.();
      await customElements.get("hui-entities-card")?.getConfigElement();
    }
    return document.createElement(`${CARD_TYPE}-editor`);
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._tiles = new Map();
    this._pending = new Set();
    this._temperatureRange = new TemperatureRange(() => this._queueRender());
    this._climateHistory = new ClimateHistory(() => this._queueRender());
  }

  setConfig(config) {
    validateConfig(config);
    this._config = normalizeConfig(config);
    this._error = false;
    this._queueRender();
  }

  set hass(hass) {
    this._hass = hass;
    this._queueRender();
  }

  connectedCallback() {
    this._queueRender();
  }

  disconnectedCallback() {
    this._climateHistory.clear();
  }

  getCardSize() {
    if (!this._room) return 2;
    return 2 + this._enabledCharts(this._room).length + GROUPS.reduce((rows, group) => {
      const count = this._room.groups[group].length;
      return count ? rows + 1 + Math.ceil(count / (this._config?.columns?.[group] ?? 2)) : rows;
    }, 0);
  }

  getGridOptions() {
    return { columns: 12, min_columns: 4 };
  }

  _queueRender() {
    if (this._renderQueued) return;
    this._renderQueued = true;
    queueMicrotask(() => {
      this._renderQueued = false;
      if (this.isConnected) this._render();
    });
  }

  _mount() {
    this._heading = element("h2");
    this._areaGlyph = glyph("mdi:home-outline");
    this._badges = {
      temperature: chip(measurementIcons.temperature, () => this._showHistory("temperature")),
      range: chip("mdi:restore", () => this._resetRange()),
      humidity: chip(measurementIcons.humidity, () => this._showHistory("humidity")),
      security: chip(glyphs.security),
      lights: chip("mdi:lightbulb", () => this._allOff("lights")),
      switches: chip("mdi:power-socket-eu"),
      covers: chip(glyphs.covers),
    };

    this._sections = Object.fromEntries(GROUPS.map((group) => {
      const grid = element("div", "grid");
      const action = CONTROL_GROUPS.includes(group) ? () => this._allOff(group) : undefined;
      const badge = chip(action ? "mdi:power" : glyphs[group], action);
      return [group, { ...section(group, grid, badge), grid, badge }];
    }));
    this._charts = Object.fromEntries(MEASUREMENTS.map((kind) => [
      kind, climateChart(kind, glyph(measurementIcons[kind]), () => this._showHistory(kind)),
    ]));
    this._climate = element("section", "climate", ...Object.values(this._charts).map(({ node }) => node));
    this._sectionList = element("div", "sections", this._climate, ...Object.values(this._sections).map(({ node }) => node));
    this._summary = element("div", "summary", ...Object.values(this._badges).map(({ node }) => node));
    this._message = element("p", "notice");
    this._failure = element("p", "notice error");
    this._failure.setAttribute("role", "alert");

    const header = element("header", "header",
      element("div", "room-title", this._areaGlyph, this._heading), this._summary);
    mount(this.shadowRoot, cardStyles, element("ha-card", null,
      element("div", "room", header, this._sectionList, this._message, this._failure)));
  }

  _render() {
    if (!this._heading) this._mount();
    const hass = this._hass;
    applyThemeMode(this, hass);
    const config = this._config ?? {};
    const text = labels(hass);
    const room = this._room = hass && buildRoom(hass, config);
    this._heading.textContent = config.title || room?.area.name || text.card;
    this._areaGlyph.firstChild.setAttribute("icon", config.icon || room?.area.icon || "mdi:home-outline");
    this._failure.hidden = !this._error;
    this._failure.textContent = this._error ? text.failed : "";

    this._summary.hidden = !room;
    this._sectionList.hidden = !room;
    this._message.hidden = false;
    if (!room) {
      this._climateHistory.clear();
      this._message.textContent = config.area && hass?.areas ? text.missingArea : text.selectArea;
      return;
    }

    this._updateMeasurements(room, text);
    let first = !this._updateCharts(room, text);
    for (const group of GROUPS) {
      this._updateGroup(group, room, text, first);
      if (room.groups[group].length) first = false;
    }
    this._sectionList.hidden = first;
    this._message.hidden = !first;
    this._message.textContent = first ? text.empty : "";

    const displayed = new Set(Object.values(room.groups).flat().map((item) => item.entity));
    for (const id of this._tiles.keys()) {
      if (!displayed.has(id)) this._tiles.delete(id);
    }
  }

  _updateMeasurements(room, text) {
    for (const kind of MEASUREMENTS) {
      const { id, display } = room.measurements[kind];
      const badge = this._badges[kind];
      updateChip(badge, display ?? "—", "info", `${text[kind]} · ${display ?? text.noReading}`, Boolean(id));
    }
    const range = this._temperatureRange.update(this._hass, room.area.area_id, room.measurements.temperature);
    const formatter = new Intl.NumberFormat(this._hass.locale?.language || this._hass.language, {
      maximumFractionDigits: 2,
    });
    const display = range ? text.minMax(formatter.format(range.min), formatter.format(range.max), range.unit ?? "") : "";
    updateChip(this._badges.range, display, "quiet", `${text.resetRange} · ${display}`, Boolean(range));
  }

  _enabledCharts(room) {
    return MEASUREMENTS.filter((kind) => this._config?.[`show_${kind}_chart`] && room.measurements[kind].id);
  }

  _updateCharts(room, text) {
    const enabled = this._enabledCharts(room);
    const hass = this._hass;
    const history = this._climateHistory.update(hass, enabled.map((kind) => room.measurements[kind]));
    this._climate.hidden = !enabled.length;
    this._climate.setAttribute("aria-label", text.chartPeriod);
    for (const kind of MEASUREMENTS) {
      const { id, unit, display } = room.measurements[kind];
      const chart = this._charts[kind];
      chart.node.hidden = !enabled.includes(kind);
      chart.title.textContent = text[kind];
      chart.value.textContent = display ?? "—";
      chart.node.setAttribute("aria-label", `${text[kind]} · ${display ?? text.noReading} · ${text.chartPeriod}`);
      chart.setHistory(history[id], ({ time, state }) => {
        const source = hass.states?.[id];
        const reading = (source && hass.formatEntityState?.({ ...source, state }))
          ?? [state, unit].filter(Boolean).join(" ");
        const date = new Date(time).toLocaleString(hass.locale?.language || hass.language, {
          month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
        });
        return `${date} · ${reading}`;
      });
    }
    return Boolean(enabled.length);
  }

  _updateGroup(group, room, text, first) {
    const items = room.groups[group];
    const view = this._sections[group];
    const columns = this._config?.columns?.[group];
    view.title.textContent = text[group];
    view.node.hidden = !items.length;
    view.node.toggleAttribute("data-first", first && Boolean(items.length));
    view.grid.toggleAttribute("data-columns", columns !== undefined);
    view.grid.style.setProperty("--room-columns", columns ?? 2);

    const { on, unavailable } = room.totals[group];
    const controllable = CONTROL_GROUPS.includes(group);
    let value = group === "covers" ? text.countOpen(on) : text.countOn(on);
    let tone = on ? (group === "switches" ? "info" : "warn")
      : (controllable || unavailable ? "quiet" : "good");
    if (group === "security") {
      const openings = items.filter((item) => item.securityType === "opening");
      const open = openings.filter(isActive).length;
      value = securityStatus(Boolean(openings.length), open, on, unavailable, text);
      if (open) tone = "danger";
      view.node.toggleAttribute("data-alert", on > 0);
      view.node.toggleAttribute("data-open", open > 0);
    }
    const status = unavailable ? `${value} · ${text.countUnavailable(unavailable)}` : value;
    const label = `${text[group]} · ${status}`;
    const display = unavailable && (group !== "security" || on) ? `${value} · ?` : value;
    const actionLabel = controllable ? `${text.allOff[group]} · ${label}` : label;
    if (this._badges[group]) {
      const visible = group === "security" ? Boolean(items.length) : on > 0;
      updateChip(this._badges[group], display, tone, group === "lights" ? actionLabel : label, visible);
    }
    updateChip(view.badge, display, tone, actionLabel, controllable ? on > 0 : Boolean(items.length));
    if (controllable) {
      const disabled = !on || room.active[group].some((id) => this._pending.has(id));
      view.badge.node.disabled = disabled;
      if (group === "lights") this._badges.lights.node.disabled = disabled;
    }
    orderChildren(view.grid, items.map((item) => this._updateTile(item, text)));
  }

  _newTile(item) {
    const id = item.entity;
    const symbol = glyph("mdi:circle-outline");
    const name = element("span", "tile-name");
    const state = element("span", "tile-state");
    const main = button("tile-main", () => this._activate(id), symbol, element("span", "tile-text", name, state));
    const details = button("details", () => this._moreInfo(id), icon("mdi:information-outline"));
    const node = element("div", "tile", main, details);
    node.dataset.entity = id;
    const view = { node, symbol, name, state, main, details };
    if (item.group === "covers") {
      view.coverButtons = coverControls.map((action) =>
        button("cover-action", () => this._runCover(id, action), icon(action.icon)));
      node.append(element("div", "cover-actions", ...view.coverButtons));
    }
    if (id.startsWith("light.")) {
      enableBrightnessDrag(main, view, (level) => {
        view.preview = level;
        this._queueRender();
      }, (level) => this._dim(id, level, view), () => {
        view.preview = undefined;
        this._queueRender();
      });
    }
    this._tiles.set(id, view);
    return view;
  }

  _updateTile(item, text) {
    const view = this._tiles.get(item.entity) ?? this._newTile(item);
    const on = isActive(item);
    const cover = item.group === "covers";
    const available = cover ? isCoverAvailable(item.state) : isAvailable(item.state);
    const controllable = CONTROL_GROUPS.includes(item.group);
    const pending = this._pending.has(item.entity);
    view.node.dataset.group = item.group;
    view.node.toggleAttribute("data-sensor", item.group === "security");
    view.node.toggleAttribute("data-open", item.securityType === "opening" && on);
    view.node.toggleAttribute("data-active", on);
    view.node.toggleAttribute("data-unavailable", !available);
    view.symbol.firstChild.setAttribute("icon", tileIcon(item));
    view.name.textContent = item.name;
    view.main.disabled = controllable ? !available || pending : !item.state;
    if (controllable) view.main.setAttribute("aria-pressed", String(on));
    else view.main.removeAttribute("aria-pressed");
    view.details.hidden = !controllable || !item.state;
    view.details.title = `${item.name} · ${text.moreInfo}`;
    view.details.setAttribute("aria-label", view.details.title);

    view.dimmable = this._config?.show_brightness !== false && item.group === "lights"
      && supportsBrightness(item.entity, item.state);
    view.node.toggleAttribute("data-dimmable", view.dimmable);
    if (view.dimmable) {
      const brightness = item.state.attributes.brightness;
      view.level = on && Number.isFinite(brightness) ? Math.round(brightness * 100 / 255) : 0;
      view.main.setAttribute("aria-keyshortcuts", "ArrowLeft ArrowRight ArrowUp ArrowDown Home End");
    } else {
      view.level = cover && available ? item.state.attributes?.current_position : undefined;
      view.main.removeAttribute("aria-keyshortcuts");
    }
    if (view.coverButtons) {
      for (const [index, action] of coverControls.entries()) {
        const control = view.coverButtons[index];
        control.hidden = !(item.state?.attributes?.supported_features & action.feature);
        control.disabled = pending || !canRunCover(item, action);
        control.title = `${text.coverActions[action.key]} · ${item.name}`;
        control.setAttribute("aria-label", control.title);
      }
      view.coverButtons[0].parentElement.hidden = view.coverButtons.every((control) => control.hidden);
    }
    const level = view.preview ?? view.level;
    view.node.toggleAttribute("data-level", Number.isFinite(level));
    view.node.style.setProperty("--level", `${Math.min(100, Math.max(0, level ?? 0))}%`);
    view.state.textContent = Number.isFinite(level) && (available || view.preview !== undefined)
      ? `${tileState(item, text)} · ${level}%` : tileState(item, text);
    return view.node;
  }

  _currentItem(id) {
    const room = this._hass && this._config && buildRoom(this._hass, this._config);
    return room && Object.values(room.groups).flat().find((item) => item.entity === id);
  }

  _moreInfo(id) {
    if (!this._currentItem(id)?.state) return;
    this._openEntity(id);
  }

  _openEntity(entityId, view) {
    this.dispatchEvent(new CustomEvent("hass-more-info", {
      detail: view ? { entityId, view } : { entityId }, bubbles: true, composed: true,
    }));
  }

  _showHistory(kind) {
    const id = this._room?.measurements[kind].id;
    if (id) this._openEntity(id, "history");
  }

  _resetRange() {
    if (!this._room) return;
    this._temperatureRange.reset(this._room.measurements.temperature);
    this._queueRender();
  }

  _activate(id) {
    const item = this._currentItem(id);
    if (!item?.state) return;
    if (!CONTROL_GROUPS.includes(item.group)) {
      this._moreInfo(id);
    } else if (isAvailable(item.state)) {
      this._service("homeassistant", "toggle", [id]);
    }
  }

  async _dim(id, percentage, view) {
    const item = this._currentItem(id);
    if (this._config?.show_brightness !== false && item?.group === "lights"
        && isAvailable(item.state) && supportsBrightness(id, item.state)) {
      view.preview = percentage;
      if (percentage === 0) await this._service("light", "turn_off", [id]);
      else await this._service("light", "turn_on", [id], { brightness_pct: percentage });
    }
    view.preview = undefined;
    this._queueRender();
  }

  _runCover(id, action) {
    const item = this._currentItem(id);
    if (item?.group === "covers" && canRunCover(item, action)) this._service("cover", action.service, [id]);
  }

  _allOff(group) {
    const room = this._hass && this._config && buildRoom(this._hass, this._config);
    this._service("homeassistant", "turn_off", room?.active[group] ?? []);
  }

  async _service(domain, service, ids, data = {}) {
    if (!ids.length || ids.some((id) => this._pending.has(id))) return;
    for (const id of ids) this._pending.add(id);
    this._error = false;
    this._queueRender();
    try {
      await this._hass.callService(domain, service, data, { entity_id: ids });
    } catch {
      this._error = true;
    } finally {
      for (const id of ids) this._pending.delete(id);
      this._queueRender();
    }
  }
}

if (!customElements.get(CARD_TYPE)) customElements.define(CARD_TYPE, RoomManagerCard);
if (!customElements.get(`${CARD_TYPE}-editor`)) customElements.define(`${CARD_TYPE}-editor`, RoomManagerEditor);
window.customCards ??= [];
if (!window.customCards.some((card) => card.type === CARD_TYPE)) {
  const text = labels();
  window.customCards.push({ type: CARD_TYPE, name: text.card, description: text.description, preview: true });
}
