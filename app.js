const data = window.RENTHUB_DATA || { categories: [], islands: [], listings: [] };
const root = document.documentElement;
const page = document.body.dataset.page || "home";

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });
}

function islandLabel(island) {
  return `${island.name} (${island.atoll})`;
}

function normalise(value) {
  return String(value || "").trim().toLowerCase();
}

function setSelectValue(select, value) {
  if (!select || !value) return;
  const match = [...select.options].find((option) => normalise(option.value) === normalise(value));
  select.value = match ? match.value : "";
}

function setTheme(theme) {
  root.dataset.theme = theme;
  try {
    localStorage.setItem("renthub-theme", theme);
  } catch (error) {
    return theme;
  }
  return theme;
}

function setupTheme() {
  let savedTheme = "";
  try {
    savedTheme = localStorage.getItem("renthub-theme") || "";
  } catch (error) {
    savedTheme = "";
  }
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  setTheme(savedTheme || (prefersDark ? "dark" : "light"));

  document.querySelectorAll(".theme-toggle").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      setTheme(root.dataset.theme === "dark" ? "light" : "dark");
    });
  });
}

function setupActiveNav() {
  document.querySelectorAll(`[data-nav-page="${page}"]`).forEach((link) => {
    link.classList.add("is-active");
  });
}

function populateCategorySelects() {
  document.querySelectorAll("[data-category-select]").forEach((select) => {
    const current = select.value;
    const first = select.querySelector("option")?.outerHTML || '<option value="">All categories</option>';
    select.innerHTML =
      first +
      data.categories
        .map((category) => `<option value="${escapeHtml(category.value)}">${escapeHtml(category.label)}</option>`)
        .join("");
    select.value = current;
  });
}

function populateLocations() {
  const options = data.islands
    .map((island) => {
      const label = islandLabel(island);
      return `<option value="${escapeHtml(label)}">${escapeHtml(label)}</option>`;
    })
    .join("");

  document.querySelectorAll("[data-location-select]").forEach((select) => {
    const current = select.value;
    const first = select.querySelector("option")?.outerHTML || '<option value="">Any island</option>';
    select.innerHTML = first + options;
    select.value = current;
  });

  document.querySelectorAll("[data-island-datalist]").forEach((list) => {
    list.innerHTML = options;
  });
}

function populateCategoryGrids() {
  document.querySelectorAll("[data-category-grid]").forEach((grid) => {
    grid.innerHTML = data.categories
      .map(
        (category) => `
          <a class="category-card" href="browse.html?category=${encodeURIComponent(category.value)}" data-category-link="${escapeHtml(
            category.value
          )}">
            <span aria-hidden="true">${category.icon}</span>
            ${escapeHtml(category.label)}
          </a>
        `
      )
      .join("");
  });
}

function listingCard(listing) {
  const words = [listing.title, listing.category, listing.location, listing.description].join(" ");
  return `
    <article class="rental-card" data-search-text="${escapeHtml(words)}">
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
    </article>
  `;
}

function renderListings(listings) {
  document.querySelectorAll("[data-listings]").forEach((grid) => {
    const limit = Number(grid.dataset.limit || listings.length);
    grid.innerHTML = listings.slice(0, limit).map(listingCard).join("");
  });
  setupFavorites();
}

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
    const text = normalise([listing.title, listing.category, listing.location, listing.description].join(" "));
    const matchesQuery = !filters.query || text.includes(filters.query);
    const matchesCategory = !filters.category || normalise(listing.category) === filters.category;
    const matchesLocation = !filters.location || normalise(listing.location) === filters.location;
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
    setSelectValue(categorySelect, url.searchParams.get("category"));
    setSelectValue(locationSelect, url.searchParams.get("location"));

    const applyBrowseFilter = () => {
      const filters = currentFilters(form);
      const filtered = filterListings(filters);
      renderListings(filtered);

      const emptyState = document.querySelector("[data-empty-state]");
      if (emptyState) emptyState.hidden = filtered.length > 0;

      const count = document.querySelector("[data-result-count]");
      if (count) count.textContent = `${filtered.length} item${filtered.length === 1 ? "" : "s"} found`;

      document.querySelectorAll("[data-category-link]").forEach((link) => {
        link.classList.toggle("is-selected", normalise(link.dataset.categoryLink) === normalise(filters.category));
      });

      setBrowseUrl(filters);
    };

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const filters = currentFilters(form);
      if (page !== "browse") {
        const params = new URLSearchParams();
        if (filters.query) params.set("q", filters.query);
        if (filters.category) params.set("category", filters.category);
        if (filters.location) params.set("location", filters.location);
        location.href = `browse.html${params.toString() ? `?${params.toString()}` : ""}`;
        return;
      }
      applyBrowseFilter();
    });

    if (form.hasAttribute("data-filter-form")) {
      form.addEventListener("input", applyBrowseFilter);
      form.addEventListener("change", applyBrowseFilter);
      applyBrowseFilter();
    }
  });

  document.querySelector("[data-clear-filters]")?.addEventListener("click", () => {
    const form = document.querySelector("[data-filter-form]");
    if (!form) return;
    form.reset();
    form.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function setupFavorites() {
  document.querySelectorAll(".favorite-button").forEach((button) => {
    if (button.dataset.ready) return;
    button.dataset.ready = "true";
    button.addEventListener("click", () => {
      const active = button.classList.toggle("is-active");
      button.textContent = active ? "\u2665" : "\u2661";
    });
  });
}

function setupForms() {
  document.querySelectorAll("[data-list-form], [data-contact-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const message = form.querySelector("[data-form-success]");
      if (message) message.hidden = false;
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

setupTheme();
setupActiveNav();
populateCategorySelects();
populateLocations();
populateCategoryGrids();
renderListings(data.listings);
setupSearch();
setupForms();
