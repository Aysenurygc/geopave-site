# Geopave — website preview

A design preview for the Geopave Mühendislik website redesign: a static,
multi-page site with no build step, served by GitHub Pages.

**Not the live company site.** The live site is https://www.geopaveco.com

## Structure

One folder per page, so every page has a clean URL (`hizmetler/` serves
`hizmetler/index.html`).

| Path | Page | Template |
| --- | --- | --- |
| `index.html` | Home: routes each visitor type, hero with Fig 1 | T1 |
| `kurumsal/` | Company hub | T7 |
| `hizmetler/` | Service hub: scope table, method chain, nine services | T2 |
| `urunler/` | Product catalogue entrance: five groups, model index | T4 (hub) |
| `referanslar/` | References: record format and three pending records | T6 |
| `temsilcilik/` | Representation: product lines and manufacturer partnership | T10 |
| `iletisim/` | Contact and the request form | T8 |
| `en/` | The one English page, for manufacturers seeking a Turkish representative | — |
| `404.html` | Not-found page; points old geopaveco.com URLs to their new home | — |
| `sitemap.xml` | Every page, both build stages | — |

Detail pages (stage 2) sit one level further down: nine services under
`hizmetler/`, five product groups under `urunler/`, two product pages under
their group, five company pages under `kurumsal/`. They are already linked from
the navigation, the hubs and `sitemap.xml`.

### Shared assets

| File | Loaded on | Purpose |
| --- | --- | --- |
| `assets/site.css` | every page | Tokens (light and dark), base reset, every component |
| `assets/site.js` | every page | Menu and dropdowns, copy buttons, toast, year stamp, theme-change hook, table filter, request form |
| `assets/figures.js` | pages with a figure only | The three WebGL figures; each starts only if its stage element is on the page |

`figures.js` needs three.js, loaded just before it from cdnjs. The figure markup
contract (element IDs, the SVG pattern block) is documented at the top of the file.

External resources: three.js r128 from cdnjs and IBM Plex from Google Fonts.
Nothing else.

## Rules for adding a page

- **Relative paths only.** The site is served from a subpath today
  (`/geopave-site/`) and may move to a domain root. From a page one level down
  write `../assets/site.css`; two levels down, `../../assets/site.css`. Never a
  leading `/`.
- **Header and footer are identical on every page** apart from the path depth
  and the `aria-current` marker on the active section. Copy them from an
  existing page and change only the prefix.
- Every page has its own `<title>`, a non-empty `<meta name="description">`,
  exactly one `<h1>`, breadcrumbs (below the home page), `BreadcrumbList`
  JSON-LD, and ends with an action band.
- Keep `<meta name="robots" content="noindex, nofollow">` on every page.

The 404 page is the exception to relative linking: GitHub Pages serves it at
whatever depth was requested, so it sets a `<base>` to the site root first.

## Running it locally

Serve the folder; opening files directly works for most pages, but the 404
behaviour needs a server.

```bash
python -m http.server 8000
# then open http://localhost:8000
```

## Interactive figures

Drawn in code rather than photographed:

1. An exploded flexible pavement section, rotatable, with selectable layers (home page)
2. A lane surface rendered as 3D displacement from a generated profile, with
   roughness values computed from that profile (stage 2)
3. A micro surfacing application sequence (stage 2)

Each falls back to a drawn static diagram carrying the same information when
WebGL is unavailable. With reduced motion requested, nothing animates on its own.

## Status

Preview. Areas marked **BEKLENİYOR** are awaiting real content and state what
is required. Nothing in them is placeholder prose standing in for facts; they
are deliberately empty.

The request form is not connected to a server. It validates input and then says
plainly that nothing was sent. Links into it carry the request type and product
(`iletisim/?tur=urun&urun=IMPACT%207000#talep`) and the form fills them in.

## Search visibility

`robots.txt` and a `noindex` meta tag on every page keep this preview out of
search results, so it cannot compete with the live site for the same terms.
Remove both only if this becomes the production site. JSON-LD URLs point at
www.geopaveco.com deliberately; `sitemap.xml` uses this preview's host and must
be rewritten if the site moves.
