# Floorplan Plus brand pack

Mark: a house with a traced floor plan cut out of it (three rooms, walls with door openings) and a round plus badge in
the bottom-right corner. The house is cut out of a solid shape, so it works on any background.

Colours

| | Light backgrounds | Dark backgrounds |
|---|---|---|
| House | `#039be5` | `#03a9f4` |
| Plus badge | `#ffb300` with a white plus | `#ffca28` with a `#263238` plus |
| Wordmark | `#37474f` | `#eceff1` |

Files

```
custom_components/floorplan_plus/brand/   what Home Assistant and HACS show
  icon.png 256x256, icon@2x.png 512x512, logo.png 1348x256, logo@2x.png 2696x512
  dark_icon / dark_logo and their @2x versions (for dark backgrounds)
source/   SVG masters: floorplan-plus-icon(-dark).svg, floorplan-plus-logo(-dark).svg
          (wordmark converted to outlines from Roboto Medium, Apache-2.0)
extras/   favicon.ico and favicon PNGs (32, 48, 180, 192, 512), logo on a white background
spatial-context/   the original Spatial Context brand pack by Greminn, kept for credit
```

The PNGs are rendered from the SVG masters at the sizes above, with a transparent background.

Sidebar icon (panel registration): `mdi:floor-plan`.
