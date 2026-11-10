import { LitElement, html, nothing, type PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { safeCustomElement } from "../define";
import { PROPERTY_LOCATION_ID } from "../types";
import type { AreaMeta, FloorMeta, PlaceableEntity, Room } from "../types";
import {
  entityIconName,
  entityKey,
  pickDisplayEntity,
} from "../canvas/device-display";
import { localize } from "../i18n";
import { selectStyles, sharedStyles } from "../styles";
import { entityPickerSidebarStyles } from "./entity-picker-sidebar-styles";
import { otherFloorNames } from "./placed-floors";

/** Fallback row icon when a device's integration has no brand logo on
 * brands.home-assistant.io (see the `<img>`/`@error` pair below) — one
 * generic glyph for every device, derived from its ranked representative
 * entity (see canvas/device-display.ts's pickDisplayEntity), never an
 * arbitrary one. */
const GENERIC_DEVICE_ICON_NAME = "mdi:devices";

interface DeviceGroup {
  deviceId: string;
  deviceName: string;
  areaId: string | null;
  areaName: string | null;
  integrationDomain: string | null;
  integrationName: string | null;
  entities: PlaceableEntity[];
  primaryEntityId: string;
}

interface Suggestion {
  room: Room;
  devices: DeviceGroup[];
}

/** The entities of a device worth a pin of their own (a relay board's
 * channels): its main ones, or every one when it has nothing else. */
function ownPinCandidates(entities: PlaceableEntity[]): PlaceableEntity[] {
  const main = entities.filter((e) => !e.entity_category);
  return main.length > 0 ? main : entities;
}

/** An entity's name inside its device's list: "Relay board Kitchen" is
 * just "Kitchen" there. */
function shortName(e: PlaceableEntity): string {
  const device = e.device_name ?? "";
  if (device && e.name.startsWith(device) && e.name !== device) {
    return e.name.slice(device.length).trim() || e.name;
  }
  return e.name;
}

@safeCustomElement("entity-picker-sidebar")
export class EntityPickerSidebar extends LitElement {
  static override styles = [
    sharedStyles,
    selectStyles,
    entityPickerSidebarStyles,
  ];

  @state() private _menuOpen = false;
  @property({ attribute: false }) entities: PlaceableEntity[] = [];
  /** Pin keys placed on the plan shown (see canvas/device-display.ts's
   * pinKey): device_ids, and `entity:<id>` for single-entity pins. */
  @property({ attribute: false }) placedDeviceIds: Set<string> = new Set();
  @property({ attribute: false }) armedEntityId: string | null = null;
  @property({ attribute: false }) floors: FloorMeta[] = [];
  @property({ attribute: false }) areas: AreaMeta[] = [];
  @property({ attribute: false }) currentFloorId: string | null = null;
  /** Floor-less areas (a Back Deck, say) that a room on the current floor
   * is linked to — counted as part of the current floor by the floor
   * filter, since that's where they've been drawn. */
  @property({ attribute: false }) linkedAreaIds: Set<string> = new Set();
  /** The open floor's rooms: each one linked to an HA area suggests that
   * area's devices that aren't on the plan yet. */
  @property({ attribute: false }) rooms: Room[] = [];
  /** The selected room, if any: then only its suggestions show. */
  @property({ attribute: false }) focusRoomId: string | null = null;

  @state() private _search = "";
  /** null = "follow whichever floor is currently open" (the useful default
   * while placing devices onto that floor's plan); "all" = no floor
   * scoping at all; anything else is an explicit floor_id the user picked
   * from the dropdown, overriding the follow-current-floor default. */
  @state() private _floorFilter: string | "all" | null = null;
  @state() private _areaFilter: string | null = null;
  @state() private _placedFilter: "all" | "unplaced" | "placed" = "all";
  /** Device rows opened to show their entities, by device_id. */
  @state() private _expanded: Set<string> = new Set();
  @state() private _otherCollapsed = false;

  // --- resizable width (per-browser, not shared — see #22) --------------

  private static readonly WIDTH_STORAGE_KEY =
    "floorplan-plus.entityPickerSidebarWidth";
  private static readonly MIN_WIDTH = 240;
  private static readonly MAX_WIDTH = 600;

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("pointerdown", this._onOutsidePress, true);
  }

  override updated(changed: PropertyValues): void {
    if (!changed.has("_menuOpen")) return;
    document.removeEventListener("pointerdown", this._onOutsidePress, true);
    if (this._menuOpen) {
      document.addEventListener("pointerdown", this._onOutsidePress, true);
    }
  }

  /** The more menu closes on a press anywhere outside it and its button. */
  private _onOutsidePress = (event: PointerEvent) => {
    const inside = event
      .composedPath()
      .some(
        (el) =>
          el instanceof HTMLElement &&
          (el.classList.contains("more-menu") ||
            el.classList.contains("more-button")),
      );
    if (!inside) this._menuOpen = false;
  };

  override connectedCallback(): void {
    super.connectedCallback();
    const stored = this._readStoredWidth();
    if (stored !== null) {
      this.style.setProperty("--sc-picker-width", `${stored}px`);
    }
  }

  /** localStorage is a deliberate exception in this codebase — everything
   * else is server-persisted (Store-backed layout, or the shared Settings
   * object), but a sidebar's width is a personal screen-ergonomics
   * preference, not a fact every viewer should share. Browser storage can
   * throw or come back empty (private mode, quota, disabled) — never let
   * that break rendering or resizing itself. */
  private _readStoredWidth(): number | null {
    try {
      const raw = localStorage.getItem(EntityPickerSidebar.WIDTH_STORAGE_KEY);
      if (!raw) return null;
      const n = Number(raw);
      if (!Number.isFinite(n)) return null;
      return Math.min(
        EntityPickerSidebar.MAX_WIDTH,
        Math.max(EntityPickerSidebar.MIN_WIDTH, n),
      );
    } catch {
      return null;
    }
  }

  private _writeStoredWidth(width: number): void {
    try {
      localStorage.setItem(
        EntityPickerSidebar.WIDTH_STORAGE_KEY,
        String(width),
      );
    } catch {
      // Won't persist across reloads — resizing itself still works fine.
    }
  }

  private _onResizeHandlePointerDown = (e: PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = this.getBoundingClientRect().width;
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      // The handle sits on the sidebar's LEFT edge, and the sidebar is
      // anchored to the right of the canvas — dragging left (negative
      // clientX delta) should grow it, hence startX - clientX rather than
      // the more usual clientX - startX.
      const dx = startX - ev.clientX;
      const width = Math.min(
        EntityPickerSidebar.MAX_WIDTH,
        Math.max(EntityPickerSidebar.MIN_WIDTH, startWidth + dx),
      );
      this.style.setProperty("--sc-picker-width", `${width}px`);
    };
    const onUp = (ev: PointerEvent) => {
      handle.releasePointerCapture(ev.pointerId);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      this._writeStoredWidth(Math.round(this.getBoundingClientRect().width));
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  };

  private get _effectiveFloorFilter(): string | null {
    if (this._floorFilter === "all") return null;
    return this._floorFilter ?? this.currentFloorId;
  }

  /** Areas offered in the Area dropdown — scoped to the selected floor
   * filter (or every area, once floor scoping is set to "all"). */
  private get _areasForFilter(): AreaMeta[] {
    const floorId = this._effectiveFloorFilter;
    return floorId === null
      ? this.areas
      : this.areas.filter((a) => this._areaIsOnFloor(a, floorId));
  }

  private _areaIsOnFloor(area: AreaMeta, floorId: string): boolean {
    // The Property tab's "floor": every area HA has on no floor at all.
    if (floorId === PROPERTY_LOCATION_ID) return area.floor_id === null;
    return (
      area.floor_id === floorId ||
      (floorId === this.currentFloorId && this.linkedAreaIds.has(area.area_id))
    );
  }

  private _onFloorFilterChange = (e: Event) => {
    const value = (e.target as HTMLSelectElement).value;
    this._floorFilter = value === "all" ? "all" : value;
    // Drop an area choice that no longer belongs to the newly-selected floor.
    if (
      this._areaFilter &&
      !this._areasForFilter.some((a) => a.area_id === this._areaFilter)
    ) {
      this._areaFilter = null;
    }
  };

  private get _devices(): DeviceGroup[] {
    const groups = new Map<string, PlaceableEntity[]>();
    for (const e of this.entities) {
      // Entities with no device are listed apart (see _otherEntities).
      if (!e.device_id) continue;
      const key = e.device_id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    }

    const devices: DeviceGroup[] = [];
    for (const [deviceId, entities] of groups) {
      // Placement is per physical device, not per entity — a device with
      // several entities (e.g. a combo temp/humidity/motion sensor) still
      // occupies one spot in the house, so it gets one row and one pin.
      // Which entity represents it isn't arbitrary, though: a helper
      // integration (Dynamic Energy Cost, a utility meter, ...) can attach
      // its own entities to another integration's device, so the same
      // ranked pick used for the export applies here too (see
      // canvas/device-display.ts's pickDisplayEntity) — falls back to
      // entities[0] only in the deviceId-was-really-an-entity_id edge case
      // (see the `groups` key above), where nothing can match by device_id.
      const primary = pickDisplayEntity(deviceId, entities) ?? entities[0]!;
      devices.push({
        deviceId,
        deviceName: primary.device_name ?? primary.name,
        areaId: primary.area_id,
        areaName: primary.area_name,
        integrationDomain: primary.integration_domain,
        integrationName: primary.integration_name,
        entities,
        primaryEntityId: primary.entity_id,
      });
    }
    devices.sort((a, b) => a.deviceName.localeCompare(b.deviceName));
    return devices;
  }

  /** The other floors (names) this device is already placed on, besides
   * the one open. A device may sit on several floors at once (a staircase
   * light on both floors it spans), so this only informs, never blocks. */
  private _otherFloorNames(device: DeviceGroup): string[] {
    const primary = device.entities.find(
      (e) => e.entity_id === device.primaryEntityId,
    );
    if (!primary) return [];
    return otherFloorNames(
      primary.placed_floor_ids,
      primary.placed_floor_names,
      primary.placed_floor_id,
      primary.placed_floor_name,
      this.currentFloorId,
    );
  }

  /** Whether something in `areaId` passes the floor and area filters.
   * Something in no area at all only shows while no area is picked:
   * a helper often has none, and would otherwise never show. */
  private _passesWhere(areaId: string | null, allowNoArea: boolean): boolean {
    const floorId = this._effectiveFloorFilter;
    if (this._areaFilter) return areaId === this._areaFilter;
    if (!floorId) return true;
    if (areaId === null) return allowNoArea;
    const area = this.areas.find((a) => a.area_id === areaId);
    return !!area && this._areaIsOnFloor(area, floorId);
  }

  private _passesPlaced(key: string): boolean {
    if (this._placedFilter === "all") return true;
    return this.placedDeviceIds.has(key) === (this._placedFilter === "placed");
  }

  private get _query(): string {
    return this._search.trim().toLowerCase();
  }

  private _entityMatches(e: PlaceableEntity, q: string): boolean {
    return (
      e.name.toLowerCase().includes(q) || e.entity_id.toLowerCase().includes(q)
    );
  }

  private get _filtered(): DeviceGroup[] {
    const q = this._query;
    return this._devices.filter((d) => {
      if (!this._passesWhere(d.areaId, false)) return false;
      // A device also shows while one of its entities placed on its own
      // matches the placed filter, so that entity can be found.
      if (
        !this._passesPlaced(d.deviceId) &&
        !ownPinCandidates(d.entities).some((e) =>
          this._passesPlaced(entityKey(e.entity_id)),
        )
      ) {
        return false;
      }
      if (!q) return true;
      return (
        d.deviceName.toLowerCase().includes(q) ||
        (d.areaName ?? "").toLowerCase().includes(q) ||
        d.entities.some((e) => this._entityMatches(e, q))
      );
    });
  }

  /** Entities with no physical device (helpers, templates, groups,
   * YAML-only entities), each placed on a pin of its own. */
  private get _otherEntities(): PlaceableEntity[] {
    const q = this._query;
    return this.entities
      .filter((e) => !e.device_id)
      .filter(
        (e) =>
          this._passesWhere(e.area_id, true) &&
          this._passesPlaced(entityKey(e.entity_id)) &&
          (!q ||
            this._entityMatches(e, q) ||
            (e.area_name ?? "").toLowerCase().includes(q)),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** The other floors (names) this entity is on a pin of its own, besides
   * the one open. */
  private _entityOtherFloorNames(e: PlaceableEntity): string[] {
    return otherFloorNames(
      e.entity_placed_floor_ids,
      e.entity_placed_floor_names,
      e.entity_placed_floor_id ?? null,
      e.entity_placed_floor_name ?? null,
      this.currentFloorId,
    );
  }

  private _toggleExpanded(event: Event, deviceId: string): void {
    event.stopPropagation();
    const next = new Set(this._expanded);
    if (next.has(deviceId)) next.delete(deviceId);
    else next.add(deviceId);
    this._expanded = next;
  }

  /** Open when the admin opened it, or while a search matches one of its
   * entities by name rather than the device itself. */
  private _isExpanded(device: DeviceGroup): boolean {
    if (this._expanded.has(device.deviceId)) return true;
    const q = this._query;
    return (
      !!q &&
      !device.deviceName.toLowerCase().includes(q) &&
      device.entities.some((e) => this._entityMatches(e, q))
    );
  }

  /** Per linked room, its area's devices that are on no plan yet. A
   * selected room narrows this to that room. */
  private get _suggestions(): Suggestion[] {
    const focus = this.rooms.find((r) => r.id === this.focusRoomId);
    const rooms = focus ? [focus] : this.rooms;
    const devices = this._devices.filter(
      (d) =>
        d.areaId !== null &&
        !this.placedDeviceIds.has(d.deviceId) &&
        this._otherFloorNames(d).length === 0,
    );
    const seen = new Set<string>();
    const suggestions: Suggestion[] = [];
    for (const room of rooms) {
      // Two rooms linked to one area suggest its devices once.
      if (!room.area_id || room.points.length < 3 || seen.has(room.area_id)) {
        continue;
      }
      seen.add(room.area_id);
      const inArea = devices.filter((d) => d.areaId === room.area_id);
      if (inArea.length > 0) suggestions.push({ room, devices: inArea });
    }
    return suggestions;
  }

  private _placeInRoom(event: Event, roomId: string, deviceIds: string[]) {
    event.stopPropagation();
    this.dispatchEvent(
      new CustomEvent("suggestion-place", {
        detail: { roomId, deviceIds },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _renderSuggestions() {
    if (this._search.trim() || this._placedFilter === "placed") return nothing;
    const suggestions = this._suggestions;
    if (suggestions.length === 0) return nothing;
    return html`<div class="suggestions">
      ${suggestions.map(
        ({ room, devices }) => html`
          <div class="suggest-head">
            <span class="suggest-title"
              >${localize("picker.suggestedFor", {
                room: room.name,
                count: devices.length,
              })}</span
            >
            ${
              devices.length > 1
                ? html`<button
                    class="suggest-all"
                    title=${localize("picker.placeAllHint", {
                      room: room.name,
                    })}
                    @click=${(e: Event) =>
                      this._placeInRoom(
                        e,
                        room.id,
                        devices.map((d) => d.deviceId),
                      )}
                  >
                    ${localize("picker.placeAll")}
                  </button>`
                : nothing
            }
          </div>
          ${devices.map((device) =>
            this._renderRow(
              device,
              html`<span class="row-actions">
                <button
                  title=${localize("picker.placeInRoom", { room: room.name })}
                  aria-label=${localize("picker.placeInRoom", {
                    room: room.name,
                  })}
                  @click=${(e: Event) =>
                    this._placeInRoom(e, room.id, [device.deviceId])}
                >
                  <ha-icon icon="mdi:map-marker-plus-outline"></ha-icon>
                </button>
              </span>`,
            ),
          )}
        `,
      )}
      <div class="suggest-divider">${localize("picker.allDevices")}</div>
    </div>`;
  }

  /** A row button: act on that device's pin without arming the row. */
  private _arm(key: string): void {
    this.dispatchEvent(
      new CustomEvent("entity-armed", {
        detail: { entityId: key },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _emitForDevice(event: Event, name: string, deviceId: string): void {
    event.stopPropagation();
    this.dispatchEvent(
      new CustomEvent(name, {
        detail: { deviceId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  override render() {
    const filtered = this._filtered;
    const others = this._otherEntities;
    return html`
      <div
        class="resize-handle"
        @pointerdown=${this._onResizeHandlePointerDown}
      ></div>
      <div class="picker-head">
        <span class="picker-title">${localize("picker.title")}</span>
        <button
          class="picker-close"
          title=${localize("canvas.button.close")}
          aria-label=${localize("canvas.button.close")}
          @click=${() =>
            this.dispatchEvent(
              new CustomEvent("picker-close", {
                bubbles: true,
                composed: true,
              }),
            )}
        >
          <ha-icon icon="mdi:close"></ha-icon>
        </button>
      </div>
      <div class="search">
        <div class="search-box">
          <ha-icon icon="mdi:magnify"></ha-icon>
          <input
            type="search"
            placeholder=${localize("picker.search")}
            .value=${this._search}
            @input=${(e: Event) => (this._search = (e.target as HTMLInputElement).value)}
          />
          ${
            this._search
              ? html`<button
                  class="clear"
                  title=${localize("picker.clearSearch")}
                  aria-label=${localize("picker.clearSearch")}
                  @click=${() => (this._search = "")}
                >
                  <ha-icon icon="mdi:close"></ha-icon>
                </button>`
              : nothing
          }
        </div>
        <div class="filters">
          <span class="select-wrap"
            ><select @change=${this._onFloorFilterChange}>
              <option value="all" ?selected=${this._floorFilter === "all"}>
                ${localize("picker.allFloors")}
              </option>
              <option
                value=${PROPERTY_LOCATION_ID}
                ?selected=${this._effectiveFloorFilter === PROPERTY_LOCATION_ID}
              >
                ${localize("picker.outdoor")}
              </option>
              ${this.floors.map(
                (f) =>
                  html`<option
                    value=${f.floor_id}
                    ?selected=${this._effectiveFloorFilter === f.floor_id}
                  >
                    ${f.name}
                  </option>`,
              )}</select
            ><ha-icon class="chev" icon="mdi:menu-down"></ha-icon
          ></span>
          <span class="select-wrap"
            ><select
              @change=${(e: Event) =>
                (this._areaFilter =
                  (e.target as HTMLSelectElement).value || null)}
            >
              <option value="" ?selected=${!this._areaFilter}>
                ${localize("picker.allAreas")}
              </option>
              ${this._areasForFilter.map(
                (a) =>
                  html`<option
                    value=${a.area_id}
                    ?selected=${this._areaFilter === a.area_id}
                  >
                    ${a.name}
                  </option>`,
              )}</select
            ><ha-icon class="chev" icon="mdi:menu-down"></ha-icon
          ></span>
          ${
            this.placedDeviceIds.size > 0
              ? html`<button
                  class="more-button"
                  title=${localize("picker.more")}
                  aria-label=${localize("picker.more")}
                  @click=${() => (this._menuOpen = !this._menuOpen)}
                >
                  <ha-icon icon="mdi:dots-vertical"></ha-icon>
                </button>`
              : nothing
          }
        </div>
        <div class="filters">
          <span class="select-wrap"
            ><select
              aria-label=${localize("picker.showAll")}
              @change=${(e: Event) =>
                (this._placedFilter = (e.target as HTMLSelectElement)
                  .value as typeof this._placedFilter)}
            >
              <option value="all" ?selected=${this._placedFilter === "all"}>
                ${localize("picker.showAll")}
              </option>
              <option
                value="unplaced"
                ?selected=${this._placedFilter === "unplaced"}
              >
                ${localize("picker.showUnplaced")}
              </option>
              <option
                value="placed"
                ?selected=${this._placedFilter === "placed"}
              >
                ${localize("picker.showPlaced")}
              </option></select
            ><ha-icon class="chev" icon="mdi:menu-down"></ha-icon
          ></span>
        </div>
        ${
          this._menuOpen && this.placedDeviceIds.size > 0
            ? html`<div class="more-menu floating-panel">
                <button
                  class="menu-item danger"
                  @click=${() => {
                    this._menuOpen = false;
                    this.dispatchEvent(
                      new CustomEvent("clear-all-pins", {
                        bubbles: true,
                        composed: true,
                      }),
                    );
                  }}
                >
                  <ha-icon icon="mdi:playlist-remove"></ha-icon>
                  ${localize("picker.clearAll")}
                </button>
              </div>`
            : nothing
        }
      </div>
      <div class="list">
        ${this._renderSuggestions()}
        ${
          filtered.length === 0 && others.length === 0
            ? html`<div class="empty">${localize("picker.noMatches")}</div>`
            : filtered.map((device) => this._renderDevice(device))
        }
        ${
          others.length > 0
            ? html`<button
                  class="suggest-divider other-head"
                  aria-expanded=${this._otherCollapsed ? "false" : "true"}
                  @click=${() => (this._otherCollapsed = !this._otherCollapsed)}
                >
                  <span
                    >${localize("picker.otherEntities", {
                      count: others.length,
                    })}</span
                  >
                  <ha-icon
                    icon=${
                      this._otherCollapsed
                        ? "mdi:chevron-down"
                        : "mdi:chevron-up"
                    }
                  ></ha-icon>
                </button>
                ${
                  this._otherCollapsed
                    ? nothing
                    : others.map((e) => this._renderEntityRow(e, false))
                }`
            : nothing
        }
      </div>
    `;
  }

  /** A device row and, when opened, its entities below it. */
  private _renderDevice(device: DeviceGroup) {
    const candidates = ownPinCandidates(device.entities);
    // A device with one entity is that entity: nothing to split.
    const splittable = candidates.length > 1;
    const expanded = splittable && this._isExpanded(device);
    const q = this._query;
    const shown =
      q && !device.deviceName.toLowerCase().includes(q)
        ? candidates.filter((e) => this._entityMatches(e, q))
        : candidates;
    return html`${this._renderRow(
      device,
      undefined,
      splittable
        ? html`<button
            class="expand"
            title=${localize(
              expanded ? "picker.hideEntities" : "picker.showEntities",
            )}
            aria-label=${localize(
              expanded ? "picker.hideEntities" : "picker.showEntities",
            )}
            aria-expanded=${expanded ? "true" : "false"}
            @click=${(e: Event) => this._toggleExpanded(e, device.deviceId)}
          >
            <ha-icon
              icon=${expanded ? "mdi:chevron-up" : "mdi:chevron-down"}
            ></ha-icon>
          </button>`
        : nothing,
    )}
    ${expanded ? shown.map((e) => this._renderEntityRow(e, true)) : nothing}`;
  }

  /** One entity on a pin of its own: a device's channel (`sub`, indented
   * under its device) or an entity with no device. */
  private _renderEntityRow(e: PlaceableEntity, sub: boolean) {
    const key = entityKey(e.entity_id);
    const placed = this.placedDeviceIds.has(key);
    const otherFloors = this._entityOtherFloorNames(e);
    const armed = this.armedEntityId === key;
    const name = sub ? shortName(e) : e.name;
    const subtitle = sub
      ? e.entity_id
      : [e.area_name, e.integration_name ?? e.entity_id]
          .filter((part): part is string => !!part)
          .join(" - ");
    return html`
      <div
        class="item entity ${sub ? "sub" : ""} ${armed ? "armed" : ""} ${
          placed ? "placed" : ""
        }"
        title=${`${e.name} · ${e.entity_id}`}
        @click=${() => this._arm(key)}
      >
        <span class="avatar"
          ><ha-icon icon=${entityIconName(e)}></ha-icon
        ></span>
        <span class="text">
          <span class="name">${name}</span>
          <span class="meta">${subtitle}</span>
          ${this._alsoOn(otherFloors)}
          ${placed ? html`<span class="meta">${localize("picker.placed")}</span>` : nothing}
        </span>
        ${placed ? this._placedActions(key) : nothing}
      </div>
    `;
  }

  /** "Also on Ground floor, First floor" under a row placed elsewhere. */
  private _alsoOn(floors: string[]) {
    return floors.length
      ? html`<span class="meta also-on"
          >${localize("picker.alsoOn", { floor: floors.join(", ") })}</span
        >`
      : nothing;
  }

  /** Locate and remove buttons for a placed row. */
  private _placedActions(key: string) {
    return html`<span class="row-actions">
      <button
        title=${localize("picker.locate")}
        aria-label=${localize("picker.locate")}
        @click=${(e: Event) => this._emitForDevice(e, "pin-locate", key)}
      >
        <ha-icon icon="mdi:crosshairs-gps"></ha-icon>
      </button>
      <button
        title=${localize("picker.remove")}
        aria-label=${localize("picker.remove")}
        @click=${(e: Event) => this._emitForDevice(e, "pin-remove", key)}
      >
        <ha-icon icon="mdi:delete-outline"></ha-icon>
      </button>
    </span>`;
  }

  /** One device row. `actions` are its buttons when it isn't placed;
   * `expand` opens its entities. */
  private _renderRow(device: DeviceGroup, actions?: unknown, expand?: unknown) {
    const placed = this.placedDeviceIds.has(device.deviceId);
    const otherFloors = this._otherFloorNames(device);
    const armed = this.armedEntityId === device.deviceId;
    const subtitle = [device.areaName, device.integrationName]
      .filter((part): part is string => !!part)
      .join(" - ");
    return html`
      <div
        class="item ${armed ? "armed" : ""} ${placed ? "placed" : ""}"
        title=${[device.deviceName, subtitle]
          .filter((part): part is string => !!part)
          .join(" · ")}
        @click=${() => this._arm(device.deviceId)}
      >
        <span class="avatar">
          ${
            device.integrationDomain
              ? html`<img
                  src="https://brands.home-assistant.io/_/${device.integrationDomain}/icon.png"
                  alt=""
                  @error=${(e: Event) => {
                    const img = e.target as HTMLImageElement;
                    img.style.display = "none";
                    img.nextElementSibling?.classList.remove("hidden");
                  }}
                />`
              : nothing
          }
          <ha-icon
            icon=${GENERIC_DEVICE_ICON_NAME}
            class=${device.integrationDomain ? "hidden" : ""}
          ></ha-icon>
        </span>
        <span class="text">
          <span class="name">${device.deviceName}</span>
          ${subtitle ? html`<span class="meta">${subtitle}</span>` : nothing}
          ${this._alsoOn(otherFloors)}
          ${placed ? html`<span class="meta">${localize("picker.placed")}</span>` : nothing}
        </span>
        ${placed ? this._placedActions(device.deviceId) : (actions ?? nothing)}
        ${expand ?? nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "entity-picker-sidebar": EntityPickerSidebar;
  }
}
