# Local catalog images

One image per component type for local development.

## Files

Each folder contains `default.png`:

- `panels/` — solar panel
- `inverters/` — inverter / power hub
- `batteries/` — battery storage
- `protections/` — protection / BOS
- `mounting/` — roof mounting / structure
- `cabling/` — electrical wiring
- `misc/` — installation / labour

See [ATTRIBUTION.md](./ATTRIBUTION.md) for placeholder image sources and licenses.

## Enable

`frontend/.env.development` sets `VITE_CATALOG_IMAGES=local`.

Restart `npm run dev` after replacing images.

## Replace an image

Overwrite `default.png` in the matching folder with your own photo (keep the filename).

## Regenerate SVG placeholders (optional fallback)

```bash
npm run catalog:placeholders
```

This writes labeled SVGs; the app uses `default.jpg` when present.
