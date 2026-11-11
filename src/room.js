export const CARD_TYPE = "ha-room-manager-card";
export const GROUPS = ["covers", "lights", "switches", "security"];
export const CONTROL_GROUPS = ["lights", "switches"];
export const MEASUREMENTS = ["temperature", "humidity"];

const configGroups = [...GROUPS, "presence", "openings"];
const presenceClasses = new Set(["occupancy", "presence", "motion"]);
const openingClasses = new Set(["door", "window", "opening", "garage_door"]);
const coverStates = new Set(["open", "opening", "closed", "closing"]);
const dimmableModes = new Set(["brightness", "color_temp", "hs", "rgb", "rgbw", "rgbww", "white", "xy"]);

export function domain(entityId) {
  return entityId.split(".", 1)[0];
}

export function acceptsEntity(group, entityId) {
  const kind = domain(entityId);
  switch (group) {
    case "covers":
      return kind === "cover";
    case "lights":
      return kind === "light" || kind === "switch";
    case "switches":
      return kind === "switch";
    default:
      return kind === "binary_sensor";
  }
}

export function includeId(entry) {
  return typeof entry === "string" ? entry : entry.entity;
}

export function normalizeConfig(config) {
  const { presence, openings, ...include } = config.include ?? {};
  const { presence: presenceColumns, openings: openingColumns, ...columns } = config.columns ?? {};
  if (!presence && !openings && presenceColumns === undefined && openingColumns === undefined) return config;
  const entries = [...(include.security ?? []), ...(presence ?? []), ...(openings ?? [])];
  if (entries.length) {
    const seen = new Set();
    include.security = entries.filter((entry) => {
      const id = includeId(entry);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }
  const securityColumns = columns.security ?? presenceColumns ?? openingColumns;
  if (securityColumns !== undefined) columns.security = securityColumns;
  return { ...config, include, columns };
}

function entityId(value) {
  return typeof value === "string" && /^[a-z0-9_]+\.[a-z0-9_]+$/.test(value);
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

export function validateConfig(config) {
  if (!isObject(config)) throw new Error("Room Manager configuration must be an object.");
  for (const key of ["area", "title", "icon"]) {
    if (config[key] !== undefined && typeof config[key] !== "string") {
      throw new Error(`${key} must be a string.`);
    }
  }
  for (const key of ["show_brightness", "include_hidden", "show_temperature_chart", "show_humidity_chart"]) {
    if (config[key] !== undefined && typeof config[key] !== "boolean") {
      throw new Error(`${key} must be a boolean.`);
    }
  }
  for (const kind of MEASUREMENTS) {
    const key = `${kind}_entity`;
    if (config[key] !== undefined && !(entityId(config[key]) && domain(config[key]) === "sensor")) {
      throw new Error(`${key} must be a sensor entity ID.`);
    }
  }
  if (config.exclude !== undefined && !(Array.isArray(config.exclude) && config.exclude.every(entityId))) {
    throw new Error("exclude must be a list of entity IDs.");
  }
  if (config.columns !== undefined && (!isObject(config.columns) ||
      Object.entries(config.columns).some(([group, value]) =>
        !configGroups.includes(group) || !Number.isInteger(value) || value < 1 || value > 4))) {
    throw new Error("columns must specify a column count from 1 to 4 for each configured section.");
  }
  if (config.include === undefined) return;
  if (!isObject(config.include)) throw new Error("include must be an object.");

  for (const [group, entries] of Object.entries(config.include)) {
    if (!configGroups.includes(group) || !Array.isArray(entries)) {
      throw new Error(`Invalid include group: ${group}.`);
    }
    for (const entry of entries) {
      const id = typeof entry === "string" ? entry : entry?.entity;
      if (!entityId(id) || !acceptsEntity(group, id)) {
        throw new Error(`Invalid entity in include.${group}.`);
      }
      if (typeof entry !== "string" && (!isObject(entry) || ["name", "icon"].some(
        (key) => entry[key] !== undefined && typeof entry[key] !== "string",
      ))) {
        throw new Error(`Invalid name or icon in include.${group}.`);
      }
    }
  }
}

export function areaForEntity(hass, entry) {
  if (entry?.area_id) return entry.area_id;
  const device = entry?.device_id && hass.devices?.[entry.device_id];
  return device?.area_id || hass.devices?.[device?.parent_device_id]?.area_id || undefined;
}

function disabled(entry) {
  return Boolean(entry?.disabled_by || entry?.disabled);
}

export function isAvailable(state) {
  return state?.state === "on" || state?.state === "off";
}

export function isCoverAvailable(state) {
  return coverStates.has(state?.state);
}

export function isActive(item) {
  if (item.group === "covers") return isCoverAvailable(item.state) && item.state.state !== "closed";
  return item.state?.state === "on";
}

export function supportsBrightness(id, state) {
  return domain(id) === "light" && Boolean(
    state?.attributes?.supported_color_modes?.some((mode) => dimmableModes.has(mode)),
  );
}

export function entityName(hass, id, state = hass.states?.[id]) {
  const kind = domain(id);
  const sensorName = (kind === "sensor" || kind === "binary_sensor") && state?.attributes?.friendly_name;
  return sensorName || (state && hass.formatEntityName?.(state))
    || state?.attributes?.friendly_name
    || hass.entities?.[id]?.name
    || id;
}

function securityType(deviceClass) {
  if (openingClasses.has(deviceClass)) return "opening";
  if (presenceClasses.has(deviceClass)) return "presence";
  return undefined;
}

function deviceClassFor(state, entry) {
  return state?.attributes?.device_class ?? entry?.device_class ?? entry?.original_device_class;
}

export function discoverRoom(hass, areaId, includeHidden = false) {
  const found = new Map();
  if (!areaId || !hass.areas?.[areaId]) return found;

  const registry = hass.entities ?? {};
  for (const [id, entry] of Object.entries(registry)) {
    if (disabled(entry) || (!includeHidden && (entry.hidden || entry.hidden_by))
        || areaForEntity(hass, entry) !== areaId) continue;
    const kind = domain(id);
    const state = hass.states?.[id];
    const members = state?.attributes?.entity_id;
    // Aggregates can report a state or operate devices in other rooms.
    if (entry.platform === "group" || Array.isArray(members)) continue;
    if (kind === "binary_sensor") {
      if (securityType(deviceClassFor(state, entry))) found.set(id, "security");
    } else if (!entry.entity_category && (kind === "light" || kind === "switch" || kind === "cover")) {
      found.set(id, kind === "switch" ? "switches" : `${kind}s`);
    }
  }
  return found;
}

export function numberFromState(value) {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function measurement(hass, config, area, kind) {
  const id = config[`${kind}_entity`] ?? area[`${kind}_entity_id`];
  const entry = hass.entities?.[id];
  if (!id || disabled(entry) || (!entry && !hass.states?.[id])) {
    return { id: undefined, unit: undefined, value: undefined, display: undefined };
  }
  const state = hass.states?.[id];
  const value = numberFromState(state?.state);
  const unit = state?.attributes?.unit_of_measurement;
  const display = value === undefined ? undefined : hass.formatEntityState?.(state)
    ?? [state.state, unit].filter(Boolean).join(" ");
  return { id, unit, value, display };
}

export function buildRoom(hass, config) {
  config = normalizeConfig(config);
  const area = config.area && hass.areas?.[config.area];
  if (!area) return undefined;

  const selected = new Map();
  for (const group of GROUPS) {
    for (const entry of config.include?.[group] ?? []) {
      const item = typeof entry === "string" ? { entity: entry } : entry;
      if (!selected.has(item.entity)) selected.set(item.entity, { ...item, group });
    }
  }
  const excluded = new Set(config.exclude);
  for (const [entity, group] of discoverRoom(hass, config.area, config.include_hidden)) {
    if (!selected.has(entity) && !excluded.has(entity)) selected.set(entity, { entity, group });
  }

  const groups = Object.fromEntries(GROUPS.map((group) => [group, []]));
  for (const item of selected.values()) {
    const registry = hass.entities?.[item.entity];
    const state = disabled(registry) ? undefined : hass.states?.[item.entity];
    const deviceClass = deviceClassFor(state, registry);
    groups[item.group].push({
      ...item,
      state,
      deviceClass,
      securityType: item.group === "security" ? securityType(deviceClass) : undefined,
      name: item.name || entityName(hass, item.entity, state),
      icon: item.icon || state?.attributes?.icon || registry?.icon,
    });
  }
  const names = new Intl.Collator(hass.locale?.language || hass.language, { numeric: true });
  for (const entries of Object.values(groups)) {
    entries.sort((a, b) => names.compare(a.name, b.name));
  }
  const totals = Object.fromEntries(GROUPS.map((group) => [group, {
    on: groups[group].filter(isActive).length,
    unavailable: groups[group].filter((item) => !(group === "covers" ? isCoverAvailable : isAvailable)(item.state)).length,
  }]));
  return {
    area,
    groups,
    totals,
    active: Object.fromEntries(CONTROL_GROUPS.map((group) => [
      group, groups[group].filter((item) => item.state?.state === "on").map((item) => item.entity),
    ])),
    measurements: Object.fromEntries(MEASUREMENTS.map((kind) => [
      kind, measurement(hass, config, area, kind),
    ])),
  };
}
