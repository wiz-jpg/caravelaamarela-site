export function renderSiteLayout() {
  const headerMount = document.querySelector("[data-site-header]");
  const footerMount = document.querySelector("[data-site-footer]");

  if (headerMount) {
    headerMount.outerHTML = `
      <header class="site-header" data-header>
        <a class="brand" href="index.html" aria-label="A Caravela Amarela — homepage">
          <img src="assets/caravela-symbol.png" alt="A Caravela Amarela" />
        </a>

        <button class="nav-toggle" type="button" aria-label="Abrir menu" data-nav-toggle>
          <span></span>
          <span></span>
        </button>

        <nav class="site-nav" data-nav>
          <a href="index.html#stages">
            <span class="pt">Sobre</span>
            <span class="en">About</span>
          </a>

          <a href="index.html#roster">Roster</a>

          <a class="nav-pill nav-pill-artists" href="for-artists.html">
            <span class="pt">Para Artistas</span>
            <span class="en">For Artists</span>
          </a>

          <a class="nav-pill nav-pill-contact" href="index.html#contact">
            <span class="pt">Contactos</span>
            <span class="en">Contact</span>
          </a>

          <button class="lang-toggle" type="button" data-lang-toggle aria-label="Switch language">
            <span class="flag" data-lang-flag>🇬🇧</span>
            <span data-lang-label>EN</span>
          </button>
        </nav>
      </header>
    `;
  }

  if (footerMount) {
    footerMount.outerHTML = `
      <footer class="site-footer">
        <img src="assets/caravela-symbol.png" alt="A Caravela Amarela" />
        <span>© <span data-year></span> A Caravela Amarela</span>
      </footer>
    `;
  }
}