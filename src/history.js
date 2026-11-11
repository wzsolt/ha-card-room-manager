import { numberFromState } from "./room.js";

const day = 24 * 60 * 60 * 1000;
const refreshInterval = 5 * 60 * 1000;

export function fetchHistory(hass, entityIds, start, end) {
  return hass.callWS({
    type: "history/history_during_period",
    entity_ids: entityIds,
    start_time: new Date(start).toISOString(),
    end_time: new Date(end).toISOString(),
    minimal_response: true,
    no_attributes: true,
    significant_changes_only: false,
  });
}

function sparklinePath(history, start, end) {
  const points = [];
  let min = Infinity;
  let max = -Infinity;
  for (const sample of history) {
    const timestamp = sample.lc ?? sample.lu;
    if (!Number.isFinite(timestamp) || timestamp * 1000 > end) continue;
    const value = numberFromState(sample.s);
    points.push({ time: Math.max(start, timestamp * 1000), value });
    if (value !== undefined) {
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }
  if (!Number.isFinite(min)) return "";

  const commands = [];
  let previous;
  for (const { time, value } of points) {
    const x = Math.round(360 * (time - start) / (end - start));
    if (value === undefined) {
      if (previous) commands.push(`H${x}`);
      previous = false;
      continue;
    }
    const y = min === max ? 15 : Math.round(26 - 22 * (value - min) / (max - min));
    commands.push(previous ? `H${x}V${y}` : `M${x},${y}`);
    previous = true;
  }
  if (previous) commands.push("H360");
  return commands.join("");
}

export class ClimateHistory {
  constructor(onChange) {
    this.onChange = onChange;
  }

  update(hass, readings) {
    if (!readings.length) {
      this.clear();
      return {};
    }
    const key = JSON.stringify(readings.map(({ id, unit }) => [id, unit]));
    if (this.current?.key !== key) {
      this.clear();
      this.current = { key, requestedAt: 0, paths: {} };
    }
    const current = this.current;
    const now = Date.now();
    if (hass.callWS && !current.loading && now - current.requestedAt >= refreshInterval) {
      current.loading = true;
      current.requestedAt = now;
      clearTimeout(this.timer);
      this._load(hass, [...new Set(readings.map(({ id }) => id))], current, now);
    }
    return current.paths;
  }

  clear() {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.current = undefined;
  }

  async _load(hass, ids, current, end) {
    const start = end - day;
    try {
      const result = await fetchHistory(hass, ids, start, end);
      if (this.current !== current) return;
      current.paths = Object.fromEntries(ids.map((id) => [id, sparklinePath(result[id] ?? [], start, end)]));
      this.onChange();
    } catch {
      // Recorder may be unavailable. The card still shows the current readings.
    } finally {
      current.loading = false;
      if (this.current === current) {
        this.timer = setTimeout(this.onChange, Math.max(0, end + refreshInterval - Date.now()));
      }
    }
  }
}
