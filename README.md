# Geopave — website preview

A design preview for the Geopave Mühendislik website redesign. Single
self-contained page, no build step.

**Not the live company site.** The live site is https://www.geopaveco.com

## What is here

| File | Purpose |
| --- | --- |
| `index.html` | The whole page: markup, styles and scripts in one file |
| `robots.txt` | Keeps the preview out of search results |
| `.nojekyll` | Serves the files as-is, without Jekyll processing |

The page loads two things from a CDN: three.js from cdnjs, and the IBM Plex
type family from Google Fonts. Everything else is inline.

## Running it locally

No tooling required. Open `index.html` in a browser, or serve the folder:

```bash
python -m http.server 8000
# then open http://localhost:8000
```

## What it contains

Three interactive WebGL figures, drawn in code rather than photographed:

1. An exploded flexible pavement section, rotatable, with selectable layers
2. A lane surface rendered as 3D displacement from a generated profile, with
   roughness values computed from that profile
3. A micro surfacing application sequence

Each figure falls back to a drawn static diagram carrying the same information
when WebGL is unavailable or when the visitor prefers reduced motion. The page
is readable before any WebGL initialises.

Interface language is Turkish, with a partial English toggle.

## Status

Preview. Sections marked **BEKLENİYOR** are awaiting real content and state what
is required. Nothing in those sections is placeholder prose standing in for
facts — they are deliberately empty.

The enquiry form is not connected to a server. It validates input and then says
plainly that nothing was sent.

## Search visibility

`robots.txt` and a `noindex` meta tag keep this preview out of search results so
it cannot compete with the live site for the same terms. Remove both only if
this becomes the production site.
