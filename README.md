# Caravela Amarela — Production v3

Static Cloudflare Pages site. No build step required.

## Deploy
- Framework preset: None
- Build command: blank
- Build output directory: `/`

## UX architecture
- Homepage: proposition → roster → booking workflow → contact.
- Artist dossiers: hero + instant proof → fit cards → strongest media proof → track record tabs → selected press → booking.
- WILDCHAINS leads with official music videos and visual storytelling rather than presenting the current video as a live reel.
- Devil of a Woman leads with its live session, its strongest immediate proof.
- Long proof and press content is progressively disclosed to keep mobile pages compact.

## Performance
- Responsive WebP image sources.
- Hero images eager-loaded; lower images lazy-loaded.
- YouTube players are click-to-load facades.
- Fixed intrinsic image dimensions are retained where possible.

## SEO
- PT + EN crawlable pages.
- Canonicals, hreflang, sitemap, robots and JSON-LD preserved.
- Open Graph / social cards preserved.
- Clean URLs via `_redirects`.

## Forms
Forms prepare a structured email via `mailto:`:
- booking@caravelaamarela.com
- artists@caravelaamarela.com

A direct form backend can be added after domain/email launch without changing the visual system.
