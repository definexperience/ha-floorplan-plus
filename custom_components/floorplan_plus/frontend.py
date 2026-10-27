"""Frontend static path, sidebar panel and dashboard card for Floorplan Plus.

Registers a full-page custom panel (the "browser_mod pattern"), and loads
the small dashboard card module on every page so the card shows up in the
dashboard card picker without adding a Lovelace resource by hand.
"""

from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components.frontend import (
    add_extra_js_url,
    async_register_built_in_panel,
)
from aiohttp import web

from homeassistant.components.http import HomeAssistantView, StaticPathConfig
from homeassistant.core import HomeAssistant

from .const import (
    CARD_FILENAME,
    FRONTEND_URL_PATH,
    PANEL_FILENAME,
    SIDEBAR_ICON,
    SIDEBAR_TITLE,
    URL_BASE,
)

_LOGGER = logging.getLogger(__name__)

WWW_DIR = Path(__file__).parent / "www"


def _cache_bust_token(filename: str) -> str:
    """Derive a cache-busting query token from a served file's own mtime.

    Deliberately not a hand-maintained version constant — a forgotten bump
    there means a browser keeps serving a stale panel after every redeploy
    (this bit us once already). Tying it to the file's own mtime makes a
    fresh HA restart always pick up whatever was actually last built.
    """
    try:
        return str(int((WWW_DIR / filename).stat().st_mtime))
    except OSError:
        return "0"


# The panel bundle's own URL — outside URL_BASE's static path, so it can be
# served with `Cache-Control: no-cache` (see PanelBundleView).
PANEL_URL = f"{URL_BASE}_panel.js"


class PanelBundleView(HomeAssistantView):
    """Serves the panel bundle with `Cache-Control: no-cache`.

    The registered panel URL only changes at startup (its ?v= token), and
    without cache headers a browser — Safari especially — may reuse a stale
    copy indefinitely after the file is updated in place. no-cache keeps
    caching but revalidates every load (a cheap 304 via ETag/Last-Modified),
    so an updated bundle is always picked up.
    """

    url = PANEL_URL
    name = "floorplan_plus:panel_bundle"
    # Loaded by the frontend as a plain module import, which carries no
    # auth header — same as the static path it replaces.
    requires_auth = False

    async def get(self, request: web.Request) -> web.FileResponse:
        return web.FileResponse(
            WWW_DIR / PANEL_FILENAME, headers={"Cache-Control": "no-cache"}
        )


async def async_register_static_paths(hass: HomeAssistant) -> None:
    """Register /floorplan_plus/* as a static HTTP path serving www/."""
    try:
        await hass.http.async_register_static_paths(
            [StaticPathConfig(URL_BASE, str(WWW_DIR), False)]
        )
        _LOGGER.debug("Static path registered: %s", URL_BASE)
    except RuntimeError:
        _LOGGER.debug("Static path already registered: %s", URL_BASE)
    hass.http.register_view(PanelBundleView())


def async_register_sidebar_panel(hass: HomeAssistant) -> None:
    """Register the Floorplan Plus sidebar panel (browser_mod pattern)."""
    panel_url = f"{PANEL_URL}?v={_cache_bust_token(PANEL_FILENAME)}"

    async_register_built_in_panel(
        hass,
        component_name="custom",
        sidebar_title=SIDEBAR_TITLE,
        sidebar_icon=SIDEBAR_ICON,
        frontend_url_path=FRONTEND_URL_PATH,
        # Every user can view the plan; only admins can edit it. The
        # websocket commands enforce that split (see websocket_api.py).
        require_admin=False,
        config={
            "_panel_custom": {
                "name": "floorplan-plus-panel",
                "js_url": panel_url,
            }
        },
    )
    _LOGGER.debug("Floorplan Plus sidebar panel registered")


def async_register_card(hass: HomeAssistant) -> None:
    """Load the dashboard card module on every frontend page.

    The card imports the panel bundle itself, from the same URL the
    sidebar uses (passed as ?p=), so the browser keeps one copy of it.
    """
    card_url = (
        f"{URL_BASE}/{CARD_FILENAME}"
        f"?v={_cache_bust_token(CARD_FILENAME)}"
        f"&p={_cache_bust_token(PANEL_FILENAME)}"
    )
    add_extra_js_url(hass, card_url)
    _LOGGER.debug("Floorplan Plus dashboard card registered: %s", card_url)
