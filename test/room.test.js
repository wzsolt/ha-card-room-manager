import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRoom, discoverRoom, normalizeConfig, supportsBrightness, validateConfig } from "../src/room.js";
import { fixture } from "./fixture.js";

test("discovers the selected room and refreshes after a registry move", () => {
  const hass = fixture();
  delete hass.states["light.offline"];
  const room = discoverRoom(hass, "nappali");
  assert.deepEqual(Object.fromEntries(room), {
    "light.ceiling": "lights",
    "light.reading": "lights",
    "light.offline": "lights",
    "switch.socket": "switches",
    "switch.misc": "switches",
    "cover.blind": "covers",
    "binary_sensor.motion": "security",
    "binary_sensor.occupancy": "security",
    "binary_sensor.patio": "security",
    "binary_sensor.window": "security",
    "binary_sensor.camera_motion": "security",
  });
  assert.equal(discoverRoom(hass, "konyha").get("light.kitchen"), "lights");
  assert.equal(discoverRoom(hass, "konyha").get("binary_sensor.foreign"), "security");
  assert.equal(discoverRoom(hass, "nappali", true).get("light.hidden"), "lights");
  hass.entities["light.ceiling"].area_id = "konyha";
  assert.equal(discoverRoom(hass, "nappali").has("light.ceiling"), false);
  assert.equal(discoverRoom(hass, "konyha").get("light.ceiling"), "lights");
  assert.equal(buildRoom(hass, { area: "deleted" }), undefined);
});

test("manual assignment overrides automatic grouping and exclusion without duplicate targets", () => {
  const hass = fixture();
  const room = buildRoom(hass, {
    area: "nappali",
    include: {
      lights: [
        { entity: "switch.socket", name: "Dugaljról működő lámpa", icon: "mdi:lamp" },
        "switch.kitchen_lamp",
        "switch.kitchen_lamp",
        "light.disabled",
        "light.removed",
      ],
      switches: ["switch.socket"],
      presence: ["binary_sensor.camera_motion"],
    },
    exclude: ["light.reading", "switch.socket"],
  });
  const socket = room.groups.lights.find((item) => item.entity === "switch.socket");
  assert.equal(socket.name, "Dugaljról működő lámpa");
  assert.equal(socket.icon, "mdi:lamp");
  assert.deepEqual(new Set(room.active.lights), new Set(["light.ceiling", "switch.socket", "switch.kitchen_lamp"]));
  assert.deepEqual(room.active.switches, []);
  assert.deepEqual(room.totals.lights, { on: 3, unavailable: 3 });
  assert.deepEqual(room.groups.switches.map((item) => item.entity), ["switch.misc"]);
  assert.equal(room.groups.security.length, 5);
});

test("preserves legacy security entries, columns, and sensor friendly names", () => {
  const hass = fixture();
  hass.formatEntityName = () => "Different contextual name";
  const config = {
    area: "konyha",
    include: {
      presence: ["binary_sensor.motion"],
      openings: [{ entity: "binary_sensor.patio", icon: "mdi:door-open" }],
    },
    columns: { presence: 3, openings: 4 },
  };
  assert.deepEqual(normalizeConfig(config).columns, { security: 3 });
  const room = buildRoom(hass, config);
  assert.equal(room.groups.security.find((item) => item.entity === "binary_sensor.motion").name, "Mozgásérzékelő");
  assert.equal(room.groups.security.find((item) => item.entity === "binary_sensor.patio").icon, "mdi:door-open");
  assert.equal(room.groups.security.find((item) => item.entity === "binary_sensor.patio").securityType, "opening");
});

test("uses only configured climate sources and preserves their display units", () => {
  const hass = fixture();
  hass.formatEntityState = (state) => state.state.replace(".", ",") + " " + state.attributes.unit_of_measurement;
  assert.equal(buildRoom(hass, { area: "nappali" }).measurements.temperature.display, "22,5 °C");
  assert.equal(buildRoom(hass, { area: "nappali" }).measurements.humidity.display, "48 %");
  const config = { area: "nappali", temperature_entity: "sensor.kitchen_temperature" };
  assert.deepEqual(buildRoom(hass, config).measurements.temperature, {
    id: "sensor.kitchen_temperature", unit: "°F", value: 71, display: "71 °F",
  });
  hass.states["sensor.kitchen_temperature"].state = "unavailable";
  assert.equal(buildRoom(hass, config).measurements.temperature.display, undefined);
  assert.equal(buildRoom(hass, config).measurements.temperature.id, "sensor.kitchen_temperature");
  hass.states["sensor.room_humidity"].state = "0";
  assert.equal(buildRoom(hass, config).measurements.humidity.display, "0 %");
  assert.equal(buildRoom(hass, { area: "konyha" }).measurements.temperature.id, undefined);
  assert.equal(buildRoom(hass, { area: "nappali", humidity_entity: "sensor.deleted" }).measurements.humidity.id, undefined);
});

test("validates YAML-compatible config and accepts empty picker config", () => {
  assert.doesNotThrow(() => validateConfig({}));
  assert.doesNotThrow(() => validateConfig({ include: { lights: ["switch.lamp"] }, temperature_entity: "sensor.temp" }));
  assert.throws(() => validateConfig({ exclude: "light.ceiling" }), /exclude/);
  assert.throws(() => validateConfig({ include: { switches: ["light.ceiling"] } }), /switches/);
  assert.throws(() => validateConfig({ humidity_entity: "binary_sensor.damp" }), /humidity_entity/);
  assert.doesNotThrow(() => validateConfig({ columns: { lights: 1, switches: 2, presence: 3, openings: 4 } }));
  assert.throws(() => validateConfig({ columns: { openings: 5 } }), /columns/);
  assert.throws(() => validateConfig({ columns: { presence: "3" } }), /columns/);
  assert.throws(() => validateConfig({ include: { covers: ["light.ceiling"] } }), /covers/);
  assert.doesNotThrow(() => validateConfig({ include: { covers: ["cover.blind"] }, show_brightness: false }));
  const { states } = fixture();
  assert.equal(supportsBrightness("light.ceiling", states["light.ceiling"]), true);
  assert.equal(supportsBrightness("light.reading", states["light.reading"]), false);
  assert.equal(supportsBrightness("switch.socket", states["switch.socket"]), false);
});
