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

export const plotWidth = 360;
export const plotHeight = 30;

function sparkline(history, start, end) {
  const segments = [];
  let segment;
  let min = Infinity;
  let max = -Infinity;
  const position = (time) => plotWidth * (time - start) / (end - start);
  for (const sample of history) {
    const timestamp = (sample.lc ?? sample.lu) * 1000;
    if (!Number.isFinite(timestamp) || timestamp > end) continue;
    const time = Math.max(start, timestamp);
    const x = position(time);
    const value = numberFromState(sample.s);
    if (value === undefined) {
      if (segment) segment.end = x;
      segment = undefined;
      continue;
    }
    if (!segment) {
      segment = { points: [], end: plotWidth };
      segments.push(segment);
    }
    segment.points.push({ time, x, state: sample.s, value });
    min = Math.min(min, value);
    max = Math.max(max, value);
  }

  const line = [];
  const area = [];
  for (const { points, end } of segments) {
    for (const point of points) {
      point.y = min === max ? 15 : 26 - 22 * (point.value - min) / (max - min);
    }
    const first = points[0];
    const commands = [`M${first.x},${first.y}`];
    for (let index = 1; index < points.length; index++) {
      const previous = points[index - 1];
      const point = points[index];
      // Horizontal tangents join the curves smoothly without overshooting the readings.
      const middle = (previous.x + point.x) / 2;
      commands.push(`C${middle},${previous.y} ${middle},${point.y} ${point.x},${point.y}`);
    }
    if (points.at(-1).x < end) commands.push(`H${end}`);
    const path = commands.join("");
    line.push(path);
    area.push(`${path}V${plotHeight}H${first.x}Z`);
  }
  return { segments, line: line.join(""), area: area.join("") };
}

export function sampleAt(history, x) {
  const segment = history?.segments.find(({ points, end }) => x >= points[0].x && x <= end);
  if (!segment) return undefined;
  const { points } = segment;
  let low = 0;
  let high = points.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (points[middle].x < x) low = middle + 1;
    else high = middle;
  }
  const previous = points[low - 1];
  const next = points[low];
  return previous && x - previous.x <= next.x - x ? previous : next;
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
      this.current = { key, requestedAt: 0, charts: {} };
    }
    const current = this.current;
    const now = Date.now();
    if (hass.callWS && !current.loading && now - current.requestedAt >= refreshInterval) {
      current.loading = true;
      current.requestedAt = now;
      clearTimeout(this.timer);
      this._load(hass, [...new Set(readings.map(({ id }) => id))], current, now);
    }
    return current.charts;
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
      current.charts = Object.fromEntries(ids.map((id) => [id, sparkline(result[id] ?? [], start, end)]));
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
