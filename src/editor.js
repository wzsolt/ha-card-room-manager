import { CARD_TYPE, GROUPS, MEASUREMENTS, acceptsEntity, discoverRoom, entityName, includeId, normalizeConfig, validateConfig } from "./room.js";
import { applyThemeMode, element, mount } from "./dom.js";
import { editorStyles } from "./styles.js";
import { labels } from "./text.js";

const expandable = (name, title, schema) => ({ name, type: "expandable", title, schema });
const entityField = (name, entity) => ({ name, selector: { entity } });

function entriesFor(config, group) {
  return config.include?.[group] ?? [];
}

function trimText(value) {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

export class RoomManagerEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._form = element("ha-form");
    this._form.addEventListener("value-changed", (event) => {
      event.stopPropagation();
      this._change(event.detail.value);
    });
    mount(this.shadowRoot, editorStyles, this._form);
  }

  setConfig(config) {
    validateConfig(config);
    this._config = normalizeConfig(config);
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

  _render() {
    const hass = this._hass;
    const config = this._config;
    const text = labels(hass);
    applyThemeMode(this, hass);
    this._form.hass = hass;

    const automatic = discoverRoom(hass, config.area, config.include_hidden);
    const exclusions = config.exclude ?? [];
    const states = Object.keys(hass.states ?? {});
    const columnOptions = [
      { value: "auto", label: text.automatic },
      ...["1", "2", "3", "4"].map((value) => ({ value, label: value })),
    ];
    const data = { area: config.area, title: config.title, advanced: {
      icon: config.icon,
      include_hidden: config.include_hidden ?? false,
      other_excluded: exclusions.filter((id) => !automatic.has(id)),
    } };
    const schema = [{ name: "area", selector: { area: {} } }, { name: "title", selector: { text: {} } }];
    for (const kind of MEASUREMENTS) {
      const name = `${kind}_entity`;
      const showChart = `show_${kind}_chart`;
      data[name] = config[name];
      data[showChart] = config[showChart] ?? false;
      schema.push(entityField(name, { filter: { domain: "sensor", device_class: kind } }));
      schema.push({ name: showChart, selector: { boolean: {} } });
    }

    this._overrides = [];
    for (const group of GROUPS) {
      const entries = entriesFor(config, group);
      const added = entries.map(includeId);
      const candidates = [...automatic].filter(([, section]) => section === group).map(([id]) => id);
      const settings = data[group] = {
        columns: String(config.columns?.[group] ?? "auto"),
        added,
        excluded: exclusions.filter((id) => automatic.get(id) === group),
      };
      const fields = [
        { name: "columns", selector: { select: { mode: "dropdown", options: columnOptions } } },
      ];
      if (group === "lights") {
        settings.show_brightness = config.show_brightness !== false;
        fields.push({ name: "show_brightness", selector: { boolean: {} } });
      }
      fields.push(
        entityField("added", { multiple: true, include_entities: [...new Set([
          ...states.filter((id) => acceptsEntity(group, id)), ...added,
        ])] }),
        entityField("excluded", { multiple: true, include_entities: candidates }),
      );
      schema.push(expandable(group, text[group], fields));
      for (const entry of entries) this._overrides.push({ group, entry });
    }

    const advanced = [
      { name: "icon", selector: { icon: {} } },
      { name: "include_hidden", selector: { boolean: {} } },
    ];
    if (data.advanced.other_excluded.length) {
      advanced.push(entityField("other_excluded", { multiple: true, include_entities: data.advanced.other_excluded }));
    }
    for (const [index, { group, entry }] of this._overrides.entries()) {
      const id = includeId(entry);
      const nameKey = `override_name_${index}`;
      const iconKey = `override_icon_${index}`;
      data.advanced[nameKey] = entry.name;
      data.advanced[iconKey] = entry.icon;
      advanced.push({
        ...expandable(`override_${index}`, `${text[group]} · ${entityName(hass, id)}`, [
          { name: nameKey, selector: { text: {} } },
          { name: iconKey, selector: { icon: {} } },
        ]),
        flatten: true,
      });
    }
    schema.push(expandable("advanced", text.advanced, advanced));

    const signature = JSON.stringify(schema);
    if (signature !== this._schemaSignature) {
      this._schemaSignature = signature;
      this._form.computeHelper = ({ name }) => text.editorHelp[name] ?? "";
      this._form.computeLabel = ({ name }) => {
        if (name.startsWith("override_name_")) return text.name;
        if (name.startsWith("override_icon_")) return text.icon;
        return text.editorLabels[name] ?? text[name] ?? name;
      };
      this._form.schema = schema;
    }
    const dataSignature = JSON.stringify(data);
    if (dataSignature !== this._dataSignature) {
      this._dataSignature = dataSignature;
      this._form.data = data;
    }
  }

  _change(data) {
    const config = { ...this._config, type: `custom:${CARD_TYPE}` };
    const advanced = data.advanced ?? {};
    const include = {};
    const columns = {};
    const excluded = new Set(advanced.other_excluded);
    const overrides = new Map();
    for (const [index, { entry }] of this._overrides.entries()) {
      const id = includeId(entry);
      const nameKey = `override_name_${index}`;
      const iconKey = `override_icon_${index}`;
      const name = trimText(Object.hasOwn(advanced, nameKey) ? advanced[nameKey] : entry.name);
      const icon = trimText(Object.hasOwn(advanced, iconKey) ? advanced[iconKey] : entry.icon);
      if (name || icon) overrides.set(id, { entity: id, ...(name && { name }), ...(icon && { icon }) });
    }

    const moved = new Map();
    for (const group of GROUPS) {
      const previous = new Set(entriesFor(config, group).map(includeId));
      for (const id of data[group]?.added ?? []) {
        if (!previous.has(id)) moved.set(id, group);
      }
    }
    for (const group of GROUPS) {
      const settings = data[group] ?? {};
      const ids = [...new Set(settings.added)].filter((id) => !moved.has(id) || moved.get(id) === group);
      if (ids.length) include[group] = ids.map((id) => overrides.get(id) ?? id);
      if (["1", "2", "3", "4"].includes(settings.columns)) columns[group] = Number(settings.columns);
      for (const id of settings.excluded ?? []) excluded.add(id);
    }

    const fields = {
      area: trimText(data.area), title: trimText(data.title), icon: trimText(advanced.icon),
      temperature_entity: trimText(data.temperature_entity), humidity_entity: trimText(data.humidity_entity),
      show_temperature_chart: data.show_temperature_chart === true ? true : undefined,
      show_humidity_chart: data.show_humidity_chart === true ? true : undefined,
      show_brightness: data.lights?.show_brightness === false ? false : undefined,
      include_hidden: advanced.include_hidden || undefined,
      include: Object.keys(include).length ? include : undefined,
      columns: Object.keys(columns).length ? columns : undefined,
      exclude: excluded.size ? [...excluded] : undefined,
    };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) config[key] = value;
      else delete config[key];
    }
    this._config = config;
    this._queueRender();
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config }, bubbles: true, composed: true,
    }));
  }
}
