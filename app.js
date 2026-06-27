const data = window.RENTHUB_DATA || { categories: [], islands: [], listings: [] };
const root = document.documentElement;
const page = document.body.dataset.page || "browse";

/* ── utilities ── */
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function normalise(value) {
  return String(value || "").trim().toLowerCase();
}

function setSelectValue(select, value) {
  if (!select || !value) return;
  const match = [...select.options].find(
    (o) => normalise(o.value) === normalise(value)
  );
  select.value = match ? match.value : "";
}

/* ── theme ── */
function setTheme(theme) {
  root.dataset.theme = theme;
  try { localStorage.setItem("renthub-theme", theme); } catch (_) {}
  return theme;
}

function setupTheme() {
  let saved = "";
  try { saved = localStorage.getItem("renthub-theme") || ""; } catch (_) {}
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  setTheme(saved || (prefersDark ? "dark" : "light"));
  document.querySelectorAll(".theme-toggle").forEach((btn) => {
    btn.addEventListener("click", () =>
      setTheme(root.dataset.theme === "dark" ? "light" : "dark")
    );
  });
}

/* ── active nav ── */
function setupActiveNav() {
  document.querySelectorAll(`[data-nav-page="${page}"]`).forEach((link) => {
    link.classList.add("is-active");
  });
}

/* ── location label: "Name (Atoll)" ── */
function islandLabel(island) {
  return `${island.name} (${island.atoll})`;
}

/* ── populate dropdowns ── */
function populateCategorySelects() {
  document.querySelectorAll("[data-category-select]").forEach((select) => {
    const current = select.value;
    const first = select.querySelector("option")?.outerHTML || '<option value="">All categories</option>';
    select.innerHTML =
      first +
      data.categories
        .map((c) => `<option value="${escapeHtml(c.value)}">${escapeHtml(c.label)}</option>`)
        .join("");
    select.value = current;
  });
}

function populateLocations() {
  // Build grouped <optgroup> options
  const grouped = {};
  data.islands.forEach((island) => {
    if (!grouped[island.atoll]) grouped[island.atoll] = [];
    grouped[island.atoll].push(island);
  });

  // For the select: grouped by atoll
  const groupedOptions = Object.entries(grouped)
    .map(([atoll, islands]) =>
      `<optgroup label="Atoll ${atoll}">${islands
        .map((i) => {
          const label = islandLabel(i);
          return `<option value="${escapeHtml(label)}">${escapeHtml(label)}</option>`;
        })
        .join("")}</optgroup>`
    )
    .join("");

  // For datalist: flat
  const flatOptions = data.islands
    .map((i) => {
      const label = islandLabel(i);
      return `<option value="${escapeHtml(label)}"></option>`;
    })
    .join("");

  document.querySelectorAll("[data-location-select]").forEach((select) => {
    const current = select.value;
    const first = '<option value="">Any island</option>';
    select.innerHTML = first + groupedOptions;
    select.value = current;
  });

  document.querySelectorAll("[data-island-datalist]").forEach((list) => {
    list.innerHTML = flatOptions;
  });
}

function populateCategoryGrids() {
  document.querySelectorAll("[data-category-grid]").forEach((grid) => {
    grid.innerHTML = data.categories
      .map(
        (c) => `
        <a class="category-card" href="index.html?category=${encodeURIComponent(c.value)}" data-category-link="${escapeHtml(c.value)}">
          <span aria-hidden="true">${c.icon}</span>
          ${escapeHtml(c.label)}
        </a>`
      )
      .join("");
  });
}

/* ── listing card ── */
function listingCard(listing) {
  const words = [listing.title, listing.category, listing.location, listing.description].join(" ");
  return `
    <article class="rental-card reveal-item" data-search-text="${escapeHtml(words)}">
      <button class="favorite-button" type="button" aria-label="Save ${escapeHtml(listing.title)}">&#9825;</button>
      <img src="${escapeHtml(listing.image)}" alt="${escapeHtml(listing.title)}" loading="lazy" />
      <div class="rental-content">
        <div class="rental-meta">
          <span class="badge">${escapeHtml(listing.category)}</span>
          <strong>${escapeHtml(listing.price)}</strong>
        </div>
        <h3>${escapeHtml(listing.title)}</h3>
        <p>${escapeHtml(listing.location)}</p>
        <span class="verified">&#10003; Verified owner</span>
        <p class="listing-description">${escapeHtml(listing.description)}</p>
        <div class="card-actions">
          <a class="whatsapp-button" href="https://wa.me/${escapeHtml(listing.phone)}">WhatsApp</a>
          <a class="details-button" href="contact.html">View Details</a>
        </div>
      </div>
    </article>`;
}

function renderListings(listings) {
  document.querySelectorAll("[data-listings]").forEach((grid) => {
    const limit = Number(grid.dataset.limit || listings.length);
    grid.innerHTML = listings.slice(0, limit).map(listingCard).join("");
  });
  setupFavorites();
  setupRevealObserver();
}

/* ── filtering ── */
function currentFilters(form) {
  const values = new FormData(form);
  return {
    query: String(values.get("query") || "").trim(),
    category: String(values.get("category") || "").trim(),
    location: String(values.get("location") || "").trim()
  };
}

function filterListings(filters) {
  return data.listings.filter((listing) => {
    const text = normalise(
      [listing.title, listing.category, listing.location, listing.description].join(" ")
    );
    const matchesQuery = !filters.query || text.includes(normalise(filters.query));
    const matchesCategory =
      !filters.category || normalise(listing.category) === normalise(filters.category);
    // Location filter: match by island name prefix (ignore atoll code in brackets)
    const matchesLocation =
      !filters.location ||
      normalise(listing.location) === normalise(filters.location) ||
      normalise(listing.location).startsWith(
        normalise(filters.location.replace(/\s*\(.*\)$/, ""))
      );
    return matchesQuery && matchesCategory && matchesLocation;
  });
}

function setBrowseUrl(filters) {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.category) params.set("category", filters.category);
  if (filters.location) params.set("location", filters.location);
  const query = params.toString();
  history.replaceState(null, "", query ? `?${query}` : location.pathname);
}

function setupSearch() {
  const forms = document.querySelectorAll("[data-search-form]");

  forms.forEach((form) => {
    const url = new URL(location.href);
    const queryInput = form.elements.query;
    const categorySelect = form.elements.category;
    const locationSelect = form.elements.location;

    if (queryInput && url.searchParams.get("q")) queryInput.value = url.searchParams.get("q");
    if (categorySelect) setSelectValue(categorySelect, url.searchParams.get("category"));
    if (locationSelect) setSelectValue(locationSelect, url.searchParams.get("location"));

    const applyFilter = () => {
      const filters = currentFilters(form);
      const filtered = filterListings(filters);
      renderListings(filtered);

      const emptyState = document.querySelector("[data-empty-state]");
      if (emptyState) emptyState.hidden = filtered.length > 0;

      const count = document.querySelector("[data-result-count]");
      if (count) count.textContent = `${filtered.length} item${filtered.length === 1 ? "" : "s"} found`;

      document.querySelectorAll("[data-category-link]").forEach((link) => {
        link.classList.toggle(
          "is-selected",
          normalise(link.dataset.categoryLink) === normalise(filters.category)
        );
      });

      setBrowseUrl(filters);
    };

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      applyFilter();
    });

    if (form.hasAttribute("data-filter-form")) {
      form.addEventListener("input", applyFilter);
      form.addEventListener("change", applyFilter);
      applyFilter();
    }
  });

  document.querySelector("[data-clear-filters]")?.addEventListener("click", () => {
    const form = document.querySelector("[data-filter-form]");
    if (!form) return;
    form.reset();
    form.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

/* ── favorites ── */
function setupFavorites() {
  document.querySelectorAll(".favorite-button").forEach((btn) => {
    if (btn.dataset.ready) return;
    btn.dataset.ready = "true";
    btn.addEventListener("click", () => {
      const active = btn.classList.toggle("is-active");
      btn.textContent = active ? "\u2665" : "\u2661";
    });
  });
}

/* ── forms ── */
function setupForms() {
  document.querySelectorAll("[data-list-form], [data-contact-form]").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const msg = form.querySelector("[data-form-success]");
      if (msg) msg.hidden = false;
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

/* ── scroll reveal animation ── */
function setupRevealObserver() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08 }
  );
  document.querySelectorAll(".reveal-item:not(.revealed)").forEach((el) => observer.observe(el));
}

/* ── page transition ── */
function setupPageTransition() {
  // Fade in on load
  document.body.classList.add("page-entering");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.body.classList.remove("page-entering");
      document.body.classList.add("page-entered");
    });
  });

  // Fade out on navigate
  document.addEventListener("click", (e) => {
    const link = e.target.closest("a[href]");
    if (!link) return;
    const href = link.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("http") || href.startsWith("https") || href.startsWith("//") || href.startsWith("mailto") || href.startsWith("tel") || href.startsWith("wa.me")) return;
    if (link.hasAttribute("download") || link.target === "_blank") return;
    e.preventDefault();
    document.body.classList.add("page-leaving");
    setTimeout(() => { location.href = href; }, 280);
  });
}

/* ── init ── */
setupTheme();
setupActiveNav();
populateCategorySelects();
populateLocations();
populateCategoryGrids();
renderListings(data.listings);
setupSearch();
setupForms();
setupRevealObserver();
setupPageTransition();
