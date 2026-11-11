import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { parse, stringify } from "yaml";
import { fixture } from "./fixture.js";

const bundle = fileURLToPath(new URL("../dist/ha-room-manager-card.js", import.meta.url));

test("Lovelace preview, actions, and editor round trip in Chromium", { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.ROOM_MANAGER_CHROMIUM });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 850 }, colorScheme: "dark" });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error));
    await page.route("https://room-manager.test/", (route) => route.fulfill({ body: "<!doctype html>" }));
    await page.goto("https://room-manager.test/");
    await page.setContent(`
      <style>
        html { color-scheme: light dark; }
        body { margin: 16px; font: 16px system-ui; background: Canvas; color: CanvasText; }
      </style>
      <main></main>
    `);
    await page.evaluate(() => {
      customElements.define("ha-card", class extends HTMLElement {
        connectedCallback() {
          this.style.border = "1px solid #8585855c";
          this.style.borderRadius = "16px";
        }
      });
      customElements.define("ha-icon", class extends HTMLElement {
        connectedCallback() {
          this.style.cssText = "display:inline-block;width:var(--mdc-icon-size);height:var(--mdc-icon-size);" +
            "background:currentColor;border-radius:50%;mask:radial-gradient(transparent 32%,black 36%,black 51%,transparent 56%)";
        }
      });
      window.loadCardHelpers = async () => {
        customElements.define("hui-entities-card", class extends HTMLElement {
          static async getConfigElement() {
            customElements.define("ha-form", class extends HTMLElement {
              edit(path, value) {
                let schema = this.schema;
                const data = structuredClone(this.data);
                let container = data;
                for (const name of path.slice(0, -1)) {
                  schema = schema.find((field) => field.name === name).schema;
                  container = container[name];
                }
                const name = path.at(-1);
                const field = schema.find((item) => item.name === name);
                if (!field) throw new Error(`No native field: ${name}`);
                const picker = field.selector?.entity;
                if (picker?.multiple && (!Array.isArray(value) ||
                    value.some((id) => !picker.include_entities.includes(id)))) {
                  throw new Error("Invalid selection for native multi-entity picker");
                }
                container[name] = value;
                this.data = data;
                this.dispatchEvent(new CustomEvent("value-changed", { detail: { value: data }, bubbles: true }));
              }
            });
          }
        });
      };
    });
    await page.addScriptTag({ path: bundle, type: "module" });
    await page.evaluate((hass) => {
      window.calls = [];
      window.details = [];
      window.historyCalls = [];
      hass.states["switch.other"] = {
        entity_id: "switch.other", state: "on", attributes: { friendly_name: "Dugalj" },
      };
      hass.entities["switch.other"] = { entity_id: "switch.other", area_id: "nappali" };
      hass.callService = async (domain, service, data, target) => {
        window.calls.push({ domain, service, data, target });
        if (window.failService) throw new Error("Service error");
      };
      hass.callWS = async (request) => {
        window.historyCalls.push(request);
        const start = Date.parse(request.start_time);
        if (Date.parse(request.end_time) - start === 24 * 60 * 60 * 1000) {
          return Object.fromEntries(request.entity_ids.map((id) => [id, [
            { s: "16", lu: start / 1000 },
            { s: "23", lc: start / 1000 + 8 * 60 * 60 },
            { s: "29", lc: start / 1000 + 16 * 60 * 60 },
            { s: "unavailable", lc: start / 1000 + 18 * 60 * 60 },
            { s: "25", lc: start / 1000 + 20 * 60 * 60 },
          ]]));
        }
        return { "sensor.room_temperature": [{ s: "16" }, { s: "unknown" }, { s: "29" }] };
      };
      hass.formatEntityState = (state) => state.state.replace(".", ",") + " " + state.attributes.unit_of_measurement;
      window.hass = hass;
      window.config = {
        type: "custom:ha-room-manager-card", area: "nappali",
        include: { lights: ["switch.kitchen_lamp", "switch.socket"] },
        exclude: ["light.reading"],
      };
      const card = document.createElement("ha-room-manager-card");
      card.setConfig(window.config);
      card.hass = hass;
      card.addEventListener("hass-more-info", (event) => window.details.push(event.detail));
      document.querySelector("main").append(card);
      window.card = card;
    }, fixture());

    const card = page.locator("ha-room-manager-card");
    const heading = card.getByRole("heading", { level: 2 });
    await heading.waitFor();
    assert.equal(await heading.textContent(), "Nappali");
    assert.deepEqual(await card.getByRole("heading", { level: 3 }).allTextContents(),
      ["Árnyékolók", "Lámpák", "Kapcsolók", "Biztonság"]);
    await card.getByRole("button", { name: "Hőmérséklet · 22,5 °C" }).click();
    await card.getByRole("button", { name: "Páratartalom · 48 %" }).click();
    const range = card.getByRole("button", { name: /nullázása/ });
    await card.getByRole("button", { name: /Min 22,5 \/ Max 22,5 °C/ }).waitFor();
    await page.evaluate(() => {
      window.hass.states["sensor.room_temperature"].state = "25";
      window.card.hass = { ...window.hass };
    });
    await card.getByRole("button", { name: /Min 22,5 \/ Max 25 °C/ }).waitFor();
    await range.click();
    await card.getByRole("button", { name: /Min 25 \/ Max 25 °C/ }).waitFor();
    await page.evaluate(() => {
      const parent = window.card.parentElement;
      const card = document.createElement("ha-room-manager-card");
      card.setConfig(window.config);
      card.hass = window.hass;
      card.addEventListener("hass-more-info", (event) => window.details.push(event.detail));
      parent.replaceChildren(card);
      window.card = card;
    });
    await card.getByRole("button", { name: /Min 16 \/ Max 29 °C/ }).waitFor();
    assert.equal(await page.evaluate(() => window.historyCalls[0].type), "history/history_during_period");
    assert.equal(await card.locator('[data-entity="light.reading"]').count(), 0);
    assert.equal(await card.locator('[data-entity="cover.kitchen"], [data-entity="cover.all"], [data-entity="binary_sensor.foreign"], [data-entity="binary_sensor.all"]').count(), 0);
    assert.equal(await card.locator('[data-entity="switch.socket"]').count(), 1);
    await card.locator('[data-entity="binary_sensor.patio"] .tile-main').click();
    assert.deepEqual(await page.evaluate(() => window.details), [
      { entityId: "sensor.room_temperature", view: "history" },
      { entityId: "sensor.room_humidity", view: "history" },
      { entityId: "binary_sensor.patio" },
    ]);
    await card.getByRole("button", { name: "Megállítás · Nappali redőny" }).click();
    await card.locator('[data-entity="switch.misc"] .tile-main').click();
    const lamp = card.locator('[data-entity="light.ceiling"]');
    const dimmer = lamp.locator(".tile-main");
    await dimmer.scrollIntoViewIfNeeded();
    const bounds = await dimmer.boundingBox();
    const y = bounds.y + bounds.height / 2;
    await page.mouse.move(bounds.x + bounds.width * 0.2, y);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * 0.73, y, { steps: 4 });
    assert.equal(await lamp.evaluate((node) => node.style.getPropertyValue("--level")), "73%");
    await page.mouse.up();
    await card.locator(".lights").getByRole("button", { name: /Összes lámpa lekapcsolása/ }).click();
    await card.locator(".switches").getByRole("button", { name: /Összes kapcsoló lekapcsolása/ }).click();

    const calls = await page.evaluate(() => window.calls);
    assert.deepEqual(calls, [
      { domain: "cover", service: "stop_cover", data: {}, target: { entity_id: ["cover.blind"] } },
      { domain: "homeassistant", service: "toggle", data: {}, target: { entity_id: ["switch.misc"] } },
      { domain: "light", service: "turn_on", data: { brightness_pct: 73 }, target: { entity_id: ["light.ceiling"] } },
      { domain: "homeassistant", service: "turn_off", data: {}, target: { entity_id: ["switch.kitchen_lamp", "light.ceiling", "switch.socket"] } },
      { domain: "homeassistant", service: "turn_off", data: {}, target: { entity_id: ["switch.other"] } },
    ]);
    await page.evaluate(() => {
      for (const id of ["switch.other", "switch.kitchen_lamp", "light.ceiling", "switch.socket"]) {
        window.hass.states[id].state = "off";
      }
      window.card.hass = { ...window.hass };
    });
    assert.equal(await card.locator(".section-badges").getByRole("button").count(), 0);
    const summary = card.locator(".summary");
    assert.equal(await summary.locator(".chip:visible").count(), 5);
    await page.evaluate(() => {
      window.hass.states["cover.blind"].state = "closed";
      window.hass.states["binary_sensor.motion"].state = "off";
      window.hass.states["binary_sensor.camera_motion"].state = "off";
      window.hass.states["binary_sensor.patio"].state = "off";
      window.card.hass = { ...window.hass };
    });
    await summary.getByRole("img", { name: "Biztonság · Minden zárva" }).waitFor();
    assert.equal(await summary.locator(".chip:visible").count(), 4);
    await page.evaluate(() => {
      window.hass.states["binary_sensor.motion"].state = "on";
      window.hass.states["binary_sensor.patio"].state = "on";
      window.card.hass = { ...window.hass };
    });
    await page.evaluate(() => {
      window.hass.states["light.ceiling"].state = "on";
      window.card.hass = { ...window.hass };
    });
    const heights = await card.locator(".summary .chip:visible").evaluateAll(
      (chips) => chips.map((chip) => chip.getBoundingClientRect().height));
    assert.equal(new Set(heights).size, 1);
    const motion = card.locator('[data-entity="binary_sensor.motion"]');
    const clear = card.locator('[data-entity="binary_sensor.occupancy"]');
    const door = card.locator('[data-entity="binary_sensor.patio"]');
    const closed = card.locator('[data-entity="binary_sensor.window"]');
    const color = (tile) => tile.locator(".glyph").evaluate((el) => getComputedStyle(el).color);
    const palette = await card.evaluate((el) => {
      const root = el.shadowRoot.querySelector("ha-card");
      return ["amber", "red", "green"].map((tone) => {
        const probe = document.createElement("span");
        probe.style.color = "var(--room-" + tone + ")";
        root.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      });
    });
    assert.deepEqual(await Promise.all([motion, door, closed].map(color)), palette);
    for (const tile of [motion, door]) {
      assert.equal(await tile.evaluate((el) => getComputedStyle(el).borderTopColor), "rgba(0, 0, 0, 0)");
      assert.notEqual(await tile.evaluate((el) => getComputedStyle(el).backgroundColor),
        await closed.evaluate((el) => getComputedStyle(el).backgroundColor));
    }
    assert.equal(await color(clear), await color(closed));
    assert.notEqual(await color(motion), await color(clear));
    assert.equal(await motion.locator(".glyph ha-icon").getAttribute("icon"), "mdi:motion-sensor");
    assert.equal(await closed.locator(".glyph ha-icon").getAttribute("icon"), "mdi:window-closed-variant");

    const columns = card.locator(".lights .grid");
    const gridColumns = () => columns.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
    assert.equal(await gridColumns(), 2);
    const darkSurface = await card.locator("ha-card").evaluate((el) => getComputedStyle(el).backgroundColor);
    await page.emulateMedia({ colorScheme: "light" });
    assert.notEqual(await card.locator("ha-card").evaluate((el) => getComputedStyle(el).backgroundColor), darkSurface);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await gridColumns(), 1);
    if (process.env.ROOM_MANAGER_SCREENSHOTS) {
      await mkdir(process.env.ROOM_MANAGER_SCREENSHOTS, { recursive: true });
      await card.screenshot({ path: join(process.env.ROOM_MANAGER_SCREENSHOTS, "room-mobile.png") });
      await page.setViewportSize({ width: 680, height: 850 });
      await page.emulateMedia({ colorScheme: "dark" });
      await card.screenshot({ path: join(process.env.ROOM_MANAGER_SCREENSHOTS, "room-dark.png") });
      await page.setViewportSize({ width: 390, height: 844 });
    }

    await page.evaluate(() => { window.failService = true; });
    await dimmer.press("ArrowRight");
    await card.getByRole("alert").waitFor();
    assert.match(await lamp.locator(".tile-state").textContent(), /60%/);
    await page.evaluate(() => { window.failService = false; });

    await page.evaluate(async () => {
      const editor = await window.card.constructor.getConfigElement();
      editor.setConfig(window.config);
      editor.hass = window.hass;
      editor.addEventListener("config-changed", (event) => {
        window.config = event.detail.config;
        window.card.setConfig(window.config);
      });
      document.querySelector("main").append(editor);
      window.editor = editor;
    });
    const editor = page.locator("ha-room-manager-card-editor");
    const form = editor.locator("ha-form");
    const edit = (path, value) => form.evaluate((element, change) => element.edit(...change), [path, value]);
    assert.deepEqual(await form.evaluate((element) => element.schema[0].selector), { area: {} });
    await edit(["lights", "columns"], "4");
    assert.equal(await gridColumns(), 4);
    await edit(["lights", "show_brightness"], false);
    assert.equal(await lamp.getAttribute("data-dimmable"), null);
    await edit(["lights", "columns"], "auto");
    assert.equal(await gridColumns(), 1);
    await edit(["area"], "konyha");
    assert.equal(await heading.textContent(), "Konyha");
    assert.equal(await card.getByRole("button", { name: /Hőmérséklet|Páratartalom|nullázása/ }).count(), 0);
    await edit(["temperature_entity"], "sensor.kitchen_temperature");
    await card.getByRole("button", { name: "Hőmérséklet · 71 °F" }).waitFor();
    await edit(["humidity_entity"], "sensor.unassigned_humidity");
    await card.getByRole("button", { name: "Páratartalom · 51 %" }).waitFor();

    const charts = card.locator(".climate");
    assert.equal(await charts.getByRole("button").count(), 0);
    assert.equal(await page.evaluate(() => window.historyCalls.some((request) =>
      Date.parse(request.end_time) - Date.parse(request.start_time) === 24 * 60 * 60 * 1000)), false);
    const temperatureChart = charts.getByRole("button", { name: /Hőmérséklet.*Elmúlt 24 óra/ });
    const humidityChart = charts.getByRole("button", { name: /Páratartalom.*Elmúlt 24 óra/ });
    await edit(["show_temperature_chart"], true);
    await temperatureChart.locator(".chart-line[d^=M]").waitFor({ state: "attached" });
    assert.equal(await humidityChart.count(), 0);
    await edit(["show_humidity_chart"], true);
    await humidityChart.locator(".chart-line[d^=M]").waitFor({ state: "attached" });
    assert.equal(await charts.evaluate((el) => el === el.parentElement.firstElementChild), true);
    assert.deepEqual(await page.evaluate(() => window.historyCalls.filter((request) =>
      Date.parse(request.end_time) - Date.parse(request.start_time) === 24 * 60 * 60 * 1000)
      .map((request) => request.entity_ids)), [
      ["sensor.kitchen_temperature"], ["sensor.kitchen_temperature", "sensor.unassigned_humidity"],
    ]);
    for (const [chart, value] of [[temperatureChart, "71 °F"], [humidityChart, "51 %"]]) {
      assert.match(await chart.locator(".chart-line").getAttribute("d"), /C/);
      assert.match(await chart.locator(".chart-area").getAttribute("d"), /Z.*M.*Z$/);
      assert.equal(await chart.locator(".chart-value").textContent(), value);
      const title = await chart.locator(".chart-title").boundingBox();
      const current = await chart.locator(".chart-value").boundingBox();
      assert.equal(title.y, current.y);
      assert.ok(title.x + title.width < current.x);
    }
    const graph = temperatureChart.locator(".chart-graph");
    const tooltip = temperatureChart.locator(".chart-tooltip");
    await graph.scrollIntoViewIfNeeded();
    const graphBox = await graph.boundingBox();
    const hoverAtHour = (hour) => page.mouse.move(graphBox.x + graphBox.width * hour / 24, graphBox.y + 20);
    await hoverAtHour(8);
    await tooltip.waitFor();
    assert.match(await tooltip.textContent(), /\d{1,2}:\d{2}.* · 23 °F$/);
    await hoverAtHour(16);
    assert.match(await tooltip.textContent(), / · 29 °F$/);
    assert.equal(await temperatureChart.locator(".chart-value").textContent(), "71 °F");
    await hoverAtHour(19);
    await tooltip.waitFor({ state: "hidden" });
    await hoverAtHour(22);
    await tooltip.waitFor();
    assert.match(await tooltip.textContent(), / · 25 °F$/);
    await temperatureChart.locator(".chart-title").hover();
    await tooltip.waitFor({ state: "hidden" });

    await temperatureChart.click();
    await humidityChart.click();
    assert.deepEqual(await page.evaluate(() => window.details.slice(-2)), [
      { entityId: "sensor.kitchen_temperature", view: "history" },
      { entityId: "sensor.unassigned_humidity", view: "history" },
    ]);
    if (process.env.ROOM_MANAGER_SCREENSHOTS) {
      await temperatureChart.locator(".chart-graph").hover();
      await card.screenshot({ path: join(process.env.ROOM_MANAGER_SCREENSHOTS, "room-climate.png") });
    }
    await edit(["show_temperature_chart"], false);
    assert.equal(await temperatureChart.count(), 0);
    assert.equal(await humidityChart.count(), 1);

    await edit(["covers", "added"], ["cover.blind"]);
    await card.locator('[data-entity="cover.blind"]').waitFor();
    await edit(["covers", "added"], []);
    await card.locator('[data-entity="cover.blind"]').waitFor({ state: "detached" });
    await edit(["security", "added"], ["binary_sensor.patio"]);
    await edit(["security", "columns"], "3");
    await card.locator('[data-entity="binary_sensor.patio"]').waitFor();
    await edit(["lights", "excluded"], ["light.kitchen"]);
    await card.locator('[data-entity="light.kitchen"]').waitFor({ state: "detached" });

    const savedYaml = stringify(await page.evaluate(() => window.config));
    await page.evaluate((edited) => {
      window.editor.setConfig(edited);
      window.card.setConfig(edited);
      window.hass.states["sensor.kitchen_temperature"].state = "unknown";
      window.card.hass = { ...window.hass };
    }, parse(savedYaml));
    await card.getByRole("button", { name: "Hőmérséklet · Nincs mérés" }).waitFor();
    assert.equal(await form.evaluate((node) => node.data.temperature_entity), "sensor.kitchen_temperature");
    assert.equal(await form.evaluate((node) => node.data.security.columns), "3");
    assert.equal(await form.evaluate((node) => node.data.show_humidity_chart), true);
    assert.equal(await form.evaluate((node) => node.data.show_temperature_chart), false);
    assert.deepEqual(await page.evaluate(() => window.config.include.security), ["binary_sensor.patio"]);
    assert.deepEqual(await page.evaluate(() => window.config.exclude), ["light.reading", "light.kitchen"]);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
