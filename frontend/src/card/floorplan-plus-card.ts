/** The Floorplan Plus dashboard card.
 *
 * Deliberately tiny and Lit-free: Home Assistant loads this file on every
 * page (see frontend.py's async_register_card), so it only defines the card
 * and its editor form. The plan itself is the sidebar panel's own element,
 * <floorplan-plus-panel embedded>, imported the first time a card renders
 * from the same URL the sidebar uses — so opening both loads it once.
 */

import type { CardOptions, HomeAssistant } from "../types";

interface CardConfig extends CardOptions {
  type: string;
  /** Card height in pixels. */
  height?: number;
}

type PanelElement = HTMLElement & {
  hass: HomeAssistant;
  embedded: boolean;
  cardOptions: CardOptions;
};

const DEFAULT_HEIGHT = 450;

const STRINGS: Record<string, Record<string, string>> = {
  en: {
    name: "Floorplan Plus",
    description: "Your floor plan with live device states. View only.",
    loading: "Loading floor plan…",
    loadError: "Couldn't load the floor plan. Reload the page to try again.",
    floor: "Floor",
    floorHelper: "The floor the card opens on. Empty: the first floor.",
    area: "Room",
    areaHelper:
      "Zooms in on the room linked to this area. Empty: the whole floor.",
    height: "Height",
    show_header: "Show floor tabs and network layers",
  },
  nl: {
    name: "Floorplan Plus",
    description: "Je plattegrond met live apparaatstatussen. Alleen bekijken.",
    loading: "Plattegrond laden…",
    loadError:
      "De plattegrond kon niet worden geladen. Herlaad de pagina om het opnieuw te proberen.",
    floor: "Verdieping",
    floorHelper:
      "De verdieping waarop de kaart opent. Leeg: de eerste verdieping.",
    area: "Ruimte",
    areaHelper:
      "Zoomt in op de getekende kamer die aan deze ruimte gekoppeld is. Leeg: de hele verdieping.",
    height: "Hoogte",
    show_header: "Verdiepingstabbladen en netwerklagen tonen",
  },
  de: {
    name: "Floorplan Plus",
    description: "Dein Grundriss mit Live-Gerätezuständen. Nur Ansicht.",
    loading: "Grundriss wird geladen…",
    loadError:
      "Der Grundriss konnte nicht geladen werden. Lade die Seite neu, um es erneut zu versuchen.",
    floor: "Etage",
    floorHelper: "Die Etage, mit der die Karte öffnet. Leer: die erste Etage.",
    area: "Raum",
    areaHelper:
      "Zoomt auf den Raum, der mit diesem Bereich verknüpft ist. Leer: die ganze Etage.",
    height: "Höhe",
    show_header: "Etagen-Tabs und Netzwerkebenen anzeigen",
  },
};

/** HA keeps <html lang> on the user's language, which is all the card
 * needs before (and without) a hass object, e.g. in the card picker. */
function t(key: string): string {
  const lang = document.documentElement.lang?.split("-")[0] ?? "en";
  return STRINGS[lang]?.[key] ?? STRINGS["en"]![key] ?? key;
}

/** The panel bundle's URL, with the same cache-bust token the sidebar
 * uses (frontend.py passes it as ?p=), so the browser shares one copy. */
function panelUrl(): string {
  const token = new URL(import.meta.url).searchParams.get("p");
  return `/floorplan_plus_panel.js${token ? `?v=${token}` : ""}`;
}

let panelLoad: Promise<unknown> | null = null;

function loadPanel(): Promise<unknown> {
  if (customElements.get("floorplan-plus-panel")) return Promise.resolve();
  panelLoad ??= import(/* @vite-ignore */ panelUrl()).catch((err) => {
    panelLoad = null;
    throw err;
  });
  return panelLoad;
}

const STYLE = `
  ha-card {
    overflow: hidden;
  }
  .body {
    position: relative;
  }
  .message {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 16px;
    box-sizing: border-box;
    text-align: center;
    color: var(--secondary-text-color);
  }
`;

class FloorplanPlusCard extends HTMLElement {
  private _config?: CardConfig;
  private _hass?: HomeAssistant;
  private _panel: PanelElement | undefined;
  /** Bumped on every build, so a slow first load can't land in a body
   * that a newer config already replaced. */
  private _build = 0;

  static getStubConfig(): Partial<CardConfig> {
    return { show_header: true };
  }

  static getConfigForm() {
    return {
      schema: [
        { name: "floor", selector: { floor: {} } },
        { name: "area", selector: { area: {} } },
        {
          name: "height",
          selector: {
            number: {
              min: 200,
              max: 1600,
              step: 10,
              mode: "box",
              unit_of_measurement: "px",
            },
          },
        },
        { name: "show_header", selector: { boolean: {} } },
      ],
      computeLabel: (schema: { name: string }) => t(schema.name),
      computeHelper: (schema: { name: string }) =>
        schema.name === "floor" || schema.name === "area"
          ? t(`${schema.name}Helper`)
          : undefined,
    };
  }

  setConfig(config: CardConfig): void {
    if (!config) throw new Error("Invalid configuration");
    this._config = { ...config };
    this._render();
  }

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    if (this._panel) this._panel.hass = hass;
  }

  private get _height(): number {
    const height = Number(this._config?.height);
    return Number.isFinite(height) && height >= 120 ? height : DEFAULT_HEIGHT;
  }

  /** Masonry dashboards count in rows of about 50px. */
  getCardSize(): number {
    return Math.ceil(this._height / 50);
  }

  /** Sections dashboards: full width by default, and no fixed rows, so
   * the card keeps the height it was given. */
  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  private _render(): void {
    const config = this._config;
    if (!config) return;
    const build = ++this._build;
    const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${STYLE}</style><ha-card><div class="body"><div class="message"></div></div></ha-card>`;
    const body = root.querySelector<HTMLElement>(".body")!;
    body.style.height = `${this._height}px`;
    body.querySelector(".message")!.textContent = t("loading");
    this._panel = undefined;

    loadPanel().then(
      () => {
        if (build !== this._build) return;
        const panel = document.createElement(
          "floorplan-plus-panel",
        ) as PanelElement;
        // Before hass: the panel starts loading on its first hass.
        panel.embedded = true;
        const options: CardOptions = {};
        if (config.floor) options.floor = config.floor;
        if (config.area) options.area = config.area;
        if (config.show_header === false) options.show_header = false;
        panel.cardOptions = options;
        if (this._hass) panel.hass = this._hass;
        body.replaceChildren(panel);
        this._panel = panel;
      },
      (err: unknown) => {
        if (build !== this._build) return;
        console.error("floorplan-plus: couldn't load the panel", err);
        body.querySelector(".message")!.textContent = t("loadError");
      },
    );
  }
}

if (!customElements.get("floorplan-plus-card")) {
  customElements.define("floorplan-plus-card", FloorplanPlusCard);
}

const windowWithCards = window as unknown as {
  customCards?: {
    type: string;
    name: string;
    description: string;
    preview?: boolean;
    documentationURL?: string;
  }[];
};
windowWithCards.customCards = windowWithCards.customCards ?? [];
if (
  !windowWithCards.customCards.some((c) => c.type === "floorplan-plus-card")
) {
  windowWithCards.customCards.push({
    type: "floorplan-plus-card",
    name: t("name"),
    description: t("description"),
    preview: true,
    documentationURL: "https://github.com/definexperience/ha-spatial-context",
  });
}
