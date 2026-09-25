(() => {
  "use strict";

  const products = window.SHOP_PRODUCTS || [];
  const productById = new Map(products.map(product => [product.id, product]));
  const $ = selector => document.querySelector(selector);
  const money = cents => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
  const priceInCents = product => Math.round(product.price * 100);
  const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const PAGE_SIZE = 8;
  const MAX_QUANTITY = 99;

  function readStored(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  const storedCart = readStored("gather-goods-cart-v1", []);
  const cart = new Map();
  if (Array.isArray(storedCart)) {
    storedCart.forEach(item => {
      if (item && productById.has(item.id) && Number.isInteger(item.quantity) && item.quantity > 0) {
        cart.set(item.id, Math.min(item.quantity, MAX_QUANTITY));
      }
    });
  }
  const storedFavorites = readStored("gather-goods-saved-v1", []);
  const favorites = new Set(Array.isArray(storedFavorites) ? storedFavorites.filter(id => productById.has(id)) : []);
  const state = { category: "all", search: "", sort: "featured", onlySaved: false, visible: PAGE_SIZE };
  let detailId = null;
  let detailQuantity = 1;
  let toastTimer;
  let storageNoticeShown = false;

  function scrollToShop() {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    $("#shop").scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth" });
  }

  function notify(message) {
    const toast = $("#toast");
    // Place feedback inside the active modal so it remains visible in the top layer.
    const target = document.querySelector("dialog[open]") || document.body;
    if (toast.parentElement !== target) target.appendChild(toast);
    clearTimeout(toastTimer);
    $("#toast-message").textContent = message;
    toast.classList.add("visible");
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 2800);
  }

  function persist() {
    try {
      localStorage.setItem("gather-goods-cart-v1", JSON.stringify([...cart].map(([id, quantity]) => ({ id, quantity }))));
      localStorage.setItem("gather-goods-saved-v1", JSON.stringify([...favorites]));
    } catch {
      if (!storageNoticeShown) {
        storageNoticeShown = true;
        notify("Browser storage is unavailable. Your selections will last for this visit.");
      }
    }
  }

  function filteredProducts() {
    const terms = state.search.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    const result = products.filter(product => {
      const searchable = `${product.name} ${product.category} ${product.description}`.toLocaleLowerCase();
      return (state.category === "all" || product.category === state.category)
        && (!state.onlySaved || favorites.has(product.id))
        && terms.every(term => searchable.includes(term));
    });
    if (state.sort === "price-low") result.sort((a, b) => a.price - b.price);
    if (state.sort === "price-high") result.sort((a, b) => b.price - a.price);
    if (state.sort === "name") result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }

  function productCard(product) {
    const saved = favorites.has(product.id);
    const id = escapeHTML(product.id);
    return `<article class="product-card" data-product-id="${id}">
      <div class="product-photo">
        <button class="product-image-button" data-action="details" data-id="${id}" aria-label="View ${escapeHTML(product.name)}">
          <img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.imageAlt || product.name)}" loading="lazy" width="600" height="650">
          <span class="quick-view-label">Take a closer look</span>
        </button>
        ${product.badge ? `<span class="product-badge">${escapeHTML(product.badge)}</span>` : ""}
        <button class="save-button" data-action="save" data-id="${id}" aria-label="${saved ? "Unsave" : "Save"} ${escapeHTML(product.name)}" aria-pressed="${saved}">${icon("heart")}</button>
      </div>
      <div class="product-info"><p class="product-category">${escapeHTML(product.category)}</p>
        <h3 class="product-title"><button data-action="details" data-id="${id}">${escapeHTML(product.name)}</button></h3>
        <div class="product-bottom"><span class="product-price">${money(priceInCents(product))}</span><button class="add-button" data-action="add" data-id="${id}" aria-label="Add ${escapeHTML(product.name)} to bag">${icon("plus")} Add</button></div>
      </div>
    </article>`;
  }

  function updateSavedCount() {
    $("#saved-count").textContent = favorites.size;
    $("#saved-count").hidden = favorites.size === 0;
    $("#favorites-toggle").setAttribute("aria-pressed", String(state.onlySaved));
    $("#favorites-toggle").setAttribute("aria-label", `${state.onlySaved ? "Show all products" : "Show saved products"}, ${favorites.size} saved`);
  }

  function renderProducts() {
    const result = filteredProducts();
    const shown = result.slice(0, state.visible);
    $("#product-grid").innerHTML = shown.map(productCard).join("");
    $("#results-count").textContent = `${result.length} ${state.onlySaved ? "saved " : ""}${result.length === 1 ? "find" : "finds"}${state.category !== "all" ? ` in ${state.category}` : " to make your day"}`;
    $("#showing-count").textContent = `You've seen ${shown.length} of ${result.length} good things`;
    $("#load-more").hidden = shown.length >= result.length;
    $("#load-more-wrap").hidden = result.length === 0;
    $("#empty-state").hidden = result.length > 0;
    $("#empty-heading").textContent = state.onlySaved && favorites.size === 0 ? "Your favorites start here." : "No finds just yet.";
    $("#empty-message").textContent = state.onlySaved && favorites.size === 0 ? "Tap the heart on any product to keep your favorite finds together." : "Try another search or explore a different category.";
    const descriptions = [];
    if (state.onlySaved) descriptions.push("Your saved finds");
    if (state.search.trim()) descriptions.push(`Search: “${state.search.trim()}”`);
    if (state.category !== "all") descriptions.push(state.category);
    $("#active-filters").hidden = descriptions.length === 0;
    $("#filter-description").textContent = descriptions.join(" · ");
    document.querySelectorAll("[data-category]").forEach(button => {
      const active = button.dataset.category === state.category;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    updateSavedCount();
  }

  function resetFilters() {
    state.category = "all";
    state.search = "";
    state.onlySaved = false;
    state.visible = PAGE_SIZE;
    state.sort = "featured";
    $("#search-input").value = "";
    $("#sort-select").value = "featured";
    renderProducts();
  }

  function restoreCardFocus(id, action) {
    const button = [...document.querySelectorAll("#product-grid [data-action]")].find(element => element.dataset.id === id && element.dataset.action === action);
    (button || $("#clear-filters") || $("#favorites-toggle")).focus({ preventScroll: true });
  }

  function toggleFavorite(id, fromGrid = false) {
    const wasSaved = favorites.has(id);
    if (wasSaved) favorites.delete(id); else favorites.add(id);
    renderProducts();
    if (detailId === id && $("#product-dialog").open) {
      const button = $("#detail-save");
      button.setAttribute("aria-pressed", String(!wasSaved));
      button.innerHTML = `${icon("heart")} ${wasSaved ? "Save for later" : "Saved to your favorites"}`;
    }
    if (fromGrid) restoreCardFocus(id, "save");
    notify(wasSaved ? "Removed from your saved finds" : "A good find, saved for later");
    persist();
  }

  function addToCart(id, quantity = 1) {
    if (!productById.has(id)) return;
    const current = cart.get(id) || 0;
    const amount = Math.min(quantity, MAX_QUANTITY - current);
    if (amount === 0) {
      notify("Your bag already has the maximum quantity of this item.");
      return;
    }
    cart.set(id, current + amount);
    renderCart();
    notify(`${amount === 1 ? "A good find" : `${amount} good finds`} added to your bag`);
    persist();
  }

  function renderCart() {
    const count = [...cart.values()].reduce((sum, quantity) => sum + quantity, 0);
    $("#cart-count").textContent = count;
    $("#cart-heading-count").textContent = `(${count})`;
    $("#cart-open").setAttribute("aria-label", `Open shopping bag, ${count} ${count === 1 ? "item" : "items"}`);
    $("#cart-empty").hidden = cart.size > 0;
    $("#cart-items").hidden = cart.size === 0;
    $("#cart-summary").hidden = cart.size === 0;
    let subtotal = 0;
    $("#cart-items").innerHTML = [...cart].map(([id, quantity]) => {
      const product = productById.get(id);
      const safeId = escapeHTML(id);
      const lineTotal = priceInCents(product) * quantity;
      subtotal += lineTotal;
      return `<div class="cart-row" data-cart-id="${safeId}">
        <img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.imageAlt || product.name)}" width="76" height="94">
        <div class="cart-item-info"><h3>${escapeHTML(product.name)}</h3><p>${money(priceInCents(product))} each</p>
          <div class="quantity-control" role="group" aria-label="Quantity for ${escapeHTML(product.name)}"><button data-cart-action="decrease" data-id="${safeId}" aria-label="Decrease quantity of ${escapeHTML(product.name)}">${icon("minus")}</button><span aria-live="polite">${quantity}</span><button data-cart-action="increase" data-id="${safeId}" aria-label="Increase quantity of ${escapeHTML(product.name)}" ${quantity >= MAX_QUANTITY ? "disabled" : ""}>${icon("plus")}</button></div>
        </div><div class="cart-item-end"><strong>${money(lineTotal)}</strong><button class="remove-item" data-cart-action="remove" data-id="${safeId}" aria-label="Remove ${escapeHTML(product.name)} from bag">Remove</button></div>
      </div>`;
    }).join("");
    $("#cart-subtotal").textContent = money(subtotal);
  }

  function openDialog(dialog) {
    dialog.showModal();
    document.body.classList.add("modal-open");
  }

  function showDetails(id) {
    const product = productById.get(id);
    if (!product) return;
    detailId = id;
    detailQuantity = 1;
    const saved = favorites.has(id);
    $("#product-detail").innerHTML = `<img class="detail-image" src="${escapeHTML(product.image)}" alt="${escapeHTML(product.imageAlt || product.name)}" width="600" height="650">
      <div class="detail-content"><span class="eyebrow">${escapeHTML(product.category.toUpperCase())}</span><h2 id="detail-name">${escapeHTML(product.name)}</h2><p class="detail-price">${money(priceInCents(product))}</p><p class="detail-description">${escapeHTML(product.description)}</p>
      <div class="detail-quantity">Quantity <div class="quantity-control" role="group" aria-label="Product quantity"><button id="detail-minus" aria-label="Decrease quantity" disabled>${icon("minus")}</button><span id="detail-quantity" aria-live="polite">1</span><button id="detail-plus" aria-label="Increase quantity">${icon("plus")}</button></div></div>
      <button class="button button-dark" id="detail-add">${icon("bag")} Add to bag</button><button class="detail-save" id="detail-save" aria-pressed="${saved}">${icon("heart")} ${saved ? "Saved to your favorites" : "Save for later"}</button></div>`;
    openDialog($("#product-dialog"));
  }

  $("#product-grid").addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const { action, id } = button.dataset;
    if (action === "details") showDetails(id);
    if (action === "save") toggleFavorite(id, true);
    if (action === "add") addToCart(id);
  });

  $("#search-form").addEventListener("submit", event => {
    event.preventDefault();
    state.search = $("#search-input").value;
    state.visible = PAGE_SIZE;
    renderProducts();
    scrollToShop();
  });
  $("#search-input").addEventListener("input", event => {
    state.search = event.target.value;
    state.visible = PAGE_SIZE;
    renderProducts();
  });
  $("#sort-select").addEventListener("change", event => {
    state.sort = event.target.value;
    state.visible = PAGE_SIZE;
    renderProducts();
  });
  document.querySelectorAll("[data-category]").forEach(button => button.addEventListener("click", () => {
    state.category = button.dataset.category;
    state.visible = PAGE_SIZE;
    renderProducts();
  }));
  document.querySelectorAll("[data-nav-category]").forEach(link => link.addEventListener("click", () => {
    resetFilters();
    state.category = link.dataset.navCategory;
    renderProducts();
  }));
  $("#load-more").addEventListener("click", () => {
    const previousCount = $("#product-grid").children.length;
    state.visible += PAGE_SIZE;
    renderProducts();
    const nextCard = $("#product-grid").children[previousCount];
    if (nextCard) nextCard.querySelector("button").focus({ preventScroll: true });
  });
  $("#clear-filters").addEventListener("click", () => {
    resetFilters();
    $(".category-button").focus({ preventScroll: true });
  });
  $("#reset-search").addEventListener("click", () => {
    resetFilters();
    $(".category-button").focus({ preventScroll: true });
  });
  function showSaved(force = false) {
    const next = force || !state.onlySaved;
    resetFilters();
    state.onlySaved = next;
    renderProducts();
    scrollToShop();
  }
  $("#favorites-toggle").addEventListener("click", () => showSaved());
  $("#footer-saved").addEventListener("click", () => showSaved(true));
  $("#cart-open").addEventListener("click", () => openDialog($("#cart-dialog")));
  $("#cart-close").addEventListener("click", () => $("#cart-dialog").close());
  ["#continue-shopping", "#keep-browsing"].forEach(selector => $(selector).addEventListener("click", () => {
    $("#cart-dialog").close();
    scrollToShop();
  }));
  $("#detail-close").addEventListener("click", () => $("#product-dialog").close());

  $("#cart-items").addEventListener("click", event => {
    const button = event.target.closest("button[data-cart-action]");
    if (!button) return;
    const { id, cartAction } = button.dataset;
    const current = cart.get(id);
    if (!current) return;
    if (cartAction === "remove" || (cartAction === "decrease" && current === 1)) cart.delete(id);
    else if (cartAction === "decrease") cart.set(id, current - 1);
    else if (cartAction === "increase") cart.set(id, Math.min(current + 1, MAX_QUANTITY));
    renderCart();
    const nextButton = [...document.querySelectorAll("[data-cart-action]")].find(element => element.dataset.id === id && element.dataset.cartAction === cartAction && !element.disabled);
    const fallback = $("#cart-items button:not(:disabled)") || $("#continue-shopping");
    (nextButton || fallback).focus({ preventScroll: true });
    persist();
  });

  $("#product-detail").addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.id === "detail-save") toggleFavorite(detailId);
    if (button.id === "detail-add") addToCart(detailId, detailQuantity);
    if (button.id === "detail-minus" || button.id === "detail-plus") {
      detailQuantity = Math.max(1, Math.min(MAX_QUANTITY, detailQuantity + (button.id === "detail-plus" ? 1 : -1)));
      $("#detail-quantity").textContent = detailQuantity;
      $("#detail-minus").disabled = detailQuantity === 1;
      $("#detail-plus").disabled = detailQuantity === MAX_QUANTITY;
    }
  });

  document.querySelectorAll("dialog").forEach(dialog => {
    // Require both pointer-down and pointer-up outside to avoid closing on a drag.
    let startedOutside = false;
    const outside = event => {
      const rect = dialog.getBoundingClientRect();
      return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
    };
    dialog.addEventListener("pointerdown", event => { startedOutside = event.target === dialog && outside(event); });
    dialog.addEventListener("click", event => {
      if (startedOutside && event.target === dialog && outside(event)) dialog.close();
      startedOutside = false;
    });
    dialog.addEventListener("close", () => {
      document.body.classList.remove("modal-open");
      $("#toast").classList.remove("visible");
      document.body.appendChild($("#toast"));
      if (dialog.id === "product-dialog") {
        // Saving a favorite can re-render the grid while the dialog is open.
        if (document.activeElement === document.body) restoreCardFocus(detailId, "details");
        detailId = null;
      }
    });
  });

  // Keep the page useful if a product photograph is missing or unavailable.
  document.addEventListener("error", event => {
    if (event.target instanceof HTMLImageElement && !event.target.dataset.fallback) {
      event.target.dataset.fallback = "true";
      event.target.src = "assets/placeholder.svg";
    }
  }, true);

  $("#year").textContent = new Date().getFullYear();
  renderProducts();
  renderCart();
})();
