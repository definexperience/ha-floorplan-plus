# Changelog

Floorplan Plus is a fork of [Spatial Context](https://github.com/Greminn/ha-spatial-context). Entries from 1.0.0 down are the original project's.

## Unreleased

### Added
- A **home button** in the zoom controls that glides back to the whole plan.
- **Per-device permissions**: admins can make a device view only, so users who aren't admins see its state but get no switches or Home Assistant dialog for it.
- **Show name on the plan**, per device.
- A light that's on **glows** around its marker in its own colour, wider and stronger the brighter it is. Lights are drawn as a light bulb unless another icon was picked.
- A Floorplan Plus logo and icon, shown in Home Assistant and HACS.
- A **Floorplan Plus** dashboard card: the plan with live states, view only for everyone. Pick a floor to open on, zoom in on one room, set the height, and show or hide the floor tabs. It registers itself, so there is no dashboard resource to add.
- **Suggested devices per room** while placing devices: for each room linked to a Home Assistant area, that area's devices that aren't on the plan yet are listed first. Place one, or all of them at once, straight into the room. Selecting a room first narrows the list to that room.
- **Layers**. Every device sits on a standard layer (lights, switches, sensors, climate, screens and media, cameras, security, other), picked from its main entity or chosen per device. Home Assistant labels can be used as extra layers, and a device can be on several. Everyone can switch layers on and off from the new Layers menu; layers with nothing on the current floor are left out outside edit mode. In edit mode admins create, rename and remove layers, restore removed standard layers and hide network layers, all from the plan. The dashboard card can limit which layers it offers (devices on the others are hidden there) and which start hidden.
- **Reading on the plan**, per device: pick which of its entities is shown next to its marker, formatted by Home Assistant.
- **Lit area** for lights: instead of the glow, fill the light's whole room or a shape traced on the plan, in the light's colour while it's on.
- **Detection zone**, per device: a wedge with its range, width and direction, grey while clear and green while its presence sensor detects someone. Not drawn while the device is offline. Needs the floor's scale.

### Fixed
- Stateless switches (RF, IR and others that only assume their state) get separate **off** and **on** buttons in the device card, like Home Assistant shows them, instead of a switch that claims a state they can't report.
- Adding the dashboard card no longer hangs. The card often loaded before Home Assistant's own frontend was ready, so the card picker and editor kept waiting for it.
- The panel now follows the Home Assistant user's language. Dutch and German strings were shipped but the panel always showed English.

### Changed
- A device no longer shows its temperature next to its marker automatically. Pick a reading in its options to show one.
- Renamed to Floorplan Plus (domain `floorplan_plus`), so it can be installed next to Spatial Context without clashing. The panel, actions (`floorplan_plus.get_map`), storage and debug log use the new name.
- The repository is renamed to `definexperience/ha-floorplan-plus`, and repository, issue and release links point to it. See the README for re-adding it in HACS.
- The README documents everything this fork adds, with screenshots, and how to update through HACS. The user guide still links to the original documentation.

Notes for the original releases are on the [Spatial Context releases page](https://github.com/Greminn/ha-spatial-context/releases).

## 1.0.0

The first stable release.

### Added
- A full documentation site, with a first floor plan walkthrough and a page for each feature.
- A key for the Connectivity Map that explains solid, dashed and grey lines, shows the weakest and strongest readings on screen, and reads off the value as you move along the bar.
- Zigbee layer support for ZHA, as well as Zigbee2MQTT.
- A Thread border router setting for the Matter layer.
- A placed and not-placed filter in the device list, with buttons to find a placed device on the plan or remove it.
- A **Use area name** button on a room, a **Getting started guide** link in the menu, and menus that close when you click away.
- A copy of the layout is kept for each version, and a version that is older than the one that saved the layout refuses to load it.

### Changed
- The panel and every command are for administrators only.
- Errors shown in the panel are short messages, and the detail goes to the Home Assistant log.
- Saves have size limits, and the debug log masks web and IP addresses.
- Zigbee readings of 0 or 1, which are stale entries in a neighbour table, are ignored. A link with no real reading is drawn grey.
- New buildings on the Property tab are placed at their real-world size.
- The panel code is split into smaller modules, and tests now run in CI.

### Fixed
- The device registry is read the way Home Assistant now expects.

## Before 1.0.0

Releases up to 0.16.0-beta.2 were pre-releases. They built the floor plan editor, the Property tab, the Connectivity Map layers (Zigbee, Wi-Fi, Matter and Bluetooth), the map data and the `get_map` action, English and German translations, and the native Home Assistant look. See the [releases page](https://github.com/Greminn/ha-spatial-context/releases) for each one.
