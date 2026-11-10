# Room Manager Card

A Szobakezelő egy Home Assistant-helyiség árnyékolóit, lámpáit, kapcsolóit, jelenlét- és nyitásérzékelőit gyűjti egy Lovelace-kártyára. A Biztonság szekcióban a nyugalmi szenzorok zöldek, az aktív szenzorok sárgák.

A lámpák és kapcsolók csempéi koppintásra kapcsolnak. A dimmelhető lámpa csempéjét oldalra húzva állíthatod a fényerőt. A színes sáv a fényerővel arányosan tölti ki a csempét. Billentyűzettel a nyilak, a Home és az End működnek. Az árnyékolóknál a támogatott nyitás, megállítás és zárás műveletek érhetők el, a csempére koppintva pedig az entitás részletei nyílnak meg. A Lámpák és Kapcsolók szekció számlálójára koppintva lekapcsolhatod a szekció bekapcsolt eszközeit.

## Telepítés

### HACS vagy Marketplace

1. Add hozzá a kártya nyilvános GitHub-tárolóját egyéni **Dashboard** tárolóként. Home Assistant 2026.10 alatt a HACS **Custom repositories**, 2026.11-től a **Settings → Marketplace → Add from link** menüpontot használd.
2. Telepítsd a **Room Manager Card** csomagot, majd töltsd újra a böngészőt. Ha YAML-ban kezeled az erőforrásokat, vedd fel a telepítőben megjelenő JavaScript-modult.
3. Az irányítópult szerkesztésekor add hozzá a **Szobakezelő** kártyát, és válaszd ki a helyiséget.

### Helyi próba

Másold a kiadásból letöltött vagy az `npm run build` paranccsal elkészített `dist/ha-room-manager-card.js` fájlt a Home Assistant `/config/www/` mappájába. Add hozzá a `/local/ha-room-manager-card.js` erőforrást **JavaScript Module** típussal, majd töltsd újra az irányítópultot.

## Beállítások

Az automatikus lista az entitás saját helyiségét veszi alapul, ennek hiányában az eszköz Home Assistantban örökölt helyiségét. A csoportos entitások kézzel adhatók hozzá. A Haladó részben a rejtett entitások automatikus felvétele is bekapcsolható. A natív szerkesztőben szekciónként adhatsz hozzá és zárhatsz ki entitásokat. A Haladó részben a kézzel felvett csempék neve és ikonja is megadható. Szekciónként 1–4 oszlop állítható be. Automatikus módban szélesebb kártyán két, keskenyen egy oszlop jelenik meg.

A fejléc a kártyán kiválasztott hőmérséklet- és páratartalom-szenzort használja. Ha a mező üres, az adott helyiség **Kapcsolódó szenzorok** beállítása adja a forrást. Csak a beállított szenzorok jelvényei jelennek meg. Ha egy beállított szenzor éppen elérhetetlen, a jelvénye `—` értéket mutat.

A hőmérséklet- és páratartalom-jelvény az entitás Home Assistant-előzményeit nyitja meg. A hőmérséklet min/max jelvénye az első mérés, illetve az utolsó nullázás óta mutatja a szélsőértékeket. Koppints a min/max jelvényre a nullázáshoz. A tartomány az adott böngészőben mentődik, és a kártya újranyitáskor a Recorder rendelkezésre álló méréseivel egészíti ki.

```yaml
type: custom:ha-room-manager-card
area: nappali
title: Nappali
icon: mdi:sofa
temperature_entity: sensor.nappali_homerseklet
humidity_entity: sensor.nappali_paratartalom
columns:
  covers: 2
  lights: 2
  switches: 2
  security: 3
include:
  covers:
    - cover.nappali_redony
  lights:
    - entity: switch.allolampa
      name: Állólámpa
      icon: mdi:floor-lamp
  switches:
    - switch.teve
  security:
    - binary_sensor.nappali_jelenlet
    - binary_sensor.teraszajto
exclude:
  - switch.router
```

Az `area` mezőbe a Home Assistant helyiségazonosítója kerül. A `type` és az `area` elegendő az automatikus beállításhoz.

A régi `presence` és `openings` listák a Biztonság szekcióban jelennek meg. Az oszlopszámnál a `security`, majd a `presence`, végül az `openings` értéke élvez elsőbbséget.

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
