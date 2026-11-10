import { CARD_TYPE, CONTROL_GROUPS, GROUPS, MEASUREMENTS, buildRoom, isAvailable, supportsBrightness, validateConfig } from "./room.js";
import { applyThemeMode, button, element, icon, mount, orderChildren } from "./dom.js";
import { cardStyles } from "./styles.js";
import { labels } from "./text.js";
import { RoomManagerEditor } from "./editor.js";
import { TemperatureRange } from "./temperature.js";

const glyphs = {
  presence: "mdi:run",
  openings: "mdi:door-closed",
  lights: "mdi:lightbulb-group-outline",
  switches: "mdi:power-socket-eu",
};

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
  if (item.group !== "openings") return glyphs[item.group];
  switch (item.state?.attributes?.device_class) {
    case "window": return "mdi:window-closed-variant";
    case "garage_door": return "mdi:garage";
    default: return glyphs.openings;
  }
}

function tileState(item, text) {
  if (!isAvailable(item.state)) return item.state?.state === "unknown" ? text.unknown : text.unavailable;
  const on = item.state.state === "on";
  if (item.group === "openings") return on ? text.open : text.closed;
  if (item.group === "presence") return on ? text.active : text.inactive;
  return on ? text.on : text.off;
}

class RoomManagerCard extends HTMLElement {
  static getStubConfig() {
    return {};
  }

  static async getConfigElement() {
    if (!customElements.get("ha-entity-picker")) {
      // The built-in Entities editor loads the shared entity picker on demand.
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
  }

  setConfig(config) {
    validateConfig(config);
    this._config = config;
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

  getCardSize() {
    if (!this._room) return 2;
    return 2 + GROUPS.reduce((rows, group) => {
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
      temperature: chip("mdi:thermometer", () => this._showHistory("temperature")),
      range: chip("mdi:restore", () => this._resetRange()),
      humidity: chip("mdi:water-percent", () => this._showHistory("humidity")),
      presence: chip(glyphs.presence),
      openings: chip(glyphs.openings),
      lights: chip("mdi:lightbulb", () => this._allOff("lights")),
      switches: chip("mdi:power-socket-eu"),
    };

    this._sections = Object.fromEntries(GROUPS.map((group) => {
      const grid = element("div", "grid");
      const action = CONTROL_GROUPS.includes(group) ? () => this._allOff(group) : undefined;
      const badge = chip(action ? "mdi:power" : glyphs[group], action);
      return [group, { ...section(group, grid, badge), grid, badge }];
    }));
    this._sectionList = element("div", "sections", ...Object.values(this._sections).map(({ node }) => node));
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
      this._message.textContent = config.area && hass?.areas ? text.missingArea : text.selectArea;
      return;
    }

    this._updateMeasurements(room, text);
    let first = true;
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
      updateChip(badge, display ?? "—", "info", `${text[kind]} · ${display ?? text.noReading}`);
      badge.node.disabled = !id;
    }
    const range = this._temperatureRange.update(this._hass, room.area.area_id, room.measurements.temperature);
    const formatter = new Intl.NumberFormat(this._hass.locale?.language || this._hass.language, {
      maximumFractionDigits: 2,
    });
    const display = range ? text.minMax(formatter.format(range.min), formatter.format(range.max), range.unit ?? "") : "";
    updateChip(this._badges.range, display, "quiet", `${text.resetRange} · ${display}`, Boolean(range));
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
    let value = group === "openings" ? text.countOpen(on) : text.countOn(on);
    const tone = on ? (group === "switches" ? "info" : "warn")
      : (controllable || unavailable ? "quiet" : "good");
    if (group === "presence") {
      value = on ? text.detected : unavailable ? text.uncertain : text.clear;
    }
    const status = unavailable ? `${value} · ${text.countUnavailable(unavailable)}` : value;
    const label = `${text[group]} · ${status}`;
    const display = unavailable && group !== "presence" ? `${value} · ?` : value;
    const actionLabel = controllable ? `${text.allOff[group]} · ${label}` : label;
    updateChip(this._badges[group], display, tone, group === "lights" ? actionLabel : label, Boolean(items.length));
    updateChip(view.badge, display, tone, actionLabel, controllable ? on > 0 : Boolean(items.length));
    if (controllable) {
      const disabled = !on || room.active[group].some((id) => this._pending.has(id));
      view.badge.node.disabled = disabled;
      if (group === "lights") this._badges.lights.node.disabled = disabled;
    }
    orderChildren(view.grid, items.map((item) => this._updateTile(item, text)));
  }

  _newTile(id) {
    const symbol = glyph("mdi:circle-outline");
    const name = element("span", "tile-name");
    const state = element("span", "tile-state");
    const main = button("tile-main", () => this._activate(id), symbol, element("span", "tile-text", name, state));
    const details = button("details", () => this._moreInfo(id), icon("mdi:information-outline"));
    const slider = element("input");
    slider.type = "range";
    slider.min = "1";
    slider.max = "100";
    const percentage = element("output");
    const brightness = element("div", "brightness", slider, percentage);
    const node = element("div", "tile", main, details, brightness);
    node.dataset.entity = id;
    const view = { node, symbol, name, state, main, details, slider, percentage, brightness };
    slider.addEventListener("input", () => {
      view.dragging = true;
      percentage.textContent = `${slider.value}%`;
    });
    slider.addEventListener("change", () => {
      view.dragging = false;
      this._dim(id, Number(slider.value), view);
    });
    slider.addEventListener("pointercancel", () => {
      view.dragging = false;
      view.levelKey = undefined;
      this._queueRender();
    });
    this._tiles.set(id, view);
    return view;
  }

  _updateTile(item, text) {
    const view = this._tiles.get(item.entity) ?? this._newTile(item.entity);
    const on = item.state?.state === "on";
    const available = isAvailable(item.state);
    const controllable = CONTROL_GROUPS.includes(item.group);
    const pending = this._pending.has(item.entity);
    view.node.dataset.group = item.group;
    view.node.toggleAttribute("data-sensor", !controllable);
    view.node.toggleAttribute("data-active", on);
    view.node.toggleAttribute("data-unavailable", !available);
    view.symbol.firstChild.setAttribute("icon", tileIcon(item));
    view.name.textContent = item.name;
    view.state.textContent = tileState(item, text);
    view.main.disabled = controllable ? !available || pending : !item.state;
    if (controllable) view.main.setAttribute("aria-pressed", String(on));
    else view.main.removeAttribute("aria-pressed");
    view.details.hidden = !controllable || !item.state;
    view.details.title = `${item.name} · ${text.moreInfo}`;
    view.details.setAttribute("aria-label", view.details.title);

    const dimmable = item.group === "lights" && supportsBrightness(item.entity, item.state);
    view.brightness.hidden = !dimmable;
    view.slider.disabled = !available || pending;
    view.slider.setAttribute("aria-label", `${item.name} · ${text.brightness}`);
    if (dimmable) {
      const brightness = item.state.attributes.brightness;
      const levelKey = `${item.state.state}:${brightness}`;
      if (!view.dragging && view.levelKey !== levelKey) {
        const level = on && Number.isFinite(brightness) ? Math.round(brightness * 100 / 255) : 0;
        view.slider.value = String(Math.max(1, level));
        view.percentage.textContent = on && !Number.isFinite(brightness) ? "—" : `${level}%`;
        view.levelKey = levelKey;
      }
    }
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
    if (item.group === "presence" || item.group === "openings") {
      this._moreInfo(id);
    } else if (isAvailable(item.state)) {
      this._service("homeassistant", "toggle", [id]);
    }
  }

  async _dim(id, percentage, view) {
    const item = this._currentItem(id);
    if (item?.group === "lights" && isAvailable(item.state) && supportsBrightness(id, item.state)) {
      await this._service("light", "turn_on", [id], { brightness_pct: percentage });
    }
    view.levelKey = undefined;
    this._queueRender();
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
