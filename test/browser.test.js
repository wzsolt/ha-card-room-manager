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
            customElements.define("ha-entity-picker", class extends HTMLElement {
              choose(value) {
                if (value && !this.includeEntities.includes(value)) throw new Error("Entity is filtered out");
                this.value = value;
                this.dispatchEvent(new CustomEvent("value-changed", { detail: { value }, bubbles: true }));
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
      ["Lámpák", "Kapcsolók", "Jelenlét", "Ajtók és ablakok"]);
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
    assert.equal(await card.locator('[data-entity="switch.socket"]').count(), 1);
    await card.locator('[data-entity="binary_sensor.patio"] .tile-main').click();
    assert.deepEqual(await page.evaluate(() => window.details), [
      { entityId: "sensor.room_temperature", view: "history" },
      { entityId: "sensor.room_humidity", view: "history" },
      { entityId: "binary_sensor.patio" },
    ]);
    await card.locator('[data-entity="switch.misc"] .tile-main').click();
    await card.getByRole("slider", { name: /Mennyezeti lámpa/ }).fill("73");
    await card.locator(".lights").getByRole("button", { name: /Összes lámpa lekapcsolása/ }).click();
    await card.locator(".switches").getByRole("button", { name: /Összes kapcsoló lekapcsolása/ }).click();

    const calls = await page.evaluate(() => window.calls);
    assert.deepEqual(calls, [
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
    assert.equal(await color(motion), await color(door));
    assert.equal(await color(clear), await color(closed));
    assert.notEqual(await color(motion), await color(clear));
    assert.equal(await motion.locator(".glyph ha-icon").getAttribute("icon"), "mdi:run");
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
    await card.getByRole("slider").fill("82");
    await card.getByRole("alert").waitFor();
    assert.equal(await card.getByRole("slider").inputValue(), "60");
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
    const picker = (label) => editor.locator(`ha-entity-picker[data-picker="${label}"]`);
    await editor.locator("ha-entity-picker").first().waitFor({ state: "attached" });
    await editor.locator("ha-entity-picker").evaluateAll((nodes) => {
      for (const node of nodes) node.dataset.picker = node.label;
    });
    const choose = (label, id) => picker(label).evaluate((element, value) => element.choose(value), id);
    await editor.getByText("Lámpák", { exact: true }).click();
    await editor.getByRole("combobox", { name: "Lámpák · Oszlopok" }).selectOption("4");
    assert.equal(await gridColumns(), 4);
    await editor.getByRole("combobox", { name: "Lámpák · Oszlopok" }).selectOption("");
    assert.equal(await gridColumns(), 1);
    await editor.getByRole("combobox", { name: "Helyiség" }).selectOption("konyha");
    assert.equal(await heading.textContent(), "Konyha");
    await card.getByRole("button", { name: "Hőmérséklet · Nincs mérés" }).waitFor();
    await choose("Hőmérséklet", "sensor.kitchen_temperature");
    await card.getByRole("button", { name: "Hőmérséklet · 71 °F" }).waitFor();
    await choose("Páratartalom", "sensor.unassigned_humidity");
    await card.getByRole("button", { name: "Páratartalom · 51 %" }).waitFor();

    await editor.getByText("Ajtók és ablakok", { exact: true }).click();
    await choose("Ajtók és ablakok", "binary_sensor.patio");
    const openings = editor.locator("details").filter({ hasText: "Ajtók és ablakok" });
    await openings.getByRole("button", { name: "Hozzáadás" }).click();
    await editor.getByRole("combobox", { name: "Ajtók és ablakok · Oszlopok" }).selectOption("3");
    await card.locator('[data-entity="binary_sensor.patio"]').waitFor();
    await editor.getByText("Automatikusan felvett entitások kizárása", { exact: true }).click();
    await choose("Automatikusan felvett entitások kizárása", "light.kitchen");
    await editor.getByRole("button", { name: "Kizárás" }).click();
    await card.locator('[data-entity="light.kitchen"]').waitFor({ state: "detached" });

    const savedYaml = stringify(await page.evaluate(() => window.config));
    await page.evaluate((edited) => {
      window.editor.setConfig(edited);
      window.card.setConfig(edited);
      window.hass.states["sensor.kitchen_temperature"].state = "unknown";
      window.card.hass = { ...window.hass };
    }, parse(savedYaml));
    await card.getByRole("button", { name: "Hőmérséklet · Nincs mérés" }).waitFor();
    assert.equal(await picker("Hőmérséklet").evaluate((node) => node.value), "sensor.kitchen_temperature");
    assert.equal(await editor.getByRole("combobox", { name: "Ajtók és ablakok · Oszlopok" }).inputValue(), "3");
    assert.deepEqual(await page.evaluate(() => window.config.include.openings), ["binary_sensor.patio"]);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
