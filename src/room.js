export const CARD_TYPE = "ha-room-manager-card";
export const GROUPS = ["lights", "switches", "presence", "openings"];
export const MEASUREMENTS = ["temperature", "humidity"];

const presenceClasses = new Set(["occupancy", "presence", "motion"]);
const openingClasses = new Set(["door", "window", "opening", "garage_door"]);
const dimmableModes = new Set(["brightness", "color_temp", "hs", "rgb", "rgbw", "rgbww", "white", "xy"]);

export function domain(entityId) {
  return entityId.split(".", 1)[0];
}

export function acceptsEntity(group, entityId) {
  const kind = domain(entityId);
  switch (group) {
    case "lights":
      return kind === "light" || kind === "switch";
    case "switches":
      return kind === "switch";
    default:
      return kind === "binary_sensor";
  }
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
  for (const kind of MEASUREMENTS) {
    const key = `${kind}_entity`;
    if (config[key] !== undefined && !(entityId(config[key]) && domain(config[key]) === "sensor")) {
      throw new Error(`${key} must be a sensor entity ID.`);
    }
  }
  if (config.exclude !== undefined && !(Array.isArray(config.exclude) && config.exclude.every(entityId))) {
    throw new Error("exclude must be a list of entity IDs.");
  }
  if (config.include === undefined) return;
  if (!isObject(config.include)) throw new Error("include must be an object.");

  for (const [group, entries] of Object.entries(config.include)) {
    if (!GROUPS.includes(group) || !Array.isArray(entries)) {
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
  if (entry.area_id) return entry.area_id;
  let deviceId = entry.device_id;
  const visited = new Set();
  while (deviceId && !visited.has(deviceId)) {
    visited.add(deviceId);
    const device = hass.devices?.[deviceId];
    if (device?.area_id) return device.area_id;
    deviceId = device?.parent_device_id;
  }
  return undefined;
}

function disabled(entry) {
  return Boolean(entry?.disabled_by || entry?.disabled);
}

export function isAvailable(state) {
  return state?.state === "on" || state?.state === "off";
}

export function supportsBrightness(id, state) {
  return domain(id) === "light" && Boolean(
    state?.attributes?.supported_color_modes?.some((mode) => dimmableModes.has(mode)),
  );
}

export function entityName(hass, id, state = hass.states?.[id]) {
  return (state && hass.formatEntityName?.(state))
    || state?.attributes?.friendly_name
    || hass.entities?.[id]?.name
    || id;
}

export function discoverRoom(hass, areaId) {
  const found = new Map();
  if (!areaId || !hass.areas?.[areaId]) return found;

  const entries = Object.entries(hass.entities ?? {});
  const cameras = new Set(entries.filter(([id, entry]) => (
    domain(id) === "camera" && entry.device_id && !disabled(entry)
  )).map(([, entry]) => entry.device_id));

  for (const [id, entry] of entries) {
    const state = hass.states?.[id];
    if (!state || disabled(entry) || entry.hidden || entry.hidden_by || entry.entity_category
        || areaForEntity(hass, entry) !== areaId) continue;

    const kind = domain(id);
    if (kind === "light" || kind === "switch") {
      if (entry.platform !== "group" && !Array.isArray(state.attributes?.entity_id)) {
        found.set(id, kind === "light" ? "lights" : "switches");
      }
      continue;
    }

    if (kind !== "binary_sensor") continue;
    const deviceClass = state.attributes?.device_class ?? entry.device_class ?? entry.original_device_class;
    if (openingClasses.has(deviceClass)) found.set(id, "openings");
    if (presenceClasses.has(deviceClass) && !cameras.has(entry.device_id)) found.set(id, "presence");
  }
  return found;
}

export function measurement(hass, config, area, kind) {
  const id = config[`${kind}_entity`] ?? area[`${kind}_entity_id`];
  const state = id && hass.states?.[id];
  if (!state || disabled(hass.entities?.[id])
      || state.state.trim() === "" || !Number.isFinite(Number(state.state))) return undefined;
  const value = hass.formatEntityState?.(state);
  return value ?? [state.state, state.attributes?.unit_of_measurement].filter(Boolean).join(" ");
}

export function buildRoom(hass, config) {
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
  for (const [entity, group] of discoverRoom(hass, config.area)) {
    if (!selected.has(entity) && !excluded.has(entity)) selected.set(entity, { entity, group });
  }

  const groups = Object.fromEntries(GROUPS.map((group) => [group, []]));
  for (const item of selected.values()) {
    const registry = hass.entities?.[item.entity];
    const state = disabled(registry) ? undefined : hass.states?.[item.entity];
    groups[item.group].push({
      ...item,
      state,
      name: item.name || entityName(hass, item.entity, state),
      icon: item.icon || state?.attributes?.icon || registry?.icon,
    });
  }
  const names = new Intl.Collator(hass.locale?.language || hass.language, { numeric: true });
  for (const entries of Object.values(groups)) {
    entries.sort((a, b) => names.compare(a.name, b.name));
  }
  const totals = Object.fromEntries(GROUPS.map((group) => [group, {
    on: groups[group].filter((item) => item.state?.state === "on").length,
    unavailable: groups[group].filter((item) => !isAvailable(item.state)).length,
  }]));
  return {
    area,
    groups,
    totals,
    lightsOn: groups.lights.filter((item) => item.state?.state === "on").map((item) => item.entity),
    temperature: measurement(hass, config, area, "temperature"),
    humidity: measurement(hass, config, area, "humidity"),
  };
}
