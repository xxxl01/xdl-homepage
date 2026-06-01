const { createApp, nextTick, reactive } = Vue;
const app = document.querySelector("#app");
const categoryList = document.querySelector("#categoryList");
const summary = document.querySelector("#summary");
const editDialog = document.querySelector("#editDialog");
const searchForm = document.querySelector("#searchForm");
const searchEngineButtons = [
  ...document.querySelectorAll(".search-engine-btn"),
];
const searchInput = document.querySelector("#searchInput");
const bookmarkFile = document.querySelector("#bookmarkFile");
const batchBar = document.querySelector("#batchBar");
const batchInfo = document.querySelector("#batchInfo");
const loadingOverlay = document.querySelector("#loadingOverlay");
const loadingText = document.querySelector("#loadingText");
const SEARCH_ENGINE_KEY = "xdl_homepage_search_engine";
const ADMIN_PASSWORD_KEY = "xdl_homepage_admin_password";
const adminPasswordInput = document.querySelector("#adminPassword");
let navigationData = [];
let siteSearchQuery = "";
let searchEngine = localStorage.getItem(SEARCH_ENGINE_KEY) || "google";
const selectedItemIds = new Set();
let loadingCount = 0;
const viewState = reactive({
  categories: [],
  emptyMessage: "正在加载导航数据",
});

createApp({
  setup() {
    return { viewState, getItems };
  },
  template: `
        <li v-for="(category, index) in viewState.categories" :key="category.id">
          <a class="category-link" :class="{ active: index === 0 }" :href="'#category-' + category.id">
            <span>{{ category.name }}</span>
            <span class="category-count">{{ getItems(category).length }}</span>
          </a>
        </li>
      `,
}).mount(categoryList);

createApp({
  setup() {
    return {
      viewState,
      selectedItemIds,
      getItems,
      getHost,
      getFaviconUrl,
      handleIconError,
      iconSvg,
    };
  },
  template: `
        <template v-if="viewState.categories.length">
          <section v-for="category in viewState.categories" :id="'category-' + category.id" :key="category.id" class="section">
            <div class="section-head">
              <div class="section-meta">
                <h2 class="section-title">{{ category.name }}</h2>
                <span v-if="category.description" class="section-desc">{{ category.description }}</span>
              </div>
              <div class="section-actions">
                <button class="btn" type="button" data-action="select-category-items" :data-category-id="category.id"><span v-html="iconSvg('check-square')"></span>选择本组</button>
                <button class="btn primary" type="button" data-action="create-item" :data-category-id="category.id"><span v-html="iconSvg('plus')"></span>新增网站</button>
                <button class="btn" type="button" data-action="edit-category" :data-category-id="category.id"><span v-html="iconSvg('pencil')"></span>编辑分类</button>
                <button class="btn danger" type="button" data-action="delete-category" :data-category-id="category.id"><span v-html="iconSvg('trash-2')"></span>删除分类</button>
              </div>
            </div>

            <div v-if="getItems(category).length" class="grid">
              <article v-for="item in getItems(category)" :key="item.id" class="site-card">
                <input class="item-check" type="checkbox" :data-item-check="item.id" :aria-label="'选择 ' + item.title" :checked="selectedItemIds.has(item.id)">
                <a class="site-link" :href="item.url" target="_blank" rel="noopener noreferrer">
                  <div class="icon">
                    <img class="favicon" :src="getFaviconUrl(item)" alt="" loading="lazy" @error="handleIconError($event.target)">
                  </div>
                  <div class="card-body">
                    <h3 class="card-title"><span>{{ item.title }}</span><b class="external" v-html="iconSvg('external-link')"></b></h3>
                    <p class="card-desc">{{ item.description || '暂无描述' }}</p>
                    <div class="card-url">{{ getHost(item.url) }}</div>
                  </div>
                </a>
                <div class="card-actions">
                  <button class="btn" type="button" data-action="edit-item" :data-item-id="item.id" title="编辑网站" aria-label="编辑网站"><span v-html="iconSvg('pencil')"></span></button>
                  <button class="btn danger" type="button" data-action="delete-item" :data-item-id="item.id" title="删除网站" aria-label="删除网站"><span v-html="iconSvg('trash-2')"></span></button>
                </div>
              </article>
            </div>
            <div v-else class="empty-section">该分类下暂无网站</div>
          </section>
        </template>
        <div v-else class="state">{{ viewState.emptyMessage }}</div>
      `,
}).mount(app);

setSearchEngine(searchEngine, false);
adminPasswordInput.value = localStorage.getItem(ADMIN_PASSWORD_KEY) || "";
init();
document.addEventListener("click", handleActionClick);
searchForm.addEventListener("submit", handleSearchSubmit);
searchEngineButtons.forEach((button) => {
  button.addEventListener("click", () =>
    setSearchEngine(button.dataset.engine),
  );
});
searchInput.addEventListener("input", handleSearchInput);
bookmarkFile.addEventListener("change", handleBookmarkFileChange);
app.addEventListener("change", handleItemSelectionChange);
adminPasswordInput.addEventListener("input", () => {
  localStorage.setItem(ADMIN_PASSWORD_KEY, adminPasswordInput.value);
});
renderIcons();

async function init() {
  try {
    navigationData = await loadNavigation();
    render(filterNavigation(siteSearchQuery));
    bindActiveCategory();
    updateBatchBar();
    renderIcons();
  } catch (error) {
    console.error("导航数据加载失败：", error);
    summary.textContent = "加载失败";
    app.className = "state";
    viewState.emptyMessage = "导航数据加载失败，请检查后端接口 /api/navigation";
    viewState.categories = [];
  }
}

async function loadNavigation() {
  const response = await fetch("/api/navigation");
  if (!response.ok) throw new Error("接口返回异常");
  return await response.json();
}

function render(categories) {
  const itemCount = categories.reduce(
    (total, category) => total + getItems(category).length,
    0,
  );
  summary.textContent = siteSearchQuery
    ? `站内搜索：${categories.length} 个分类 · ${itemCount} 个结果`
    : `${categories.length} 个分类 · ${itemCount} 个网站`;

  app.className = categories.length ? "" : "state";
  viewState.emptyMessage = "暂无导航数据";
  viewState.categories = categories;
  nextTick(() => {
    bindActiveCategory();
    updateBatchBar();
    renderIcons();
  });
}

function handleSearchSubmit(event) {
  event.preventDefault();
  const keyword = searchInput.value.trim();
  const engine = searchEngine;
  localStorage.setItem(SEARCH_ENGINE_KEY, searchEngine);

  if (!keyword) {
    if (engine === "site") applySiteSearch("");
    return;
  }

  if (engine === "site") {
    applySiteSearch(keyword);
    return;
  }

  const url =
    engine === "baidu"
      ? `https://www.baidu.com/s?wd=${encodeURIComponent(keyword)}`
      : `https://www.google.com/search?q=${encodeURIComponent(keyword)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function setSearchEngine(engine, shouldApply = true) {
  searchEngine = engine || "google";
  localStorage.setItem(SEARCH_ENGINE_KEY, searchEngine);
  searchEngineButtons.forEach((button) => {
    const active = button.dataset.engine === searchEngine;
    button.classList.toggle("active", active);
    button.setAttribute("aria-checked", active ? "true" : "false");
  });

  if (!shouldApply) return;

  if (searchEngine === "site") {
    applySiteSearch(searchInput.value.trim());
    return;
  }
  if (siteSearchQuery) applySiteSearch("");
}

function handleSearchInput() {
  if (searchEngine === "site") {
    applySiteSearch(searchInput.value.trim());
  }
}

function applySiteSearch(keyword) {
  siteSearchQuery = keyword;
  render(filterNavigation(keyword));
  bindActiveCategory();
  updateBatchBar();
  renderIcons();
}

function filterNavigation(keyword) {
  const query = keyword.trim().toLowerCase();
  if (!query) return navigationData;

  return navigationData
    .map((category) => {
      const categoryMatched =
        `${category.name || ""} ${category.description || ""}`
          .toLowerCase()
          .includes(query);
      const items = getItems(category).filter((item) => {
        const text =
          `${item.title || ""} ${item.url || ""} ${item.description || ""}`.toLowerCase();
        return categoryMatched || text.includes(query);
      });
      return { ...category, items };
    })
    .filter((category) => getItems(category).length > 0);
}

function renderItem(item) {
  const host = getHost(item.url);
  const favicon = getFaviconUrl(item);
  return `
        <article class="site-card">
          <input class="item-check" type="checkbox" data-item-check="${item.id}" aria-label="选择 ${escapeAttr(item.title)}" ${selectedItemIds.has(item.id) ? "checked" : ""}>
          <a class="site-link" href="${escapeAttr(item.url)}" target="_blank" rel="noopener noreferrer">
            <div class="icon">
              <img class="favicon" src="${escapeAttr(favicon)}" alt="" loading="lazy" onerror="handleIconError(this)">
            </div>
            <div class="card-body">
              <h3 class="card-title"><span>${escapeHtml(item.title)}</span><b class="external">${iconSvg("external-link")}</b></h3>
              <p class="card-desc">${escapeHtml(item.description || "暂无描述")}</p>
              <div class="card-url">${escapeHtml(host)}</div>
            </div>
          </a>
          <div class="card-actions">
            <button class="btn" type="button" data-action="edit-item" data-item-id="${item.id}" title="编辑网站" aria-label="编辑网站">${iconSvg("pencil")}</button>
            <button class="btn danger" type="button" data-action="delete-item" data-item-id="${item.id}" title="删除网站" aria-label="删除网站">${iconSvg("trash-2")}</button>
          </div>
        </article>
      `;
}

async function handleActionClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const action = button.dataset.action;
  const categoryId = Number(button.dataset.categoryId);
  const itemId = Number(button.dataset.itemId);

  try {
    if (action === "create-category") await createCategory();
    if (action === "edit-category") await editCategory(categoryId);
    if (action === "delete-category") await deleteCategory(categoryId);
    if (action === "create-item") await createItem(categoryId);
    if (action === "edit-item") await editItem(itemId);
    if (action === "delete-item") await deleteItem(itemId);
    if (action === "import-bookmarks") bookmarkFile.click();
    if (action === "select-category-items") selectCategoryItems(categoryId);
    if (action === "batch-delete") await batchDeleteItems();
    if (action === "batch-move") await batchMoveItems();
    if (action === "clear-selection") clearSelection();
  } catch (error) {
    console.error("操作失败：", error);
    await openMessageDialog({
      title: "操作失败",
      message: error.message,
      type: "error",
    });
  }
}

async function handleBookmarkFileChange() {
  const file = bookmarkFile.files?.[0];
  bookmarkFile.value = "";
  if (!file) return;

  try {
    const html = await file.text();
    const categories = parseBookmarkHtml(html);
    const itemCount = categories.reduce(
      (total, category) => total + category.items.length,
      0,
    );
    if (itemCount === 0) {
      await openMessageDialog({
        title: "未读取到书签",
        message:
          "没有从书签文件中读取到可导入的网站。请确认选择的是浏览器导出的书签 HTML 文件。",
        type: "warning",
      });
      return;
    }

    const confirmed = await openMessageDialog({
      title: "确认导入书签",
      message: `读取到 ${categories.length} 个文件夹、${itemCount} 个书签。同名文件夹会复用已有分类，不存在则新建分类。`,
      type: "confirm",
      confirmText: "开始导入",
      cancelText: "取消",
    });
    if (!confirmed) return;

    const result = await withLoading("正在导入书签，请稍候...", async () => {
      const importResult = await request("/api/bookmarks/import", "POST", {
        categories,
      });
      await refresh();
      return importResult;
    });
    await openMessageDialog({
      title: "导入完成",
      message: `新增分类 ${result.created_categories} 个，复用分类 ${result.reused_categories} 个，新增网站 ${result.created_items} 个。`,
      type: "success",
    });
  } catch (error) {
    console.error("书签导入失败：", error);
    await openMessageDialog({
      title: "书签导入失败",
      message: error.message,
      type: "error",
    });
  }
}

function parseBookmarkHtml(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const groups = new Map();
  parseBookmarkContainer(doc.body, "未分类", groups);

  return [...groups.entries()].map(([name, items]) => ({ name, items }));
}

function parseBookmarkContainer(container, categoryName, groups) {
  const children = [...container.children];
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    const tagName = child.tagName?.toLowerCase();

    if (tagName === "a") {
      addBookmark(groups, categoryName, child);
      continue;
    }

    if (tagName === "h3") {
      const next = children[index + 1];
      const folderName = child.textContent.trim() || categoryName;
      if (next?.tagName?.toLowerCase() === "dl") {
        parseBookmarkContainer(next, folderName, groups);
        index += 1;
      }
      continue;
    }

    parseBookmarkContainer(child, categoryName, groups);
  }
}

function addBookmark(groups, categoryName, link) {
  const url = link.href || link.getAttribute("href") || "";
  const title = link.textContent.trim();
  if (!url || !title) return;

  const name = categoryName || "未分类";
  if (!groups.has(name)) groups.set(name, []);
  groups.get(name).push({
    title: title.slice(0, 100),
    url: url.slice(0, 500),
    description: null,
    icon: null,
  });
}

function handleItemSelectionChange(event) {
  const checkbox = event.target.closest("[data-item-check]");
  if (!checkbox) return;

  const itemId = Number(checkbox.dataset.itemCheck);
  if (checkbox.checked) {
    selectedItemIds.add(itemId);
  } else {
    selectedItemIds.delete(itemId);
  }
  updateBatchBar();
}

function selectCategoryItems(categoryId) {
  const category = findCategory(categoryId);
  if (!category) return;
  getItems(category).forEach((item) => selectedItemIds.add(item.id));
  render(filterNavigation(siteSearchQuery));
  bindActiveCategory();
  updateBatchBar();
  renderIcons();
}

function clearSelection() {
  selectedItemIds.clear();
  render(filterNavigation(siteSearchQuery));
  bindActiveCategory();
  updateBatchBar();
  renderIcons();
}

function updateBatchBar() {
  const count = selectedItemIds.size;
  batchBar.classList.toggle("active", count > 0);
  batchInfo.textContent = `已选择 ${count} 个网站`;
}

async function batchDeleteItems() {
  const itemIds = [...selectedItemIds];
  if (itemIds.length === 0) return;

  const confirmed = await openMessageDialog({
    title: "确认批量删除",
    message: `确认删除已选择的 ${itemIds.length} 个网站？该操作不可撤销。`,
    type: "confirm",
    confirmText: "删除",
    cancelText: "取消",
  });
  if (!confirmed) return;

  const result = await withLoading("正在批量删除网站...", async () => {
    const deleteResult = await request("/api/items/batch-delete", "POST", {
      item_ids: itemIds,
    });
    selectedItemIds.clear();
    await refresh();
    return deleteResult;
  });
  await openMessageDialog({
    title: "批量删除完成",
    message: `已删除 ${result.affected_items} 个网站。`,
    type: "success",
  });
}

async function batchMoveItems() {
  const itemIds = [...selectedItemIds];
  if (itemIds.length === 0) return;

  const payload = await openFormDialog({
    title: "移动到分类",
    subtitle: `将已选择的 ${itemIds.length} 个网站移动到指定分类。`,
    submitText: "确认移动",
    fields: [
      {
        name: "category_id",
        label: "目标分类",
        type: "select",
        value: "",
        required: true,
        options: navigationData.map((category) => ({
          value: category.id,
          label: category.name,
        })),
      },
    ],
    onSubmit: (data) => ({ category_id: Number(data.category_id) }),
  });
  if (!payload) return;

  const result = await withLoading("正在批量移动网站...", async () => {
    const moveResult = await request("/api/items/batch-move", "POST", {
      item_ids: itemIds,
      category_id: payload.category_id,
    });
    selectedItemIds.clear();
    await refresh();
    return moveResult;
  });
  await openMessageDialog({
    title: "批量移动完成",
    message: `已移动 ${result.affected_items} 个网站。`,
    type: "success",
  });
}

async function createCategory() {
  const payload = await openCategoryDialog(
    { name: "", description: "", sort_order: 0 },
    "新增分类",
  );
  if (!payload) return;
  await withLoading("正在新增分类...", async () => {
    await request("/api/categories", "POST", payload);
    await refresh();
  });
}

async function editCategory(categoryId) {
  const category = findCategory(categoryId);
  if (!category) return;
  const payload = await openCategoryDialog(category, "编辑分类");
  if (!payload) return;
  await withLoading("正在保存分类...", async () => {
    await request(`/api/categories/${categoryId}`, "PATCH", payload);
    await refresh();
  });
}

async function deleteCategory(categoryId) {
  const category = findCategory(categoryId);
  if (!category) return;
  const confirmed = await openMessageDialog({
    title: "确认删除分类",
    message: `确认删除分类「${category.name}」及其全部网站？该操作不可撤销。`,
    type: "confirm",
    confirmText: "删除",
    cancelText: "取消",
  });
  if (!confirmed) return;
  await withLoading("正在删除分类...", async () => {
    await request(`/api/categories/${categoryId}`, "DELETE");
    await refresh();
  });
}

async function createItem(categoryId) {
  const payload = await openItemDialog(
    {
      category_id: categoryId,
      title: "",
      url: "",
      description: "",
      icon: "",
      sort_order: 0,
    },
    "新增网站",
  );
  if (!payload) return;
  await withLoading("正在新增网站...", async () => {
    await request("/api/items", "POST", payload);
    await refresh();
  });
}

async function editItem(itemId) {
  const item = findItem(itemId);
  if (!item) return;
  const payload = await openItemDialog(item, "编辑网站");
  if (!payload) return;
  await withLoading("正在保存网站...", async () => {
    await request(`/api/items/${itemId}`, "PATCH", payload);
    await refresh();
  });
}

async function deleteItem(itemId) {
  const item = findItem(itemId);
  if (!item) return;
  const confirmed = await openMessageDialog({
    title: "确认删除网站",
    message: `确认删除网站「${item.title}」？该操作不可撤销。`,
    type: "confirm",
    confirmText: "删除",
    cancelText: "取消",
  });
  if (!confirmed) return;
  await withLoading("正在删除网站...", async () => {
    await request(`/api/items/${itemId}`, "DELETE");
    await refresh();
  });
}

function openCategoryDialog(category, title) {
  return openFormDialog({
    title,
    subtitle: "用于侧边栏分组和页面分区排序。",
    submitText: "保存分类",
    fields: [
      {
        name: "name",
        label: "分类名称",
        type: "text",
        value: category.name || "",
        required: true,
        placeholder: "例如：常用工具",
      },
      {
        name: "description",
        label: "分类描述",
        type: "textarea",
        value: category.description || "",
        placeholder: "可留空",
      },
      {
        name: "sort_order",
        label: "排序值",
        type: "number",
        value: category.sort_order ?? 0,
        placeholder: "数字越小越靠前",
      },
    ],
    onSubmit: (data) => ({
      name: data.name.trim(),
      description: data.description.trim() || null,
      sort_order: Number(data.sort_order) || 0,
    }),
  });
}

function openItemDialog(item, title) {
  return openFormDialog({
    title,
    subtitle: "网站图标会自动从网址获取，图标文字仅作为备用。",
    submitText: "保存网站",
    fields: [
      {
        name: "title",
        label: "网站名称",
        type: "text",
        value: item.title || "",
        required: true,
        placeholder: "例如：GitHub",
      },
      {
        name: "url",
        label: "网站地址",
        type: "url",
        value: item.url || "",
        required: true,
        placeholder: "https://example.com",
      },
      {
        name: "category_id",
        label: "所属分类",
        type: "select",
        value: item.category_id || "",
        required: true,
        options: navigationData.map((category) => ({
          value: category.id,
          label: category.name,
        })),
      },
      {
        name: "description",
        label: "网站描述",
        type: "textarea",
        value: item.description || "",
        placeholder: "可留空，当前不显示在卡片上",
      },
      {
        name: "icon",
        label: "备用图标文字",
        type: "text",
        value: item.icon || "",
        placeholder: "可留空",
      },
      {
        name: "sort_order",
        label: "排序值",
        type: "number",
        value: item.sort_order ?? 0,
        placeholder: "数字越小越靠前",
      },
    ],
    onSubmit: (data) => ({
      category_id: Number(data.category_id),
      title: data.title.trim(),
      url: data.url.trim(),
      description: data.description.trim() || null,
      icon: data.icon.trim() || null,
      sort_order: Number(data.sort_order) || 0,
    }),
  });
}

function openMessageDialog(config) {
  return new Promise((resolve) => {
    const isConfirm = config.type === "confirm";
    editDialog.innerHTML = `
          <div class="dialog-form">
            <div class="dialog-head">
              <div>
                <h2 class="dialog-title">${escapeHtml(config.title || "提示")}</h2>
                <p class="dialog-subtitle">${escapeHtml(config.message || "")}</p>
              </div>
              <button class="dialog-close" type="button" data-dialog-result="cancel" aria-label="关闭">${iconSvg("x")}</button>
            </div>
            <div class="dialog-actions">
              ${isConfirm ? `<button class="btn" type="button" data-dialog-result="cancel">${iconSvg("x")}${escapeHtml(config.cancelText || "取消")}</button>` : ""}
              <button class="btn primary" type="button" data-dialog-result="confirm">${iconSvg(isConfirm ? "check" : "check-circle")}${escapeHtml(config.confirmText || "知道了")}</button>
            </div>
          </div>
        `;

    renderIcons();
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      editDialog.close();
      editDialog.innerHTML = "";
      resolve(value);
    };

    editDialog.querySelectorAll("[data-dialog-result]").forEach((button) => {
      button.addEventListener("click", () =>
        finish(button.dataset.dialogResult === "confirm"),
      );
    });
    editDialog.addEventListener(
      "cancel",
      (event) => {
        event.preventDefault();
        finish(false);
      },
      { once: true },
    );

    editDialog.showModal();
    editDialog.querySelector('[data-dialog-result="confirm"]')?.focus();
  });
}

function openFormDialog(config) {
  return new Promise((resolve) => {
    editDialog.innerHTML = `
          <form class="dialog-form" method="dialog">
            <div class="dialog-head">
              <div>
                <h2 class="dialog-title">${escapeHtml(config.title)}</h2>
                <p class="dialog-subtitle">${escapeHtml(config.subtitle || "")}</p>
              </div>
              <button class="dialog-close" value="cancel" type="button" aria-label="关闭">${iconSvg("x")}</button>
            </div>
            <div class="form-grid">
              ${config.fields.map(renderField).join("")}
            </div>
            <div class="dialog-actions">
              <button class="btn" value="cancel" type="button">${iconSvg("x")}取消</button>
              <button class="btn primary" value="save" type="submit">${iconSvg("check")} ${escapeHtml(config.submitText || "保存")}</button>
            </div>
          </form>
        `;

    renderIcons();
    const form = editDialog.querySelector("form");
    const closeButtons = editDialog.querySelectorAll('[value="cancel"]');
    let settled = false;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      editDialog.close();
      editDialog.innerHTML = "";
      resolve(value);
    };

    closeButtons.forEach((button) =>
      button.addEventListener("click", () => finish(null)),
    );
    editDialog.addEventListener(
      "cancel",
      (event) => {
        event.preventDefault();
        finish(null);
      },
      { once: true },
    );
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const data = Object.fromEntries(new FormData(form).entries());
      finish(config.onSubmit(data));
    });

    editDialog.showModal();
    const firstInput = editDialog.querySelector("input, textarea, select");
    firstInput?.focus();
  });
}

function renderField(field) {
  const value = escapeAttr(field.value ?? "");
  const required = field.required ? "required" : "";
  if (field.type === "textarea") {
    return `
          <div class="field">
            <label for="field-${field.name}">${escapeHtml(field.label)}</label>
            <textarea id="field-${field.name}" name="${field.name}" placeholder="${escapeAttr(field.placeholder || "")}" ${required}>${escapeHtml(field.value || "")}</textarea>
          </div>
        `;
  }
  if (field.type === "select") {
    return `
          <div class="field">
            <label for="field-${field.name}">${escapeHtml(field.label)}</label>
            <select id="field-${field.name}" name="${field.name}" ${required}>
              ${field.options.map((option) => `<option value="${escapeAttr(option.value)}" ${String(option.value) === String(field.value) ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
            </select>
          </div>
        `;
  }
  return `
        <div class="field">
          <label for="field-${field.name}">${escapeHtml(field.label)}</label>
          <input id="field-${field.name}" name="${field.name}" type="${field.type}" value="${value}" placeholder="${escapeAttr(field.placeholder || "")}" ${required}>
        </div>
      `;
}

async function request(url, method, payload) {
  const options = { method, headers: {} };
  if (method && !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) {
    const password = adminPasswordInput.value.trim();
    if (!password) throw new Error("请输入管理密码后再修改");
    options.headers["X-Admin-Password"] = password;
  }

  if (payload) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(payload);
  }

  const response = await fetch(url, options);
  if (!response.ok) {
    const message = await readError(response);
    throw new Error(message);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function withLoading(message, task) {
  showLoading(message);
  try {
    return await task();
  } finally {
    hideLoading();
  }
}

function showLoading(message) {
  loadingCount += 1;
  loadingText.textContent = message || "正在处理，请稍候...";
  loadingOverlay.classList.add("active");
  document
    .querySelectorAll("button, input, select, textarea")
    .forEach((element) => {
      if (!element.closest("#loadingOverlay")) element.disabled = true;
    });
}

function hideLoading() {
  loadingCount = Math.max(0, loadingCount - 1);
  if (loadingCount > 0) return;

  loadingOverlay.classList.remove("active");
  document
    .querySelectorAll("button, input, select, textarea")
    .forEach((element) => {
      element.disabled = false;
    });
}

async function refresh() {
  navigationData = await loadNavigation();
  render(filterNavigation(siteSearchQuery));
  bindActiveCategory();
  updateBatchBar();
  renderIcons();
}

async function readError(response) {
  try {
    const data = await response.json();
    return data.detail || "接口返回异常";
  } catch {
    return "接口返回异常";
  }
}

function getItems(category) {
  return category.items || [];
}

function findCategory(categoryId) {
  return navigationData.find((category) => category.id === categoryId);
}

function findItem(itemId) {
  return navigationData.flatMap(getItems).find((item) => item.id === itemId);
}

function bindActiveCategory() {
  const links = [...document.querySelectorAll(".category-link")];
  links.forEach((link) => {
    link.addEventListener("click", () => {
      links.forEach((item) => item.classList.remove("active"));
      link.classList.add("active");
    });
  });
}

function getHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function getFaviconUrl(item) {
  if (!item?.id) return "";
  const version = encodeURIComponent(item.updated_at || item.url || "");
  return `/api/items/${encodeURIComponent(item.id)}/favicon?v=${version}`;
}

function handleIconError(image) {
  image.style.display = "none";
}

function iconSvg(name) {
  return `<i data-lucide="${name}"></i>`;
}

function renderIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>'"]/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[char],
  );
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
