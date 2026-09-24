# Earth Orbit Animation

A browser animation of Earth orbiting the Sun with **real astronomical coordinates** (VSOP87 / IAU models via [Astronomy Engine](https://github.com/cosinekitty/astronomy)).

## Quick start

**No install required.** Everything runs in the browser.

1. Download or clone this repo
2. Open **`orbit.html`** (or `index.html`) in your browser

For best results, serve locally:

```bash
python3 -m http.server 8080
```

Then visit: http://localhost:8080/orbit.html

## How to tell the new version is running

You should see:

- A **blue banner** at the top: "Real coordinates mode"
- A **3D Earth globe** by default (textured, with real axial tilt and day/night lighting)
- A **coordinate panel** (bottom-left) with ecliptic longitude, distance from Sun, axial tilt, etc.
- **Earth model** toggle and **Time speed** slider (bottom-right)
- Page title: **Earth Orbit — Real Coordinates**

If you still see the old CSS-only animation (no panels, title is "Document"), your browser is showing a **cached copy**. Hard-refresh:

- **Windows/Linux:** `Ctrl + Shift + R`
- **Mac:** `Cmd + Shift + R`

Or open in a private/incognito window.

## Files

| File | Purpose |
|------|---------|
| `orbit.html` | Main page |
| `script.js` | Real-time position calculations |
| `globe.js` | 3D Earth globe renderer (Three.js) |
| `lib/astronomy.browser.min.js` | Astronomy Engine (bundled locally, no CDN needed) |
| `lib/three.min.js` | Three.js for the 3D globe |
| `images/earth_globe.jpg` | NASA Blue Marble texture for the globe |
| `style.css` | Layout and styling |
