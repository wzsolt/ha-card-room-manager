# Room Manager Card

A Szobakezelő egy kiválasztott Home Assistant-helyiség lámpáit, kapcsolóit, jelenlét- és nyitásérzékelőit gyűjti egy Lovelace-kártyára. A fejléc mutatja a jelenlétet, a nyitott ajtók és ablakok, illetve a bekapcsolt lámpák és kapcsolók számát, valamint a kijelölt hőmérséklet- és páratartalom-szenzor értékét.

A lámpák és kapcsolók csempéi kapcsolnak. A dimmelhető lámpák csempéjén külön csúszka állítja a fényerőt. A Lámpák és a Kapcsolók szekció számlálója akkor jelenik meg, ha van bekapcsolt eszköz. Koppintással lekapcsolhatod vele a szekció összes bekapcsolt eszközét. A fejléc lámpajelvénye ugyanezt a lámpaműveletet végzi.

## Telepítés

### HACS vagy Marketplace

1. Add hozzá a kártya nyilvános GitHub-tárolóját egyéni **Dashboard** tárolóként. Home Assistant 2026.10 alatt a HACS **Custom repositories**, 2026.11-től a **Settings → Marketplace → Add from link** menüpontot használd.
2. Telepítsd a **Room Manager Card** csomagot, majd töltsd újra a böngészőt. Ha YAML-ban kezeled az erőforrásokat, vedd fel a telepítőben megjelenő JavaScript-modult.
3. Az irányítópult szerkesztésekor add hozzá a **Szobakezelő** kártyát, és válaszd ki a helyiséget.

### Helyi próba

Másold a kiadásból letöltött vagy az `npm run build` paranccsal elkészített `dist/ha-room-manager-card.js` fájlt a Home Assistant `/config/www/` mappájába. Add hozzá a `/local/ha-room-manager-card.js` erőforrást **JavaScript Module** típussal, majd töltsd újra az irányítópultot.

## Beállítások

Az automatikus lista először az entitás saját helyiségét nézi, majd az eszközét. A szerkesztőben a Home Assistant kereshető entitásválasztójával adhatsz hozzá entitásokat, akár másik helyiségből is. A kézi besorolás felülírja az automatikusat. Az `exclude` az automatikus listára hat. A Haladó részben a kézzel felvett csempék neve és ikonja megadható. A Lámpák, Kapcsolók, Jelenlét és Ajtók és ablakok szekció külön-külön 1–4 oszlopra állítható. Automatikus módban szélesebb kártyán két, keskenyen egy oszlop jelenik meg.

A fejléc a kártyán kiválasztott hőmérséklet- és páratartalom-szenzort használja. Ha a mező üres, az adott helyiség **Kapcsolódó szenzorok** beállítása adja a forrást. Kijelölés vagy érvényes mérés hiányában `—` jelenik meg.

A hőmérséklet- és páratartalom-jelvény az entitás Home Assistant-előzményeit nyitja meg. A hőmérséklet min/max jelvénye az első mérés, illetve az utolsó nullázás óta mutatja a szélsőértékeket. Koppints a min/max jelvényre a nullázáshoz. A tartomány az adott böngészőben mentődik, és a kártya újranyitáskor a Recorder rendelkezésre álló méréseivel egészíti ki.

```yaml
type: custom:ha-room-manager-card
area: nappali
title: Nappali
icon: mdi:sofa
temperature_entity: sensor.nappali_homerseklet
humidity_entity: sensor.nappali_paratartalom
columns:
  lights: 2
  switches: 2
  presence: 3
  openings: 3
include:
  lights:
    - entity: switch.allolampa
      name: Állólámpa
      icon: mdi:floor-lamp
  switches:
    - switch.teve
  presence:
    - binary_sensor.nappali_jelenlet
  openings:
    - binary_sensor.teraszajto
exclude:
  - switch.router
```

Az `area` mezőbe a Home Assistant helyiségazonosítója kerül. A `type` és az `area` elegendő az automatikus beállításhoz.

## Fejlesztés és kiadás

```sh
npm ci
npm test
npm run build
npx playwright-core install chromium
npm run test:browser
```

A böngészőteszt szimulált Home Assistant-adatokkal fut. Telepített Chromium vagy Chrome a `ROOM_MANAGER_CHROMIUM` környezeti változóban adható meg.

A kártyamappa tartalma kerüljön a nyilvános kiadási tároló gyökerébe a `.github` könyvtárral együtt. A GitHub-tárolóhoz állíts be leírást, témacímkéket és hibajegyeket a HACS-ellenőrzéshez. A `package.json` verziójával egyező címke, például `v0.1.0`, indítja a teszteket és teszi közzé a modult GitHub-kiadásként.
