export function fixture() {
  const areas = {
    nappali: {
      area_id: "nappali", name: "Nappali", icon: "mdi:sofa",
      temperature_entity_id: "sensor.room_temperature",
      humidity_entity_id: "sensor.room_humidity",
    },
    konyha: { area_id: "konyha", name: "Konyha", icon: "mdi:silverware-fork-knife" },
  };
  const devices = {
    lounge: { area_id: "nappali" },
    kitchen: { area_id: "konyha" },
    camera: { area_id: "nappali" },
    child: { parent_device_id: "lounge" },
  };
  const entities = {};
  const states = {};
  const add = (id, name, state, attributes = {}, entry = {}) => {
    states[id] = { entity_id: id, state, attributes: { friendly_name: name, ...attributes } };
    entities[id] = { entity_id: id, device_id: "lounge", ...entry };
  };

  add("light.ceiling", "Mennyezeti lámpa", "on", { supported_color_modes: ["brightness"], brightness: 153 });
  add("light.reading", "Olvasólámpa", "off", { supported_color_modes: ["onoff"] });
  add("light.offline", "Állólámpa", "unavailable");
  add("light.kitchen", "Konyhai lámpa", "on", {}, { area_id: "konyha" });
  add("light.all", "Lámpacsoport", "on", { entity_id: ["light.ceiling", "light.kitchen"] });
  add("light.hidden", "Rejtett lámpa", "on", {}, { hidden: true });
  add("light.disabled", "Letiltott lámpa", "on", {}, { disabled_by: "user" });
  add("light.setup", "Beállítás", "on", {}, { entity_category: "config" });
  add("switch.socket", "Tévé", "on", { device_class: "outlet" });
  add("switch.indicator", "Jelzőfény", "on", {}, { entity_category: "diagnostic" });
  add("switch.kitchen_lamp", "Külső lámpa", "on", {}, { device_id: "kitchen" });
  add("switch.misc", "Ventilátor", "off", {}, { device_id: "child" });
  add("cover.blind", "Nappali redőny", "opening", { current_position: 35, supported_features: 15 });
  add("cover.kitchen", "Konyhai redőny", "closed", { current_position: 0, supported_features: 3 }, { device_id: "kitchen" });
  add("cover.all", "Minden redőny", "open", { entity_id: ["cover.blind", "cover.kitchen"] });
  add("binary_sensor.motion", "Mozgásérzékelő", "on", { device_class: "motion" });
  add("binary_sensor.occupancy", "Jelenlét", "off", { device_class: "occupancy" });
  add("binary_sensor.patio", "Teraszajtó", "on", { device_class: "door" });
  add("binary_sensor.window", "Ablak", "off", { device_class: "window" });
  add("binary_sensor.camera_motion", "Kamera mozgásjelzője", "on", { device_class: "motion" }, { device_id: "camera" });
  add("binary_sensor.foreign", "Másik helyiség ajtaja", "on", { device_class: "door" }, { area_id: "konyha" });
  add("binary_sensor.all", "Összes ajtó", "on", { device_class: "door", entity_id: ["binary_sensor.patio", "binary_sensor.foreign"] });
  add("binary_sensor.smoke", "Füstérzékelő", "off", { device_class: "smoke" });
  add("camera.front", "Kamera", "idle", {}, { device_id: "camera" });
  add("sensor.room_temperature", "Szobahőmérséklet", "22.5", { device_class: "temperature", unit_of_measurement: "°C" });
  add("sensor.room_humidity", "Szobapára", "48", { device_class: "humidity", unit_of_measurement: "%" });
  add("sensor.kitchen_temperature", "Konyhai hőmérséklet", "71", { device_class: "temperature", unit_of_measurement: "°F" }, { device_id: "kitchen" });
  add("sensor.unassigned_humidity", "Másik páramérő", "51", { device_class: "humidity", unit_of_measurement: "%" }, { device_id: undefined });

  return { areas, devices, entities, states, language: "hu", locale: { language: "hu" } };
}
