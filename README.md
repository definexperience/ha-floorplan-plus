# Floorplan Plus

A floor plan for Home Assistant that is quick to click together and pleasant to look at every day. Trace your rooms over a picture of your floor plan, place your real devices on it, see your Zigbee and Wi-Fi network where it physically is, and include the garden and outbuildings on a property view.

Floorplan Plus is a fork of [Spatial Context](https://github.com/Greminn/ha-spatial-context) by Greminn, which does the editing, the network layers and the property view. This fork adds what we need for daily use:

- **A view mode for everyone.** Every Home Assistant user can look at the plan; only admins can change it.
- **Live state on the plan.** Lights glow when they're on, and temperature, doors and windows, motion, battery and offline devices show at a glance.
- **Tap through to Home Assistant.** Tap a device for its states and quick toggles, and open it in Home Assistant.
- **Zoom to a room** when you tap it, and a **dashboard card** for wall tablets and phones.
- **Suggested devices per room.** Link a room to a Home Assistant area and its devices are offered first, ready to drop into the room in one click.
- **English, Dutch and German.**

It is installed under its own name (`floorplan_plus`), so it can sit next to Spatial Context without clashing.

## Installation

Needs **Home Assistant 2024.10** or newer, with your floors set up in **Settings → Areas → Floors**.

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=definexperience&repository=ha-spatial-context&category=integration)

1. Click the button above, or in HACS choose **⋮ → Custom repositories**, paste `https://github.com/definexperience/ha-spatial-context` and set **Type** to **Integration**.
2. Install **Floorplan Plus**.
3. Restart Home Assistant, then **Settings → Devices & Services → Add Integration → Floorplan Plus**.

Prefer to copy files by hand? Put `custom_components/floorplan_plus/` into your `/config/custom_components/`.

## Quick start

1. Open **Floorplan Plus** from the sidebar and pick a floor tab.
2. Add a background image, then **Set Scale** by clicking two points a known distance apart.
3. **Trace Room** and **Trace Wall**, then **Place Device** to drop your devices on the plan.
4. Repeat for each floor, use **Align Floors** for floors that stack, and place buildings on the **Property** tab.

Changes save automatically. Editing works the same as in Spatial Context, so its [user guide](https://greminn.github.io/ha-spatial-context/) applies: [your first floor plan](https://greminn.github.io/ha-spatial-context/guide/first-floor-plan), [placing devices](https://greminn.github.io/ha-spatial-context/guide/placing-devices), the [Connectivity Map](https://greminn.github.io/ha-spatial-context/guide/connectivity-map) and the [Property tab](https://greminn.github.io/ha-spatial-context/guide/property-tab).

## Dashboard card

Add the **Floorplan Plus** card to any dashboard (**Edit dashboard → Add card**, then search for Floorplan Plus). It shows the same plan as the sidebar with live states, and it is view only for everyone, so it is safe on a shared wall tablet. Editing always happens in the sidebar panel.

```yaml
type: custom:floorplan-plus-card
floor: ground_floor   # optional: the floor to open on
area: kitchen         # optional: zoom in on the room linked to this area
height: 450           # optional: card height in pixels
show_header: true     # optional: floor tabs and network layers
```

The card registers itself; there is no dashboard resource to add.

## Map data for automations

`floorplan_plus.get_map` returns the whole layout (floors, rooms, walls, doors, windows and every placed device in real units) as the action's response.

```yaml
actions:
  - action: floorplan_plus.get_map
    response_variable: home_map
```

The shape is described in [the original map data guide](https://greminn.github.io/ha-spatial-context/ai/map-data).

## Feedback

Found a bug, or have an idea? Please [open an issue](https://github.com/definexperience/ha-spatial-context/issues).

## Development and licence

Building, testing and releasing are covered in [docs/development.md](docs/development.md). The panel is built from `frontend/` (Lit and TypeScript) and the output is committed, so HACS and a manual copy need no build step.

[MIT](LICENSE). Based on Spatial Context, copyright Simon Buchanan. If the original is useful to you, you can [support its author](https://buymeacoffee.com/greminn).
