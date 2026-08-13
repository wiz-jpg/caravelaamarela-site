# Caravela Amarela — Production Website

Production-ready static website for **Caravela Amarela**. The project is intentionally dependency-free: plain HTML, CSS and JavaScript served directly by Cloudflare Pages.

## Architecture

- Portuguese: `/`, `/wildchains`, `/devil-of-a-woman`, `/for-artists`
- English: `/en/`, `/en/wildchains`, `/en/devil-of-a-woman`, `/en/for-artists`
- Shared production CSS: `/styles.css`
- Shared production JS: `/script.js`
- Responsive optimized media: `/assets/media/`
- Custom security headers: `/_headers`
- Legacy URL redirects: `/_redirects`
- SEO: canonical URLs, hreflang, Open Graph/Twitter metadata, JSON-LD, `robots.txt`, `sitemap.xml`
- PWA/browser identity: manifest, favicon, Apple touch icon

## Cloudflare Pages settings

Keep the repository connected to the `main` branch with:

- **Framework preset:** `None`
- **Build command:** leave empty
- **Build output directory:** `/`

There is no npm/Vite build and no `node_modules` folder. Every push to `main` deploys automatically.

## Production domain

Metadata is prepared for:

`https://caravelaamarela.com`

Before the public launch, configure these aliases on the domain:

- `booking@caravelaamarela.com`
- `artists@caravelaamarela.com`

The current forms create structured email requests and open the visitor's email app.

## Launch checklist after connecting the domain

1. Confirm HTTPS and `www`/apex preference.
2. Redirect the `pages.dev` hostname permanently to `caravelaamarela.com`.
3. Configure `booking@` and `artists@` email aliases before promoting the forms.
4. Add the domain property to Google Search Console and submit `/sitemap.xml`.
5. Validate social previews and structured data on the live domain.
6. Add analytics only after deciding the privacy/cookie approach.
7. Add verified social profiles to Organization structured data when the official handles are final.
8. Review legal/privacy information before collecting data through a future direct-submit form.

## Editing workflow

1. Edit the files in the local GitHub repository.
2. Open GitHub Desktop.
3. Review the changed files.
4. Commit to `main`.
5. Push origin.
6. Cloudflare Pages publishes the update automatically.

Large original photos should not be committed back into this repository. Export web-ready responsive images instead.
