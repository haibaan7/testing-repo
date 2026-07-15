const data = window.RENTHUB_DATA || {
  categories: [],
  experienceCategories: [],
  listings: [],
  experiences: []
};

const page = document.body.dataset.page || "home";
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function normalise(value) {
  return String(value || "").trim().toLowerCase();
}

function uniqueValues(items, key) {
  return [...new Set(items.map((item) => item[key]).filter(Boolean))].sort();
}

function toWhatsAppPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length === 7 ? `960${digits}` : digits;
}

function setupActiveNavigation() {
  document.querySelectorAll(`[data-nav-page="${page}"]`).forEach((link) => {
    link.classList.add("is-active");
    link.setAttribute("aria-current", "page");
  });
}

function setupMobileMenu() {
  const toggle = document.querySelector("[data-menu-toggle]");
  const menu = document.querySelector("[data-menu]");
  if (!toggle || !menu) return;

  const setOpen = (isOpen) => {
    document.body.classList.toggle("nav-open", isOpen);
    menu.classList.toggle("is-open", isOpen);
    toggle.classList.toggle("is-open", isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));
  };

  toggle.addEventListener("click", () => {
    setOpen(!menu.classList.contains("is-open"));
  });

  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setOpen(false));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });
}

function setupPageTransition() {
  document.body.classList.add("page-ready");

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link) return;

    const href = link.getAttribute("href") || "";
    const isExternal =
      href.startsWith("#") ||
      href.startsWith("http") ||
      href.startsWith("//") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      link.target === "_blank" ||
      link.hasAttribute("download");

    if (isExternal || prefersReducedMotion.matches) return;

    event.preventDefault();
    document.body.classList.add("page-leaving");
    window.setTimeout(() => {
      window.location.href = href;
    }, 180);
  });
}

function setupRevealObserver() {
  const items = document.querySelectorAll(".reveal-item:not(.revealed)");
  if (!items.length) return;

  if (prefersReducedMotion.matches || !("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("revealed"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("revealed");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.08 });

  items.forEach((item) => observer.observe(item));
}

function setupHeroDepth() {
  const hero = document.querySelector("[data-hero-depth]");
  if (!hero || prefersReducedMotion.matches) return;
  if (!window.matchMedia("(pointer: fine)").matches) return;

  let frame = 0;
  let nextX = 0;
  let nextY = 0;

  hero.addEventListener("pointermove", (event) => {
    const rect = hero.getBoundingClientRect();
    nextX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    nextY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;

    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      hero.style.setProperty("--mx", nextX.toFixed(3));
      hero.style.setProperty("--my", nextY.toFixed(3));
      frame = 0;
    });
  });

  hero.addEventListener("pointerleave", () => {
    hero.style.setProperty("--mx", "0");
    hero.style.setProperty("--my", "0");
  });
}

function createOptions(values, placeholder) {
  return `<option value="">${escapeHtml(placeholder)}</option>` +
    values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
}

function populateFilters(type, items) {
  const categories = type === "experiences" ? data.experienceCategories : data.categories;
  document.querySelectorAll(`[data-category-options="${type}"]`).forEach((select) => {
    const current = select.value;
    select.innerHTML = createOptions(categories.map((category) => category.value), "All categories");
    select.value = current;
  });

  document.querySelectorAll(`[data-location-options="${type}"]`).forEach((select) => {
    const current = select.value;
    select.innerHTML = createOptions(uniqueValues(items, "location"), "Any location");
    select.value = current;
  });
}

function itemMatches(item, filters) {
  const searchText = [
    item.title,
    item.category,
    item.location,
    item.description,
    item.owner,
    item.provider,
    item.duration
  ].join(" ");

  const queryOk = !filters.query || normalise(searchText).includes(normalise(filters.query));
  const categoryOk = !filters.category || normalise(item.category) === normalise(filters.category);
  const locationOk = !filters.location || normalise(item.location) === normalise(filters.location);
  return queryOk && categoryOk && locationOk;
}

function renderRentalCard(listing) {
  const phone = toWhatsAppPhone(listing.phone);
  const contactHref = phone ? `https://wa.me/${phone}` : "contact.html";
  const contactTarget = phone ? ' target="_blank" rel="noopener noreferrer"' : "";

  return `
    <article class="listing-card rental-card reveal-item">
      <button class="save-button" type="button" aria-label="Save ${escapeHtml(listing.title)}" data-save-button>
        <span aria-hidden="true">+</span>
      </button>
      <img src="${escapeHtml(listing.image)}" alt="${escapeHtml(listing.title)}" loading="lazy" onerror="this.src='assets/logo.png'" />
      <div class="listing-card-body">
        <div class="listing-meta">
          <span class="badge">${escapeHtml(listing.category)}</span>
          <strong>${escapeHtml(listing.price)}</strong>
        </div>
        <h3>${escapeHtml(listing.title)}</h3>
        <p>${escapeHtml(listing.description || "Contact the owner directly for details.")}</p>
        <dl class="detail-list">
          <div><dt>Location</dt><dd>${escapeHtml(listing.location)}</dd></div>
          <div><dt>Owner</dt><dd>${escapeHtml(listing.owner || "Private owner")}</dd></div>
        </dl>
        <div class="card-actions">
          <a class="contact-button" href="${escapeHtml(contactHref)}"${contactTarget}>Message on WhatsApp</a>
          <button class="secondary-action" type="button" data-photo="${escapeHtml(listing.image)}" data-photo-title="${escapeHtml(listing.title)}">More Photos</button>
        </div>
      </div>
    </article>`;
}

function renderExperienceCard(experience) {
  const phone = toWhatsAppPhone(experience.phone);
  const contactHref = phone ? `https://wa.me/${phone}` : "contact.html";
  const contactTarget = phone ? ' target="_blank" rel="noopener noreferrer"' : "";
  const sampleBadge = experience.isSample ? '<span class="badge badge-muted">Sample listing</span>' : "";

  return `
    <article class="listing-card experience-card reveal-item">
      <img src="${escapeHtml(experience.image)}" alt="${escapeHtml(experience.title)}" loading="lazy" onerror="this.src='assets/logo.png'" />
      <div class="listing-card-body">
        <div class="listing-meta">
          <span class="badge">${escapeHtml(experience.category)}</span>
          ${sampleBadge}
        </div>
        <h3>${escapeHtml(experience.title)}</h3>
        <p>${escapeHtml(experience.description)}</p>
        <dl class="detail-list">
          <div><dt>Duration</dt><dd>${escapeHtml(experience.duration)}</dd></div>
          <div><dt>Price</dt><dd>${escapeHtml(experience.price)}</dd></div>
          <div><dt>Location</dt><dd>${escapeHtml(experience.location)}</dd></div>
          <div><dt>Provider</dt><dd>${escapeHtml(experience.provider)}</dd></div>
        </dl>
        <div class="card-actions single">
          <a class="contact-button" href="${escapeHtml(contactHref)}"${contactTarget}>
            ${phone ? "Contact Provider" : "Add Provider Contact"}
          </a>
        </div>
      </div>
    </article>`;
}

function renderCards(type, items, target) {
  const renderer = type === "experiences" ? renderExperienceCard : renderRentalCard;
  target.innerHTML = items.map(renderer).join("");
  setupSaveButtons();
  setupPhotoModal();
  setupRevealObserver();
}

function setupFeaturedGrids() {
  document.querySelectorAll("[data-featured-rentals]").forEach((grid) => {
    renderCards("rentals", data.listings.slice(0, Number(grid.dataset.limit || 3)), grid);
  });

  document.querySelectorAll("[data-featured-experiences]").forEach((grid) => {
    renderCards("experiences", data.experiences.slice(0, Number(grid.dataset.limit || 3)), grid);
  });
}

function setupListingFilters(type) {
  const form = document.querySelector(`[data-listing-filters="${type}"]`);
  const grid = document.querySelector(`[data-listings="${type}"]`);
  if (!form || !grid) return;

  const items = type === "experiences" ? data.experiences : data.listings;
  populateFilters(type, items);

  const count = document.querySelector(`[data-result-count="${type}"]`);
  const empty = document.querySelector(`[data-empty-state="${type}"]`);

  const apply = () => {
    const values = new FormData(form);
    const filters = {
      query: values.get("query") || "",
      category: values.get("category") || "",
      location: values.get("location") || ""
    };
    const filtered = items.filter((item) => itemMatches(item, filters));
    renderCards(type, filtered, grid);

    if (count) {
      const label = type === "experiences" ? "experience" : "rental";
      count.textContent = `${filtered.length} ${label}${filtered.length === 1 ? "" : "s"} found`;
    }

    if (empty) empty.hidden = filtered.length > 0;
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    apply();
  });
  form.addEventListener("input", apply);
  form.addEventListener("change", apply);

  form.querySelector("[data-clear-filters]")?.addEventListener("click", () => {
    form.reset();
    apply();
  });

  apply();
}

function setupSaveButtons() {
  document.querySelectorAll("[data-save-button]").forEach((button) => {
    if (button.dataset.ready) return;
    button.dataset.ready = "true";
    button.addEventListener("click", () => {
      const active = button.classList.toggle("is-active");
      button.setAttribute("aria-label", active ? "Saved" : button.getAttribute("aria-label").replace("Saved", "Save"));
      button.querySelector("span").textContent = active ? "Saved" : "+";
    });
  });
}

function setupPhotoModal() {
  const modal = document.querySelector("[data-photo-modal]");
  const image = document.querySelector("[data-photo-modal-image]");
  const title = document.querySelector("[data-photo-modal-title]");
  const close = document.querySelector("[data-photo-modal-close]");
  if (!modal || !image || !title || !close || modal.dataset.ready) return;

  const hide = () => {
    modal.hidden = true;
    document.body.classList.remove("modal-open");
  };

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-photo]");
    if (!trigger) return;
    image.src = trigger.dataset.photo || "assets/logo.png";
    image.alt = trigger.dataset.photoTitle || "Listing photo";
    title.textContent = trigger.dataset.photoTitle || "Listing photo";
    modal.hidden = false;
    document.body.classList.add("modal-open");
  });

  close.addEventListener("click", hide);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) hide();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) hide();
  });

  modal.dataset.ready = "true";
}

function setupForms() {
  document.querySelectorAll("[data-list-form], [data-contact-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const success = form.querySelector("[data-form-success]");
      if (success) success.hidden = false;

      if (form.hasAttribute("data-list-form")) {
        const values = new FormData(form);
        const message = encodeURIComponent([
          "New RentHub listing request",
          `Type: ${values.get("type") || ""}`,
          `Title: ${values.get("title") || ""}`,
          `Price: ${values.get("price") || ""}`,
          `Location: ${values.get("location") || ""}`,
          `Contact: ${values.get("contact") || ""}`,
          `Description: ${values.get("description") || ""}`
        ].join("\n"));
        window.open(`https://wa.me/9607873015?text=${message}`, "_blank", "noopener,noreferrer");
      }
    });
  });
}

setupActiveNavigation();
setupMobileMenu();
setupPageTransition();
setupHeroDepth();
setupFeaturedGrids();
setupListingFilters("rentals");
setupListingFilters("experiences");
setupForms();
setupRevealObserver();
