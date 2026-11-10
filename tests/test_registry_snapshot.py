"""Tests for the placeable-entity list (registry_snapshot.py): entities with
no device are offered on their own, and an entity placed on a pin of its
own reports where it is, apart from its device.

Runs without Home Assistant: the registries are small stand-ins.

    python3 -m unittest discover -s tests
"""

from __future__ import annotations

import asyncio
import types
import unittest

import stubs

NS = types.SimpleNamespace


def entry(entity_id, device_id=None, platform="mqtt", **kw):
    return NS(
        entity_id=entity_id,
        domain=entity_id.split(".")[0],
        device_id=device_id,
        platform=platform,
        disabled_by=None,
        area_id=kw.get("area_id"),
        name=None,
        original_name=kw.get("name", entity_id),
        icon=None,
        original_icon=None,
        device_class=None,
        original_device_class=None,
        entity_category=None,
    )


ENTRIES = {
    e.entity_id: e
    for e in [
        entry("light.relay_kitchen", "relay"),
        entry("switch.relay_boiler", "relay"),
        entry("light.stairs", "stair"),
        entry("input_boolean.guests", platform="input_boolean", area_id="kitchen"),
        entry("automation.night", platform="automation"),
    ]
}
DEVICES = {
    "relay": NS(id="relay", name="Relay board", name_by_user=None, area_id="kitchen",
                entry_type=None, config_entry_id="ce1"),
    "stair": NS(id="stair", name="Stair light", name_by_user=None, area_id="hall",
                entry_type=None, config_entry_id="ce1"),
}
LAYOUTS = {
    "ground": {"pins": [
        {"id": "p1", "device_id": None, "single_entity_id": "light.relay_kitchen"},
        {"id": "p2", "device_id": "stair"},
    ]},
    # The same stair light on the floor above too.
    "first": {"pins": [{"id": "p3", "device_id": "stair"}]},
}
FLOOR_NAMES = {"ground": "Ground floor", "first": "First floor"}


class States:
    def __init__(self, states):
        self._states = states

    def get(self, entity_id):
        return next((s for s in self._states if s.entity_id == entity_id), None)

    def async_all(self):
        return self._states


def state(entity_id, name):
    return NS(entity_id=entity_id, domain=entity_id.split(".")[0], name=name, attributes={})


stubs.new_package("sc_registry_test")
stubs.stub("homeassistant")
stubs.stub("homeassistant.core", HomeAssistant=object)
helpers = stubs.stub("homeassistant.helpers")
stubs.stub("homeassistant.loader", async_get_integration=None)
for mod, getter in {
    "entity_registry": lambda hass: NS(entities=ENTRIES, async_get=ENTRIES.get),
    # Iterated as the code under test does (device objects), looked up by id.
    "device_registry": lambda hass: NS(devices=list(DEVICES.values()), async_get=DEVICES.get),
    "area_registry": lambda hass: NS(async_get_area=lambda a: NS(name=a.title())),
    "floor_registry": lambda hass: NS(
        async_list_floors=lambda: [NS(floor_id=f) for f in FLOOR_NAMES],
        async_get_floor=lambda f: NS(name=FLOOR_NAMES[f]) if f in FLOOR_NAMES else None,
    ),
}.items():
    m = stubs.stub(f"homeassistant.helpers.{mod}", async_get=getter)
    setattr(helpers, mod, m)


async def _layouts(hass):
    return LAYOUTS


async def _property(hass):
    return {"pins": []}


stubs.stub(
    "sc_registry_test.storage",
    PROPERTY_LOCATION_ID="__property__",
    async_get_all_layouts=_layouts,
    async_get_property_layout=_property,
    async_save_all_layouts_raw=None,
    layout_bounds=None,
    live_layouts=lambda layouts, ids: layouts,
    meters_per_unit=None,
)
registry = stubs.load("sc_registry_test", "registry_snapshot")


async def _integration(hass, domain):
    return NS(name=domain.upper())


registry.async_get_integration = _integration


class PlaceableEntitiesTest(unittest.TestCase):
    def setUp(self) -> None:
        hass = stubs.FakeHass()
        hass.config_entries = NS(async_get_entry=lambda i: NS(domain="mqtt"))
        hass.states = States([
            state("light.relay_kitchen", "Relay board Kitchen"),
            state("input_boolean.guests", "Guest mode"),
            state("sensor.yaml_only", "YAML sensor"),
            state("zone.home", "Home"),
        ])
        self.entities = {
            e["entity_id"]: e for e in asyncio.run(registry.async_list_placeable_entities(hass))
        }

    def test_lists_device_and_deviceless_entities_but_not_automations(self) -> None:
        self.assertEqual(
            sorted(self.entities),
            [
                "input_boolean.guests",
                "light.relay_kitchen",
                "light.stairs",
                "sensor.yaml_only",
                "switch.relay_boiler",
            ],
        )

    def test_a_deviceless_entity_has_no_device(self) -> None:
        guests = self.entities["input_boolean.guests"]
        self.assertIsNone(guests["device_id"])
        self.assertEqual(guests["area_name"], "Kitchen")
        self.assertIsNone(self.entities["sensor.yaml_only"]["device_id"])

    def test_an_entity_on_its_own_pin_reports_its_floor_not_its_device(self) -> None:
        kitchen = self.entities["light.relay_kitchen"]
        self.assertEqual(kitchen["entity_placed_floor_id"], "ground")
        self.assertEqual(kitchen["entity_placed_floor_name"], "Ground floor")
        # The relay board itself isn't placed, so it stays placeable.
        self.assertIsNone(kitchen["placed_floor_id"])
        self.assertIsNone(self.entities["switch.relay_boiler"]["entity_placed_floor_id"])
        self.assertEqual(kitchen["placed_floor_ids"], [])

    def test_a_device_on_two_floors_reports_both(self) -> None:
        stairs = self.entities["light.stairs"]
        self.assertEqual(stairs["placed_floor_ids"], ["ground", "first"])
        self.assertEqual(stairs["placed_floor_names"], ["Ground floor", "First floor"])
        # The single fields older frontends read: the first floor.
        self.assertEqual(stairs["placed_floor_id"], "ground")
        self.assertEqual(stairs["placed_floor_name"], "Ground floor")


if __name__ == "__main__":
    unittest.main()
