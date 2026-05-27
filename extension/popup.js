const API_BASE_KEY = "xdl_homepage_api_base";
const DEFAULT_API_BASE = "http://127.0.0.1:8100";
let saveApiBaseTimer = 0;

const elements = {
  apiBase: document.getElementById("apiBase"),
  title: document.getElementById("title"),
  url: document.getElementById("url"),
  description: document.getElementById("description"),
  categoryId: document.getElementById("categoryId"),
  categoryName: document.getElementById("categoryName"),
  categoryDescription: document.getElementById("categoryDescription"),
  status: document.getElementById("status"),
  refreshBtn: document.getElementById("refreshBtn"),
  loadCategoriesBtn: document.getElementById("loadCategoriesBtn"),
  addItemBtn: document.getElementById("addItemBtn"),
  addCategoryBtn: document.getElementById("addCategoryBtn")
};

function setStatus(message, type = "") {
  elements.status.textContent = message;
  elements.status.className = `status ${type}`.trim();
}

function getApiBase() {
  return elements.apiBase.value.trim().replace(/\/$/, "") || DEFAULT_API_BASE;
}

async function saveApiBase() {
  await chrome.storage.local.set({ [API_BASE_KEY]: getApiBase() });
}

function saveApiBaseSoon() {
  clearTimeout(saveApiBaseTimer);
  saveApiBaseTimer = setTimeout(async () => {
    await saveApiBase();
    setStatus("后端地址已自动保存。", "success");
  }, 300);
}

async function initApiBase() {
  const result = await chrome.storage.local.get(API_BASE_KEY);
  elements.apiBase.value = result[API_BASE_KEY] || DEFAULT_API_BASE;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function detectCurrentPage() {
  setStatus("正在检测当前页面……");

  const tab = await getActiveTab();
  if (!tab?.id) {
    setStatus("没有检测到当前标签页。", "error");
    return;
  }

  const fallbackData = {
    title: tab.title || "未命名页面",
    url: tab.url || "",
    description: "",
    icon: tab.favIconUrl || ""
  };

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "DETECT_PAGE_INFO" });
    fillSiteForm({ ...fallbackData, ...(response?.data || {}) });
    setStatus("已读取当前页面信息。", "success");
  } catch (_error) {
    fillSiteForm(fallbackData);
    setStatus("已使用标签页基础信息。", "success");
  }
}

function fillSiteForm(data) {
  elements.title.value = data.title || "";
  elements.url.value = data.url || "";
  elements.description.value = data.description || "";
}

async function loadCategories() {
  await saveApiBase();
  setStatus("正在加载分类……");
  setBusy(true);

  try {
    const categories = await request("/api/categories");
    renderCategories(categories);
    setStatus(`已加载 ${categories.length} 个分类。`, "success");
  } catch (error) {
    renderCategories([]);
    setStatus(`分类加载失败：${error.message}`, "error");
  } finally {
    setBusy(false);
  }
}

function renderCategories(categories) {
  elements.categoryId.innerHTML = "";

  if (categories.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "请先添加分类";
    elements.categoryId.appendChild(option);
    return;
  }

  for (const category of categories) {
    const option = document.createElement("option");
    option.value = String(category.id);
    option.textContent = category.name;
    elements.categoryId.appendChild(option);
  }
}

async function addCategory() {
  const name = elements.categoryName.value.trim();
  const description = elements.categoryDescription.value.trim();
  if (!name) {
    setStatus("分类名称不能为空。", "error");
    return;
  }

  setBusy(true);
  try {
    const category = await request("/api/categories", {
      method: "POST",
      body: {
        name,
        description: description || null,
        sort_order: 0
      }
    });
    elements.categoryName.value = "";
    elements.categoryDescription.value = "";
    await loadCategories();
    elements.categoryId.value = String(category.id);
    setStatus(`已添加分类：${category.name}`, "success");
  } catch (error) {
    setStatus(`添加分类失败：${error.message}`, "error");
  } finally {
    setBusy(false);
  }
}

async function addItem() {
  const payload = buildItemPayload();
  const error = validateItem(payload);
  if (error) {
    setStatus(error, "error");
    return;
  }

  setBusy(true);
  try {
    await request("/api/items", {
      method: "POST",
      body: payload
    });
    setStatus("网站已添加到导航。", "success");
  } catch (error) {
    setStatus(`添加网站失败：${error.message}`, "error");
  } finally {
    setBusy(false);
  }
}

function buildItemPayload() {
  return {
    category_id: Number(elements.categoryId.value),
    title: elements.title.value.trim(),
    url: elements.url.value.trim(),
    description: elements.description.value.trim() || null,
    icon: null,
    sort_order: 0
  };
}

function validateItem(item) {
  if (!item.category_id) return "请选择分类；没有分类时请先添加分类。";
  if (!item.title) return "标题不能为空。";
  if (!item.url) return "链接不能为空。";

  try {
    new URL(item.url);
  } catch (_error) {
    return "链接格式不正确。";
  }

  return "";
}

async function request(path, options = {}) {
  await saveApiBase();
  const init = { method: options.method || "GET", headers: {} };

  if (options.body) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${getApiBase()}${path}`, init);
  if (!response.ok) {
    throw new Error(await readError(response));
  }

  if (response.status === 204) return null;
  return response.json();
}

async function readError(response) {
  try {
    const data = await response.json();
    return data.detail || "接口返回异常";
  } catch (_error) {
    return "接口返回异常";
  }
}

function setBusy(isBusy) {
  elements.loadCategoriesBtn.disabled = isBusy;
  elements.addItemBtn.disabled = isBusy;
  elements.addCategoryBtn.disabled = isBusy;
}

elements.refreshBtn.addEventListener("click", detectCurrentPage);
elements.loadCategoriesBtn.addEventListener("click", loadCategories);
elements.addCategoryBtn.addEventListener("click", addCategory);
elements.addItemBtn.addEventListener("click", addItem);
elements.apiBase.addEventListener("input", saveApiBaseSoon);
elements.apiBase.addEventListener("change", loadCategories);

(async function init() {
  await initApiBase();
  await Promise.all([detectCurrentPage(), loadCategories()]);
})();
