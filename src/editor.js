import { CARD_TYPE, GROUPS, MEASUREMENTS, acceptsEntity, discoverRoom, entityName, validateConfig } from "./room.js";
import { applyThemeMode, button, element, mount, orderChildren } from "./dom.js";
import { editorStyles } from "./styles.js";
import { labels } from "./text.js";

function inputField(label, onChange) {
  const input = element("input");
  input.type = "text";
  input.addEventListener("change", () => onChange(input.value.trim()));
  return { input, node: element("label", null, element("span", null, label), input) };
}

function panel(title, ...children) {
  return element("details", null, element("summary", null, title), element("div", "panel", ...children));
}

function setOptions(select, options, selected) {
  const signature = JSON.stringify(options);
  if (signature !== select.optionSignature) {
    select.replaceChildren(...options.map(([value, label]) => {
      const option = element("option", null, label);
      option.value = value;
      return option;
    }));
    select.optionSignature = signature;
  }
  if (select.value !== selected) select.value = selected;
}

class EntityPicker {
  constructor(label, placeholder, onChange, action) {
    this.allowed = new Set();
    this.picker = element("ha-entity-picker");
    this.picker.label = label;
    this.picker.placeholder = placeholder;
    this.picker.showEntityId = true;
    if (action) {
      this.action = button(null, () => {
        const id = this.picker.value;
        if (!this.allowed.has(id)) return;
        this.picker.value = undefined;
        onChange(id);
      }, action);
      this.action.disabled = true;
    }
    this.node = this.action ? element("div", "field-row", this.picker, this.action) : this.picker;
    this.picker.addEventListener("value-changed", (event) => {
      event.stopPropagation();
      const id = event.detail.value;
      if (this.action) this.action.disabled = !this.allowed.has(id);
      else if (!id || this.allowed.has(id)) onChange(id);
    });
  }

  update(hass, ids, selected = this.action ? this.picker.value : undefined) {
    this.picker.hass = hass;
    const previous = this.picker.includeEntities;
    if (previous?.length !== ids.length || ids.some((id, index) => id !== previous[index])) {
      this.picker.includeEntities = ids;
      this.allowed = new Set(ids);
    }
    if (this.action && !this.allowed.has(selected)) selected = undefined;
    if (this.picker.value !== selected) this.picker.value = selected;
    if (this.action) this.action.disabled = !selected;
  }
}

function normalize(entries) {
  return entries.map((entry) => typeof entry === "string" ? { entity: entry } : entry);
}

export class RoomManagerEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  setConfig(config) {
    validateConfig(config);
    this._config = config;
    this._queueRender();
  }

  set hass(hass) {
    this._hass = hass;
    this._queueRender();
  }

  connectedCallback() {
    this._queueRender();
  }

  _queueRender() {
    if (this._renderQueued) return;
    this._renderQueued = true;
    queueMicrotask(() => {
      this._renderQueued = false;
      if (this.isConnected && this._hass && this._config) this._render();
    });
  }

  _mount(text) {
    this._text = text;
    this._area = element("select");
    this._area.addEventListener("change", () => this._setField("area", this._area.value));
    const area = element("label", null, element("span", null, text.room), this._area);
    this._title = inputField(text.title, (value) => this._setField("title", value));
    this._icon = inputField(text.icon, (value) => this._setField("icon", value));
    this._icon.input.placeholder = "mdi:sofa-outline";

    this._measurements = Object.fromEntries(MEASUREMENTS.map((kind) => {
      const pick = new EntityPicker(text[kind], text.defaultSensor,
        (id) => this._setField(`${kind}_entity`, id));
      return [kind, pick];
    }));
    this._groups = Object.fromEntries(GROUPS.map((group) => {
      const pick = new EntityPicker(text[group], text.chooseEntity,
        (id) => this._add(group, id), text.add);
      const entries = element("div", "entries");
      const columns = element("select");
      columns.setAttribute("aria-label", `${text[group]} · ${text.columns}`);
      columns.addEventListener("change", () => this._setColumns(group, columns.value));
      const field = element("label", null, element("span", null, text.columns), columns);
      return [group, { pick, entries, columns, node: panel(text[group], field, pick.node, entries) }];
    }));
    const exclude = new EntityPicker(text.exclusions, text.chooseEntity, (id) => {
      this._setList("exclude", [...(this._config.exclude ?? []), id]);
    }, text.exclude);
    this._exclusions = { pick: exclude, entries: element("div", "entries") };
    this._overrides = element("div", "overrides");
    this._rows = new Map();
    const form = element("form", null,
      area, this._title.node, ...MEASUREMENTS.map((kind) => this._measurements[kind].node),
      ...GROUPS.map((group) => this._groups[group].node),
      panel(text.exclusions, exclude.node, this._exclusions.entries),
      panel(text.advanced, this._icon.node, this._overrides),
    );
    form.addEventListener("submit", (event) => event.preventDefault());
    mount(this.shadowRoot, editorStyles, form);
  }

  _render() {
    const hass = this._hass;
    applyThemeMode(this, hass);
    const config = this._config;
    const text = labels(hass);
    if (text !== this._text) this._mount(text);

    const names = new Intl.Collator(hass.locale?.language || hass.language, { numeric: true });
    const sort = ([, a], [, b]) => names.compare(a, b);
    const areas = Object.values(hass.areas ?? {}).map((area) => [area.area_id, area.name]).sort(sort);
    if (config.area && !areas.some(([id]) => id === config.area)) areas.push([config.area, config.area]);
    setOptions(this._area, [["", text.chooseRoom], ...areas], config.area ?? "");
    this._syncInput(this._title.input, config.title);
    this._syncInput(this._icon.input, config.icon);

    const states = Object.keys(hass.states ?? {}).filter((id) => !hass.entities?.[id]?.disabled_by);
    const exclude = new Set(config.exclude);
    const allIncluded = new Set(GROUPS.flatMap((group) => normalize(config.include?.[group] ?? []))
      .map((entry) => entry.entity));

    for (const kind of MEASUREMENTS) {
      const selected = config[`${kind}_entity`];
      const ids = states.filter((id) => id === selected || (
        id.startsWith("sensor.") && hass.states[id].attributes?.device_class === kind));
      this._measurements[kind].update(hass, ids, selected);
    }
    const overrideRows = [];
    const retained = new Set();
    for (const group of GROUPS) {
      const entries = normalize(config.include?.[group] ?? []);
      const ids = new Set(entries.map((entry) => entry.entity));
      const view = this._groups[group];
      view.pick.update(hass, states.filter((id) => acceptsEntity(group, id) && !ids.has(id)));
      setOptions(view.columns, [["", text.automatic], ...["1", "2", "3", "4"].map((count) => [count, count])],
        String(config.columns?.[group] ?? ""));
      const rows = [];
      for (const id of ids) {
        const key = `${group}:${id}`;
        const entry = entries.find((item) => item.entity === id);
        const row = this._row(key, id, text.remove, () => this._remove(group, id), group);
        row.name.textContent = entry.name || entityName(hass, id);
        row.name.title = id;
        row.overrideTitle.textContent = `${text[group]} · ${entityName(hass, id)}`;
        this._syncInput(row.overrideName, entry.name);
        this._syncInput(row.overrideIcon, entry.icon);
        rows.push(row.node);
        overrideRows.push(row.override);
        retained.add(key);
      }
      orderChildren(view.entries, rows);
    }
    orderChildren(this._overrides, overrideRows);
    const automatic = [...discoverRoom(hass, config.area).keys()];
    this._exclusions.pick.update(hass, automatic.filter((id) => !exclude.has(id) && !allIncluded.has(id)));
    orderChildren(this._exclusions.entries, [...exclude].map((id) => {
      const key = `exclude:${id}`;
      retained.add(key);
      const row = this._row(key, id, text.restore, () => {
        this._setList("exclude", (this._config.exclude ?? []).filter((entry) => entry !== id));
      });
      row.name.textContent = entityName(hass, id);
      row.name.title = id;
      return row.node;
    }));
    for (const key of this._rows.keys()) {
      if (!retained.has(key)) this._rows.delete(key);
    }
  }

  _row(key, id, action, callback, group) {
    if (this._rows.has(key)) return this._rows.get(key);
    const name = element("span", "saved-name");
    const control = button(null, callback, action);
    control.setAttribute("aria-label", `${action} · ${id}`);
    const row = { name, node: element("div", "saved-row", name, control) };
    if (group) {
      const nameField = inputField(this._text.name, (value) => this._override(group, id, "name", value));
      const iconField = inputField(this._text.icon, (value) => this._override(group, id, "icon", value));
      row.overrideName = nameField.input;
      row.overrideIcon = iconField.input;
      row.overrideTitle = element("span", "saved-name");
      row.override = element("div", "override-row", row.overrideTitle,
        element("div", "override-fields", nameField.node, iconField.node));
    }
    this._rows.set(key, row);
    return row;
  }

  _syncInput(input, value = "") {
    if (this.shadowRoot.activeElement !== input && input.value !== value) input.value = value;
  }

  _setField(key, value) {
    const config = { ...this._config };
    if (value) config[key] = value;
    else delete config[key];
    this._change(config);
  }

  _setList(key, entries) {
    this._setField(key, entries.length ? entries : undefined);
  }

  _setColumns(group, value) {
    const columns = { ...this._config.columns };
    if (value) columns[group] = Number(value);
    else delete columns[group];
    this._setField("columns", Object.keys(columns).length ? columns : undefined);
  }

  _add(group, id) {
    const include = {};
    let existing;
    for (const key of GROUPS) {
      const entries = this._config.include?.[key] ?? [];
      existing ??= normalize(entries).find((entry) => entry.entity === id);
      include[key] = entries.filter((entry) => (entry.entity ?? entry) !== id);
    }
    include[group].push(existing?.name || existing?.icon ? existing : id);
    this._setInclude(include);
  }

  _remove(group, id) {
    const include = { ...this._config.include };
    include[group] = include[group].filter((entry) => (entry.entity ?? entry) !== id);
    this._setInclude(include);
  }

  _override(group, id, field, value) {
    const include = { ...this._config.include };
    include[group] = include[group].map((entry) => {
      if ((entry.entity ?? entry) !== id) return entry;
      const item = typeof entry === "string" ? { entity: entry } : { ...entry };
      if (value) item[field] = value;
      else delete item[field];
      return item.name || item.icon ? item : item.entity;
    });
    this._setInclude(include);
  }

  _setInclude(include) {
    const groups = Object.fromEntries(Object.entries(include).filter(([, entries]) => entries.length));
    this._setField("include", Object.keys(groups).length ? groups : undefined);
  }

  _change(config) {
    config.type = `custom:${CARD_TYPE}`;
    this._config = config;
    this._queueRender();
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config }, bubbles: true, composed: true,
    }));
  }
}
