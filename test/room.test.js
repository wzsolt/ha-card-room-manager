import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRoom, discoverRoom, supportsBrightness, validateConfig } from "../src/room.js";
import { fixture } from "./fixture.js";

test("discovers the selected room and refreshes after a registry move", () => {
  const hass = fixture();
  const room = discoverRoom(hass, "nappali");
  assert.deepEqual(Object.fromEntries(room), {
    "light.ceiling": "lights",
    "light.reading": "lights",
    "light.offline": "lights",
    "switch.socket": "switches",
    "switch.misc": "switches",
    "binary_sensor.motion": "presence",
    "binary_sensor.occupancy": "presence",
    "binary_sensor.patio": "openings",
    "binary_sensor.window": "openings",
  });
  assert.equal(discoverRoom(hass, "konyha").get("light.kitchen"), "lights");
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
  assert.equal(room.groups.presence.length, 3);
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
  const { states } = fixture();
  assert.equal(supportsBrightness("light.ceiling", states["light.ceiling"]), true);
  assert.equal(supportsBrightness("light.reading", states["light.reading"]), false);
  assert.equal(supportsBrightness("switch.socket", states["switch.socket"]), false);
});
