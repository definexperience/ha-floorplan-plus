"""Config flow for Floorplan Plus — single-instance, no user input needed."""

from __future__ import annotations

from homeassistant import config_entries

from .const import DOMAIN


class FloorplanPlusConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a Floorplan Plus config flow."""

    VERSION = 1

    async def async_step_user(self, user_input: dict | None = None):
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")
        return self.async_create_entry(title="Floorplan Plus", data={})
