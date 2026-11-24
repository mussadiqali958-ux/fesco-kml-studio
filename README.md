# FESCO KML Studio

Standalone, browser-based GIS utilities for FESCO field and survey workflows.

## Included in this first release
- Import CSV/TXT survey files locally in the browser.
- Detect common longitude/latitude, Easting/Northing, asset ID and equipment type columns.
- Preview valid WGS84 points on an OpenStreetMap map.
- Export transformer placemarks as KML or KMZ.
- Compare WebGIS and MIS CSV exports by a shared asset key.
- Export unmatched records as CSV.
- Responsive layout with dark and light themes.

## Run locally
```bash
npm install
npm run dev
```

## Production build
```bash
npm run build
npm run preview
```

## Coordinate reference warning
KML uses WGS84 longitude/latitude. The current converter validates coordinate ranges but does not perform coordinate reference system transformations. If your source uses projected Easting/Northing (such as UTM), transform it to WGS84 before export. A future release will add configurable CRS transformation.

## Privacy
CSV parsing, reconciliation and KML generation run in the browser. This application does not upload source survey files to an application server. Map tiles are fetched from OpenStreetMap when the map is displayed.

## Planned modules
- FESCO A1/A2 data profiles and schema validation.
- Transformer-specific business rules and MIS 101/1301 reconciliation.
- Feeder node sequencing and topology builder.
- A0 layout designer with PDF/PNG export.
- Topology quality checks, load-flow analysis and BOQ tools.
- XLSX import and configurable coordinate transformations.

## Deployment
A GitHub Actions workflow builds the Vite app and deploys it to GitHub Pages. Enable Pages in repository Settings → Pages and select **GitHub Actions** as the build and deployment source.
