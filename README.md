# Room Manager Card

Room Manager is a custom Home Assistant dashboard card for one area. It discovers that area's covers, lights, switches, and security sensors. The visual editor uses Home Assistant's native area and entity pickers, and lets you add or exclude entities and choose the layout of each section.

- **Climate:** The header shows temperature and humidity when their sources are configured. Optional 24-hour charts appear before the other sections, in green for temperature and blue for humidity. Tap a chart or its header badge to open the sensor's native Home Assistant history. The temperature min/max badge tracks readings since the first observation or last reset. Tap it to reset the range. The range is saved in the current browser and can be filled in from available Recorder data when the card reopens.
- **Covers:** Use the supported open, stop, and close buttons. Tap the tile to open the entity details.
- **Lights and switches:** Tap a tile to toggle it. Drag a dimmable light tile sideways to set brightness; the fill follows the brightness. With the tile focused, you can also use the arrow keys, Home, and End. Tap the active count in either section to turn off its active entities. The header light count also turns off the active lights.
- **Security:** Motion and presence share a section with door and window sensors. Inactive sensors are green, detected motion or presence is yellow, and open contacts are red. Tap a tile for entity details.

The header only shows cover, light, and switch counts when at least one item in that group is active. Security can show **All closed** even when no contact is open.

## Installation

### HACS or Marketplace

1. Add [`wzsolt/ha-card-room-manager`](https://github.com/wzsolt/ha-card-room-manager) as a custom **Dashboard** repository. In HACS, use **Custom repositories**. In Home Assistant 2026.11 and later, use **Settings → Marketplace → Add from link**.
2. Install **Room Manager Card** and reload the browser. If you manage dashboard resources in YAML, register the JavaScript module at the URL shown by the installer.
3. Edit your dashboard, add **Room Manager**, and select an area.

### Manual installation

Download `ha-room-manager-card.js` from [GitHub Releases](https://github.com/wzsolt/ha-card-room-manager/releases) and copy it to `/config/www/` on your Home Assistant server. Add `/local/ha-room-manager-card.js` as a **JavaScript module** resource, then reload the dashboard.

## Configuration

Select an area in the visual editor. Each device section offers a column setting, an **Add entity** picker, and an exclusion picker. You can add entities from another area or with no area assigned. Use **Advanced** to include hidden entities in discovery or to customize the name and icon of manually added tiles.

For automatic discovery, an entity's own area takes precedence over the area inherited from its device. Disabled entities and groups are skipped. Hidden entities are skipped by default, and configuration or diagnostic covers, lights, and switches are skipped. Automatic Security discovery uses binary sensors with the `motion`, `occupancy`, `presence`, `door`, `window`, `opening`, or `garage_door` device class. A manual entry can move an entity to another compatible section, such as a smart plug that controls a lamp.

For each climate measurement, the card uses the sensor selected in the card first, then the area’s related sensor in Home Assistant. With no sensor configured, the corresponding header badge and chart are omitted. A configured sensor without a valid reading shows `—`. The charts use the last 24 hours of Recorder history, refreshed about every five minutes. If Recorder has no history for the sensor, the chart tile still displays the current reading.

### YAML options

The minimum configuration is:

```yaml
type: custom:ha-room-manager-card
area: living_room
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `type` | string | Required | Use `custom:ha-room-manager-card`. |
| `area` | string | Required | Home Assistant area ID, such as `living_room`. |
| `title` | string | Area name | Overrides the card heading. |
| `icon` | string | Area icon or `mdi:home-outline` | Overrides the card heading icon. |
| `temperature_entity` | sensor entity ID | Area temperature sensor | Overrides the temperature source for the badge, min/max range, and chart. |
| `humidity_entity` | sensor entity ID | Area humidity sensor | Overrides the humidity source for the badge and chart. |
| `show_temperature_chart` | boolean | `false` | Shows the green temperature chart when a source is configured. |
| `show_humidity_chart` | boolean | `false` | Shows the blue humidity chart when a source is configured. |
| `show_brightness` | boolean | `true` | Shows brightness and enables drag and keyboard adjustment on compatible lights. |
| `include_hidden` | boolean | `false` | Allows hidden entities to be discovered automatically. |
| `columns` | mapping | Automatic | Set `covers`, `lights`, `switches`, or `security` to an integer from 1 to 4. An unset section uses one column on narrow cards and two on wider cards. |
| `include` | mapping | Empty | Manually adds entities to the named sections listed below. |
| `exclude` | list of entity IDs | Empty | Skips entities during automatic discovery. An explicit `include` entry takes precedence. |

The keys under `include` are:

| Key | Accepted entity domains |
| --- | --- |
| `covers` | `cover` |
| `lights` | `light`, `switch` |
| `switches` | `switch` |
| `security` | `binary_sensor` |

Each entry can be a bare entity ID or an object with a required `entity` and optional `name` and `icon`. By default, sensors use their Home Assistant friendly name. An entity appears only once. If it is manually included in more than one section, the first compatible section in card order wins: Covers, Lights, Switches, Security.

Legacy `include.presence` and `include.openings` entries are merged into Security after `include.security`. The legacy column keys are also supported, with precedence `columns.security`, then `columns.presence`, then `columns.openings`.

### Complete example

```yaml
type: custom:ha-room-manager-card
area: living_room
title: Living Room
icon: mdi:sofa
temperature_entity: sensor.living_room_temperature
humidity_entity: sensor.living_room_humidity
show_temperature_chart: true
show_humidity_chart: true
show_brightness: true
include_hidden: false
columns:
  covers: 2
  lights: 2
  switches: 2
  security: 3
include:
  covers:
    - cover.living_room_blind
  lights:
    - light.ceiling
    - entity: switch.floor_lamp
      name: Floor lamp
      icon: mdi:floor-lamp
  switches:
    - switch.television
  security:
    - binary_sensor.living_room_motion
    - binary_sensor.patio_door
exclude:
  - switch.router
```
