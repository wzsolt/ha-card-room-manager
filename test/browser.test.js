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
    });
    await page.addScriptTag({ path: bundle, type: "module" });
    await page.evaluate((hass) => {
      window.calls = [];
      window.details = [];
      hass.callService = async (domain, service, data, target) => {
        window.calls.push({ domain, service, data, target });
        if (window.failService) throw new Error("Service error");
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
      card.addEventListener("hass-more-info", (event) => window.details.push(event.detail.entityId));
      document.querySelector("main").append(card);
      window.card = card;
    }, fixture());

    const card = page.locator("ha-room-manager-card");
    const heading = card.getByRole("heading", { level: 2 });
    await heading.waitFor();
    assert.equal(await heading.textContent(), "Nappali");
    await card.getByRole("img", { name: "Hőmérséklet · 22,5 °C" }).waitFor();
    await card.getByRole("img", { name: "Páratartalom · 48 %" }).waitFor();
    assert.equal(await card.locator('[data-entity="light.reading"]').count(), 0);
    assert.equal(await card.locator('[data-entity="switch.socket"]').count(), 1);
    await card.locator('[data-entity="binary_sensor.patio"] .tile-main').click();
    assert.deepEqual(await page.evaluate(() => window.details), ["binary_sensor.patio"]);
    await card.locator('[data-entity="switch.misc"] .tile-main').click();
    await card.getByRole("slider", { name: /Mennyezeti lámpa/ }).fill("73");
    await card.getByRole("button", { name: /Összes lámpa lekapcsolása/ }).click();

    const calls = await page.evaluate(() => window.calls);
    assert.deepEqual(calls, [
      { domain: "homeassistant", service: "toggle", data: {}, target: { entity_id: ["switch.misc"] } },
      { domain: "light", service: "turn_on", data: { brightness_pct: 73 }, target: { entity_id: ["light.ceiling"] } },
      { domain: "homeassistant", service: "turn_off", data: {}, target: { entity_id: ["switch.kitchen_lamp", "light.ceiling", "switch.socket"] } },
    ]);

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
    }

    await page.evaluate(() => { window.failService = true; });
    await card.getByRole("slider").fill("82");
    await card.getByRole("alert").waitFor();
    assert.equal(await card.getByRole("slider").inputValue(), "60");
    await page.evaluate(() => { window.failService = false; });

    await page.evaluate(() => {
      const editor = window.card.constructor.getConfigElement();
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
    await editor.getByRole("combobox", { name: "Helyiség" }).selectOption("konyha");
    assert.equal(await heading.textContent(), "Konyha");
    await card.getByRole("img", { name: "Hőmérséklet · Nincs mérés" }).waitFor();
    await editor.getByRole("searchbox", { name: "Hőmérséklet · Entitások keresése" }).fill("Konyhai");
    await editor.getByRole("combobox", { name: "Hőmérséklet" }).selectOption("sensor.kitchen_temperature");
    await card.getByRole("img", { name: "Hőmérséklet · 71 °F" }).waitFor();
    await editor.getByRole("combobox", { name: "Páratartalom" }).selectOption("sensor.unassigned_humidity");
    await card.getByRole("img", { name: "Páratartalom · 51 %" }).waitFor();

    await editor.getByText("Ajtók és ablakok", { exact: true }).click();
    await editor.getByRole("searchbox", { name: "Ajtók és ablakok · Entitások keresése" }).fill("Teraszajtó");
    await editor.getByRole("combobox", { name: "Ajtók és ablakok" }).selectOption("binary_sensor.patio");
    await editor.getByRole("button", { name: "Hozzáadás" }).click();
    await card.locator('[data-entity="binary_sensor.patio"]').waitFor();
    await editor.getByText("Automatikusan felvett entitások kizárása", { exact: true }).click();
    await editor.getByRole("combobox", { name: "Automatikusan felvett entitások kizárása" }).selectOption("light.kitchen");
    await editor.getByRole("button", { name: "Kizárás" }).click();
    await card.locator('[data-entity="light.kitchen"]').waitFor({ state: "detached" });

    const savedYaml = stringify(await page.evaluate(() => window.config));
    await page.evaluate((edited) => {
      window.editor.setConfig(edited);
      window.card.setConfig(edited);
      window.hass.states["sensor.kitchen_temperature"].state = "unknown";
      window.card.hass = { ...window.hass };
    }, parse(savedYaml));
    await card.getByRole("img", { name: "Hőmérséklet · Nincs mérés" }).waitFor();
    assert.equal(await editor.getByRole("combobox", { name: "Hőmérséklet" }).inputValue(), "sensor.kitchen_temperature");
    assert.deepEqual(await page.evaluate(() => window.config.include.openings), ["binary_sensor.patio"]);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
