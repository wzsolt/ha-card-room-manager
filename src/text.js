const en = {
  card: "Room Manager",
  description: "Control one room and see its sensors and climate readings.",
  selectArea: "Select a room in the card settings.",
  missingArea: "This room is no longer available. Select a room in the card settings.",
  empty: "No supported entities in this room.",
  sensors: "Sensors", presence: "Presence", openings: "Doors and windows",
  lights: "Lights", switches: "Switches",
  temperature: "Temperature", humidity: "Humidity",
  detected: "Presence detected", clear: "No presence detected", uncertain: "Presence unknown",
  on: "On", off: "Off", open: "Open", closed: "Closed",
  active: "Detected", inactive: "Clear", unavailable: "Unavailable", unknown: "Unknown",
  noReading: "No reading", allOff: "Turn off all lights",
  moreInfo: "Details", brightness: "Brightness", failed: "Home Assistant could not complete the action.",
  room: "Room", chooseRoom: "Choose a room",
  defaultSensor: "Use the room's selected sensor",
  title: "Card title", icon: "Icon", advanced: "Advanced",
  add: "Add", remove: "Remove", exclude: "Exclude", restore: "Restore",
  exclusions: "Exclude automatically discovered entities", search: "Search entities",
  chooseEntity: "Choose an entity", noMatches: "No matches", name: "Name override",
  countOn: (count) => `${count} on`,
  countOpen: (count) => `${count} open`,
  countUnavailable: (count) => `${count} unavailable or unknown`,
};

const hu = {
  card: "Szobakezelő",
  description: "Egy helyiség vezérlése, érzékelőkkel és klímaadatokkal.",
  selectArea: "Válassz helyiséget a kártya beállításaiban.",
  missingArea: "Ez a helyiség már nem érhető el. Válassz helyiséget a kártya beállításaiban.",
  empty: "Ebben a helyiségben nincs megjeleníthető entitás.",
  sensors: "Szenzorok", presence: "Jelenlét", openings: "Ajtók és ablakok",
  lights: "Lámpák", switches: "Kapcsolók",
  temperature: "Hőmérséklet", humidity: "Páratartalom",
  detected: "Jelenlét érzékelve", clear: "Nincs érzékelés", uncertain: "Jelenlét ismeretlen",
  on: "Bekapcsolva", off: "Kikapcsolva", open: "Nyitva", closed: "Zárva",
  active: "Érzékelve", inactive: "Nincs érzékelés", unavailable: "Nem érhető el", unknown: "Ismeretlen",
  noReading: "Nincs mérés", allOff: "Összes lámpa lekapcsolása",
  moreInfo: "Részletek", brightness: "Fényerő", failed: "A Home Assistant nem tudta végrehajtani a műveletet.",
  room: "Helyiség", chooseRoom: "Válassz helyiséget",
  defaultSensor: "A helyiséghez kijelölt szenzor",
  title: "Kártya címe", icon: "Ikon", advanced: "Haladó",
  add: "Hozzáadás", remove: "Eltávolítás", exclude: "Kizárás", restore: "Visszaállítás",
  exclusions: "Automatikusan felvett entitások kizárása", search: "Entitások keresése",
  chooseEntity: "Válassz entitást", noMatches: "Nincs találat", name: "Egyedi név",
  countOn: (count) => `${count} bekapcsolva`,
  countOpen: (count) => `${count} nyitva`,
  countUnavailable: (count) => `${count} nem elérhető vagy ismeretlen`,
};

export function labels(hass) {
  const language = hass?.language || hass?.locale?.language || navigator.language;
  return language.toLowerCase().split("-")[0] === "hu" ? hu : en;
}
