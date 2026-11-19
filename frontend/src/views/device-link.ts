import { belongsToKey } from "../canvas/device-display";
import { localize } from "../i18n";
import type {
  HomeAssistant,
  Pin,
  PinLinkMode,
  PlaceableEntity,
} from "../types";

/** A link on a device's card, ready to open. */
export interface DeviceLink {
  /** A path inside Home Assistant ("/stations/abc") or a web address. */
  href: string;
  /** Opened inside Home Assistant (no new tab) when true. */
  internal: boolean;
  /** Where it came from: the device's integration, or the admin. */
  source: "device" | "custom";
}

/** The link the device's integration set in Home Assistant (the device
 * registry's configuration_url), read from any of its entities. */
export function deviceConfigurationUrl(
  key: string | null,
  entities: Iterable<PlaceableEntity>,
): string | null {
  for (const e of entities) {
    if (belongsToKey(key, e) && e.device_configuration_url) {
      return e.device_configuration_url;
    }
  }
  return null;
}

/** Turns a link as Home Assistant or an admin writes it into one we can
 * open, or null for anything else (javascript:, a typo). Like Home
 * Assistant's own device page, homeassistant://path means /path inside
 * Home Assistant. */
export function parseLink(
  raw: string | null | undefined,
  source: DeviceLink["source"],
): DeviceLink | null {
  const url = raw?.trim();
  if (!url) return null;
  const ha = /^homeassistant:\/\/(.*)$/i.exec(url);
  if (ha)
    return {
      href: `/${(ha[1] ?? "").replace(/^\/+/, "")}`,
      internal: true,
      source,
    };
  if (url.startsWith("/") && !url.startsWith("//")) {
    return { href: url, internal: true, source };
  }
  if (/^https?:\/\/[^\s/]/i.test(url))
    return { href: url, internal: false, source };
  return null;
}

/** Whether this user can open a path inside Home Assistant. HA only sends
 * a user the sidebar panels they may open, so a link to a page that is
 * only for admins is hidden rather than leading to an error. Without the
 * panel list (an old HA), the link is shown. */
export function canOpenInternal(
  href: string,
  hass: Pick<HomeAssistant, "panels" | "user"> | undefined,
): boolean {
  if (hass?.user?.is_admin) return true;
  const panels = hass?.panels;
  if (!panels) return true;
  const first = href.replace(/^\/+/, "").split(/[/?#]/)[0] ?? "";
  return first in panels;
}

/** The link a pin's card shows to this user, if any: the device's own
 * link (the default), the admin's custom link, or none. */
export function resolveDeviceLink(
  pin: Pick<Pin, "link_mode" | "custom_link"> | null | undefined,
  key: string | null,
  entities: Iterable<PlaceableEntity>,
  hass?: Pick<HomeAssistant, "panels" | "user">,
): DeviceLink | null {
  const mode: PinLinkMode = pin?.link_mode ?? "device";
  if (mode === "none") return null;
  const link =
    mode === "custom"
      ? parseLink(pin?.custom_link, "custom")
      : parseLink(deviceConfigurationUrl(key, entities), "device");
  if (!link) return null;
  if (link.internal && !canOpenInternal(link.href, hass)) return null;
  return link;
}

/** Opens a link: inside Home Assistant the way its own pages navigate,
 * a web address in a new tab. */
export function openDeviceLink(link: DeviceLink): void {
  if (link.internal) {
    history.pushState(null, "", link.href);
    window.dispatchEvent(
      new CustomEvent("location-changed", { detail: { replace: false } }),
    );
  } else {
    window.open(link.href, "_blank", "noopener,noreferrer");
  }
}

/** The link button's text: the admin's own, else "Open in <integration>"
 * for the device's link (the name of whichever integration set it), else
 * "Open link". */
export function linkButtonText(
  pin: Pick<Pin, "link_label"> | null | undefined,
  source: DeviceLink["source"],
  key: string | null,
  entities: Iterable<PlaceableEntity>,
): string {
  const own = pin?.link_label?.trim();
  if (own) return own;
  if (source === "device") {
    for (const e of entities) {
      if (belongsToKey(key, e) && e.integration_name) {
        return localize("deviceCard.openIn", { name: e.integration_name });
      }
    }
  }
  return localize("deviceCard.openLink");
}
