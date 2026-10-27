import { LitElement, css, html, nothing } from "lit";
import { property } from "lit/decorators.js";
import { safeCustomElement } from "../define";
import type { HassEntityState, HomeAssistant, PlaceableEntity } from "../types";
import { pickDisplayEntity } from "../canvas/device-display";
import type { DeviceStatus } from "../canvas/device-state";
import { localize } from "../i18n";
import { sharedStyles, switchStyles } from "../styles";
import { infoCardStyles, renderCard } from "./info-card";

/** Domains a row can switch on and off straight from the card. */
const TOGGLE_DOMAINS = new Set([
  "light",
  "switch",
  "fan",
  "input_boolean",
  "siren",
  "humidifier",
]);
/** At most this many rows; "Open in Home Assistant" shows the rest. */
const MAX_ROWS = 8;

/** Controls first, then readings, then the rest; diagnostics last. */
function rowRank(e: PlaceableEntity): number {
  if (e.entity_category) return 3;
  if (TOGGLE_DOMAINS.has(e.domain)) return 0;
  if (e.domain === "sensor" || e.domain === "binary_sensor") return 1;
  return 2;
}

/** The view-mode card for a tapped device: its live states, quick toggles,
 * and a way into Home Assistant. Admins go to the device page; other users
 * can't open that page in HA, so they get the device's more-info dialog. */
@safeCustomElement("device-card")
export class DeviceCard extends LitElement {
  static override styles = [
    sharedStyles,
    switchStyles,
    infoCardStyles,
    css`
      :host {
        display: contents;
      }
      .info-card {
        top: 12px;
      }
      @media (max-width: 700px) {
        .info-card {
          top: 0;
        }
      }
      .entity-row {
        cursor: pointer;
      }
      .entity-row:hover {
        background: var(--sc-hover);
      }
      .entity-name {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .entity-value {
        color: var(--sc-fg-secondary);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .entity-value.offline {
        color: var(--sc-danger);
      }
      .view-only {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .view-only ha-icon {
        --mdc-icon-size: 18px;
      }
    `,
  ];

  @property({ attribute: false }) hass?: HomeAssistant;
  @property({ attribute: false }) deviceId: string | null = null;
  @property({ attribute: false }) label = "";
  @property({ attribute: false }) subtitle: string | null = null;
  /** Every placeable entity; the card picks this device's own. */
  @property({ attribute: false }) entities: PlaceableEntity[] = [];
  @property({ attribute: false }) status: DeviceStatus | null = null;
  /** The admin made this device view-only: users who aren't admins see
   * its states but get no switches and no more-info dialog (which has
   * its own controls). */
  @property({ attribute: false }) viewOnly = false;

  private get _canControl(): boolean {
    return (this.hass?.user?.is_admin ?? false) || !this.viewOnly;
  }

  private _fire(name: string, detail?: unknown) {
    this.dispatchEvent(
      new CustomEvent(name, { detail, bubbles: true, composed: true }),
    );
  }

  private _moreInfo(entityId: string) {
    this._fire("hass-more-info", { entityId });
  }

  private _openDevicePage() {
    if (!this.deviceId) return;
    history.pushState(null, "", `/config/devices/device/${this.deviceId}`);
    window.dispatchEvent(
      new CustomEvent("location-changed", { detail: { replace: false } }),
    );
  }

  private _toggle(entityId: string) {
    const domain = entityId.split(".")[0]!;
    void this.hass?.callService?.(domain, "toggle", { entity_id: entityId });
  }

  private _rowName(e: PlaceableEntity, st: HassEntityState | undefined) {
    const friendly =
      (st?.attributes?.["friendly_name"] as string | undefined) ?? e.name;
    const device = e.device_name ?? "";
    if (device && friendly.startsWith(device) && friendly !== device) {
      return friendly.slice(device.length).trim();
    }
    return friendly;
  }

  private _value(st: HassEntityState | undefined): string {
    if (!st) return "—";
    if (this.hass?.formatEntityState) return this.hass.formatEntityState(st);
    const unit = st.attributes?.["unit_of_measurement"];
    return unit ? `${st.state} ${String(unit)}` : st.state;
  }

  private _renderRow(e: PlaceableEntity) {
    const st = this.hass?.states[e.entity_id];
    const offline = !st || st.state === "unavailable";
    const canControl = this._canControl;
    const toggle = canControl && TOGGLE_DOMAINS.has(e.domain) && !offline;
    if (!canControl) {
      return html`<div class="info-row">
        ${this._renderRowContent(e, st, offline, false)}
      </div>`;
    }
    return html`<div
      class="info-row entity-row"
      role="button"
      tabindex="0"
      @click=${() => this._moreInfo(e.entity_id)}
      @keydown=${(ev: KeyboardEvent) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          this._moreInfo(e.entity_id);
        }
      }}
    >
      ${this._renderRowContent(e, st, offline, toggle)}
    </div>`;
  }

  private _renderRowContent(
    e: PlaceableEntity,
    st: HassEntityState | undefined,
    offline: boolean,
    toggle: boolean,
  ) {
    return html` ${
        st
          ? html`<ha-state-icon
              .hass=${this.hass}
              .stateObj=${st}
            ></ha-state-icon>`
          : html`<ha-icon icon="mdi:help-circle-outline"></ha-icon>`
      }
      <span class="entity-name" title=${this._rowName(e, st)}
        >${this._rowName(e, st)}</span
      >
      ${
        toggle
          ? html`<input
              type="checkbox"
              class="switch"
              role="switch"
              aria-label=${this._rowName(e, st)}
              .checked=${st?.state === "on"}
              @click=${(ev: Event) => ev.stopPropagation()}
              @keydown=${(ev: Event) => ev.stopPropagation()}
              @change=${() => this._toggle(e.entity_id)}
            />`
          : html`<span class="entity-value ${offline ? "offline" : ""}"
              >${offline ? localize("deviceCard.offline") : this._value(st)}</span
            >`
      }`;
  }

  override render() {
    const own = this.entities
      .filter((e) => e.device_id === this.deviceId)
      .filter((e) => e.entity_category !== "config");
    const rows = [...own]
      .sort((a, b) => rowRank(a) - rowRank(b))
      .slice(0, MAX_ROWS);
    const rep = pickDisplayEntity(this.deviceId, own);
    const isAdmin = this.hass?.user?.is_admin ?? false;
    const hidden = own.length - rows.length;

    return renderCard({
      title: this.label,
      subtitle: this.subtitle ?? undefined,
      onClose: () => this._fire("device-card-close"),
      body: html`
        ${
          this.status?.lowBattery
            ? html`<div class="info-row" style="color: var(--sc-danger)">
                <ha-icon icon="mdi:battery-alert-variant-outline"></ha-icon>
                <span class="grow">${localize("deviceCard.lowBattery")}</span>
              </div>`
            : nothing
        }
        <div class="info-group">
          ${
            rows.length === 0
              ? html`<div class="info-row">
                  <span class="grow info-sub"
                    >${localize("deviceCard.noEntities")}</span
                  >
                </div>`
              : rows.map((e) => this._renderRow(e))
          }
          ${
            hidden > 0
              ? html`<div class="info-row">
                  <span class="grow info-sub"
                    >${localize("deviceCard.more", { count: hidden })}</span
                  >
                </div>`
              : nothing
          }
        </div>
      `,
      footer: html`
        ${
          !this._canControl
            ? html`<span class="info-sub view-only">
                <ha-icon icon="mdi:eye-outline"></ha-icon>
                ${localize("deviceCard.viewOnly")}
              </span>`
            : isAdmin && this.deviceId
              ? html`<button class="primary" @click=${this._openDevicePage}>
                  <ha-icon icon="mdi:open-in-app"></ha-icon>
                  ${localize("deviceCard.openDevice")}
                </button>`
              : rep
                ? html`<button
                    class="primary"
                    @click=${() => this._moreInfo(rep.entity_id)}
                  >
                    <ha-icon icon="mdi:information-outline"></ha-icon>
                    ${localize("deviceCard.details")}
                  </button>`
                : nothing
        }
      `,
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "device-card": DeviceCard;
  }
}
