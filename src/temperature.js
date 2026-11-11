import { numberFromState } from "./room.js";
import { fetchHistory } from "./history.js";

export class TemperatureRange {
  constructor(onHistory) {
    this.onHistory = onHistory;
  }

  update(hass, area, reading) {
    if (!reading.id) {
      this.current = undefined;
      return undefined;
    }

    const key = JSON.stringify([hass.user?.id, area, reading.id]);
    const now = Date.now();
    if (this.current?.key !== key) {
      const range = this._read(key);
      this.current = { key, range };
    }

    const current = this.current;
    if (reading.value !== undefined && current.range?.unit !== reading.unit) {
      // Changing units starts a fresh range and invalidates a pending history read.
      this.current = { key, range: undefined };
    }
    const active = this.current;
    const previous = active.range;
    if (previous && !active.checkedHistory && hass.callWS) {
      active.checkedHistory = true;
      if (previous.through < now) this._backfill(hass, reading.id, active, now);
    }

    if (reading.value !== undefined && (!previous ||
        reading.value < previous.min || reading.value > previous.max)) {
      active.range = {
        unit: reading.unit,
        min: Math.min(previous?.min ?? reading.value, reading.value),
        max: Math.max(previous?.max ?? reading.value, reading.value),
        through: previous?.through ?? now,
      };
      this._save(active);
    }
    if (!previous) active.checkedHistory = true;
    return active.range;
  }

  reset(reading) {
    if (!this.current) return;
    const range = reading.value === undefined ? undefined : {
      unit: reading.unit, min: reading.value, max: reading.value, through: Date.now(),
    };
    this.current = { key: this.current.key, range, checkedHistory: true };
    this._save(this.current);
  }

  async _backfill(hass, entityId, current, end) {
    try {
      const result = await fetchHistory(hass, [entityId], current.range.through, end);
      if (this.current !== current) return;
      const range = current.range;
      for (const point of result[entityId] ?? []) {
        const value = numberFromState(point.s);
        if (value === undefined) continue;
        range.min = Math.min(range.min, value);
        range.max = Math.max(range.max, value);
      }
      range.through = end;
      this._save(current);
      this.onHistory();
    } catch {
      // Recorder history may be unavailable. Live readings still update the range.
    }
  }

  _read(key) {
    try {
      const saved = JSON.parse(localStorage.getItem(`room-manager:temperature:${key}`));
      if (saved && [saved.min, saved.max, saved.through].every(Number.isFinite)) return saved;
    } catch {
      // Keep a session-only range if storage is unavailable.
    }
    return undefined;
  }

  _save({ key, range }) {
    try {
      const id = `room-manager:temperature:${key}`;
      if (range) localStorage.setItem(id, JSON.stringify(range));
      else localStorage.removeItem(id);
    } catch {
      // Keep a session-only range if storage is unavailable.
    }
  }
}
