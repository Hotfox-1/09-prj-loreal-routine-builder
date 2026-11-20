/* Find the page controls we will update as the user explores. */
const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const productsContainer = document.getElementById("productsContainer");
const resultsCount = document.getElementById("resultsCount");
const selectedProductsList = document.getElementById("selectedProductsList");
const selectedCount = document.getElementById("selectedCount");
const clearSelectionsButton = document.getElementById("clearSelections");
const generateButton = document.getElementById("generateRoutine");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendBtn");
const webSearchToggle = document.getElementById("webSearchToggle");
const languageDirection = document.getElementById("languageDirection");

/* Send advisor requests to the configured endpoint; no API key is stored here. */
const ADVISOR_ENDPOINT = "https://loreal-bot.dracunyan2000.workers.dev/";

/* Keep the product catalogue, selected IDs, and conversation in memory. */
let allProducts = [];
let selectedProductIds = loadSelectedProductIds();
let conversation = [];
let hasGeneratedRoutine = false;
let requestInProgress = false;

/* Use a safe helper whenever product data is placed inside an HTML template. */
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const characters = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return characters[character];
  });
}

/* Restore saved product IDs, ignoring invalid or unavailable browser storage. */
function loadSelectedProductIds() {
  try {
    const savedIds = JSON.parse(localStorage.getItem("lorealSelectedProducts") || "[]");
    return Array.isArray(savedIds) ? savedIds.map(String) : [];
  } catch (error) {
    return [];
  }
}

/* Save only product IDs so the saved list stays small and easy to update. */
function saveSelectedProductIds() {
  try {
    localStorage.setItem("lorealSelectedProducts", JSON.stringify(selectedProductIds));
  } catch (error) {
    // Keep selections available for this visit if browser storage is unavailable.
  }
}

/* Load the JSON catalogue, then fill the category menu from its real data. */
async function loadProducts() {
  try {
    const response = await fetch("products.json");
    if (!response.ok) {
      throw new Error("The product catalogue could not be loaded.");
    }
    const data = await response.json();
    allProducts = Array.isArray(data.products) ? data.products : [];
    fillCategoryFilter();
    selectedProductIds = selectedProductIds.filter((id) =>
      allProducts.some((product) => String(product.id) === id)
    );
    saveSelectedProductIds();
    displayProducts();
    displaySelectedProducts();
  } catch (error) {
    productsContainer.innerHTML = '<p class="empty-state">We could not load the product collection. Please refresh and try again.</p>';
  }
}

/* Build category options from product data so every category can be found. */
function fillCategoryFilter() {
  const categories = [...new Set(allProducts.map((product) => product.category).filter(Boolean))].sort();
  categoryFilter.innerHTML = '<option value="">All categories</option>' + categories
    .map((category) => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`)
    .join("");
}

/* Filter by both category and the search phrase, then draw matching cards. */
function displayProducts() {
  const chosenCategory = categoryFilter.value;
  const searchTerm = productSearch.value.trim().toLowerCase();
  const filteredProducts = allProducts.filter((product) => {
    const matchesCategory = !chosenCategory || product.category === chosenCategory;
    const searchableText = `${product.name} ${product.brand} ${product.category} ${product.description}`.toLowerCase();
    return matchesCategory && searchableText.includes(searchTerm);
  });

  resultsCount.textContent = `${filteredProducts.length} ${filteredProducts.length === 1 ? "product" : "products"}`;

  if (filteredProducts.length === 0) {
    productsContainer.innerHTML = '<p class="empty-state">No products match that search. Try another name or category.</p>';
    return;
  }

  productsContainer.innerHTML = filteredProducts.map((product) => {
    const productId = String(product.id);
    const isSelected = selectedProductIds.includes(productId);
    const descriptionId = `description-${productId}`;
    return `
      <article class="product-card ${isSelected ? "is-selected" : ""}">
        <button class="product-select" type="button" data-product-id="${escapeHTML(productId)}" aria-pressed="${isSelected}" aria-label="${isSelected ? "Remove" : "Add"} ${escapeHTML(product.name)} ${isSelected ? "from" : "to"} selected products">
          <span class="product-image-wrap"><img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}" loading="lazy" /><span class="selected-indicator" aria-hidden="true"><i class="fa-solid fa-check"></i></span></span>
          <span class="product-info"><span class="product-brand">${escapeHTML(product.brand)}</span><span class="product-name">${escapeHTML(product.name)}</span><span class="product-category">${escapeHTML(product.category)}</span></span>
        </button>
        <button class="description-toggle" type="button" aria-expanded="false" aria-controls="${descriptionId}"><span>About this product</span><i class="fa-solid fa-plus" aria-hidden="true"></i></button>
        <p class="product-description" id="${descriptionId}" hidden>${escapeHTML(product.description || "No description is available for this product yet.")}</p>
      </article>`;
  }).join("");
}

/* Draw removable product chips and update the selected count. */
function displaySelectedProducts() {
  const selectedProducts = allProducts.filter((product) => selectedProductIds.includes(String(product.id)));
  selectedCount.textContent = String(selectedProducts.length);
  clearSelectionsButton.disabled = selectedProducts.length === 0;
  generateButton.disabled = selectedProducts.length === 0 || requestInProgress;

  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = '<p class="selected-empty">Your edit is waiting to take shape. Add products from the collection above.</p>';
    return;
  }

  selectedProductsList.innerHTML = selectedProducts.map((product) => `
    <div class="selected-item">
      <span>${escapeHTML(product.name)} <small>${escapeHTML(product.brand)}</small></span>
      <button type="button" class="remove-selected" data-remove-id="${escapeHTML(product.id)}" aria-label="Remove ${escapeHTML(product.name)}"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
    </div>`).join("");
}

/* Add or remove one product, save the change, and redraw both lists. */
function toggleProduct(productId) {
  if (selectedProductIds.includes(productId)) {
    selectedProductIds = selectedProductIds.filter((id) => id !== productId);
  } else {
    selectedProductIds.push(productId);
  }
  saveSelectedProductIds();
  displayProducts();
  displaySelectedProducts();
}

/* Add one chat bubble without treating AI text as HTML. */
function addChatMessage(role, text, citations = []) {
  const message = document.createElement("article");
  message.className = `chat-message ${role}`;
  const label = document.createElement("span");
  label.className = "message-label";
  label.textContent = role === "assistant" ? "YOUR ADVISOR" : "YOU";
  const content = document.createElement("p");
  content.className = "message-content";
  content.textContent = text;
  message.append(label, content);

  const safeCitations = citations.filter((citation) => citation && /^https?:\/\//i.test(citation.url || ""));
  if (safeCitations.length > 0) {
    const citationList = document.createElement("div");
    citationList.className = "citation-list";
    const citationLabel = document.createElement("span");
    citationLabel.textContent = "Sources";
    citationList.append(citationLabel);
    safeCitations.forEach((citation, index) => {
      const link = document.createElement("a");
      link.href = citation.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = citation.title || `Source ${index + 1}`;
      citationList.append(link);
    });
    message.append(citationList);
  }

  chatWindow.append(message);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Collect citations returned with the advisor's response. */
function getCitations(data) {
  const message = data?.choices?.[0]?.message;
  const annotations = Array.isArray(message?.annotations) ? message.annotations : [];
  const annotationCitations = annotations
    .filter((annotation) => annotation.type === "url_citation" && annotation.url_citation?.url)
    .map((annotation) => ({
      url: annotation.url_citation.url,
      title: annotation.url_citation.title,
    }));
  const citations = Array.isArray(data?.citations) ? data.citations : [];
  return [...annotationCitations, ...citations];
}

/* Send the full message history to the advisor, never an API key. */
async function requestAdvisorReply() {
  const response = await fetch(ADVISOR_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: conversation,
      web_search: webSearchToggle.checked,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || data.message || "Your advisor could not complete the request.");
  }

  const reply = data.choices?.[0]?.message?.content;
  if (typeof reply !== "string" || !reply.trim()) {
    throw new Error("Your advisor's response could not be displayed. Please try again.");
  }
  return { reply, citations: getCitations(data) };
}

/* Lock controls while a request is running to prevent duplicate submissions. */
function setRequestState(isBusy) {
  requestInProgress = isBusy;
  generateButton.disabled = isBusy || selectedProductIds.length === 0;
  userInput.disabled = isBusy || !hasGeneratedRoutine;
  sendButton.disabled = isBusy || !hasGeneratedRoutine;
  displaySelectedProducts();
}

/* Generate a new routine using only the currently selected product details. */
async function generateRoutine() {
  const selectedProducts = allProducts
    .filter((product) => selectedProductIds.includes(String(product.id)))
    .map(({ name, brand, category, description }) => ({ name, brand, category, description }));

  if (selectedProducts.length === 0 || requestInProgress) {
    return;
  }

  conversation = [
    {
      role: "system",
      content: "You are a warm, careful beauty advisor. Use the user's selected product data to create a clear, practical routine, in sensible application order, with morning/evening steps when appropriate. Explain briefly why each product fits. Be mindful of skin and hair sensitivities, suggest patch testing, and do not make medical claims. Keep follow-up answers focused on the generated routine or skincare, haircare, makeup, fragrance, and related beauty topics. If asked something unrelated, politely guide the conversation back to those topics. Do not invent product facts. If web search is enabled and sources are returned, use them carefully and cite them.",
    },
    {
      role: "user",
      content: `Please build a personalized routine using only these selected products. Product data:\n${JSON.stringify(selectedProducts, null, 2)}`,
    },
  ];

  chatWindow.innerHTML = "";
  addChatMessage("assistant", "I’m bringing your selected products together into a routine…");
  hasGeneratedRoutine = false;
  setRequestState(true);

  try {
    const { reply, citations } = await requestAdvisorReply();
    conversation.push({ role: "assistant", content: reply });
    chatWindow.innerHTML = "";
    addChatMessage("assistant", reply, citations);
    hasGeneratedRoutine = true;
    userInput.placeholder = "Ask a follow-up about your routine…";
    userInput.focus();
  } catch (error) {
    conversation = [];
    chatWindow.innerHTML = "";
    addChatMessage("assistant", error.message || "Something went wrong. Please try again.");
  } finally {
    setRequestState(false);
  }
}

/* Send a follow-up question with all earlier turns for context. */
async function sendFollowUp(question) {
  conversation.push({ role: "user", content: question });
  addChatMessage("user", question);
  setRequestState(true);

  try {
    const { reply, citations } = await requestAdvisorReply();
    conversation.push({ role: "assistant", content: reply });
    addChatMessage("assistant", reply, citations);
  } catch (error) {
    conversation.pop();
    addChatMessage("assistant", error.message || "Something went wrong. Please try again.");
  } finally {
    setRequestState(false);
    userInput.focus();
  }
}

/* Product cards and description controls use event delegation. */
productsContainer.addEventListener("click", (event) => {
  const descriptionButton = event.target.closest(".description-toggle");
  if (descriptionButton) {
    const description = document.getElementById(descriptionButton.getAttribute("aria-controls"));
    const isExpanded = descriptionButton.getAttribute("aria-expanded") === "true";
    descriptionButton.setAttribute("aria-expanded", String(!isExpanded));
    description.hidden = isExpanded;
    descriptionButton.querySelector("i").className = `fa-solid ${isExpanded ? "fa-plus" : "fa-minus"}`;
    return;
  }

  const selectButton = event.target.closest(".product-select");
  if (selectButton) {
    toggleProduct(selectButton.dataset.productId);
  }
});

/* A selected-list remove button unselects that product everywhere. */
selectedProductsList.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove-id]");
  if (removeButton) {
    toggleProduct(String(removeButton.dataset.removeId));
  }
});

categoryFilter.addEventListener("change", displayProducts);
productSearch.addEventListener("input", displayProducts);

clearSelectionsButton.addEventListener("click", () => {
  selectedProductIds = [];
  saveSelectedProductIds();
  displayProducts();
  displaySelectedProducts();
});

generateButton.addEventListener("click", generateRoutine);

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const question = userInput.value.trim();
  if (!question || !hasGeneratedRoutine || requestInProgress) {
    return;
  }
  userInput.value = "";
  await sendFollowUp(question);
});

/* Flip the whole interface for RTL languages; the product data stays intact. */
languageDirection.addEventListener("change", () => {
  document.documentElement.dir = languageDirection.value;
  document.documentElement.lang = languageDirection.value === "rtl" ? "ar" : "en";
});

/* Start with the saved selections and product collection. */
loadProducts();