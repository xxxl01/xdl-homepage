const list = document.querySelector("#transferList");
const editDialog = document.querySelector("#transferDialog");
const adminPasswordInput = document.querySelector("#adminPassword");
const readTokenInput = document.querySelector("#readToken");
const loadingOverlay = document.querySelector("#loadingOverlay");
const loadingText = document.querySelector("#loadingText");
const ADMIN_PASSWORD_KEY = "xdl_homepage_admin_password";
const READ_TOKEN_KEY = "xdl_homepage_read_token";
const shareSelectedBtn = document.querySelector("#shareSelectedBtn");
let transferRecords = [];
let loadingCount = 0;
const selectedRecordIds = new Set();

adminPasswordInput.value = localStorage.getItem(ADMIN_PASSWORD_KEY) || "";
readTokenInput.value = localStorage.getItem(READ_TOKEN_KEY) || "";
init();
document.addEventListener("click", handleActionClick);
adminPasswordInput.addEventListener("input", () => {
  localStorage.setItem(ADMIN_PASSWORD_KEY, adminPasswordInput.value);
});
readTokenInput.addEventListener("input", () => {
  localStorage.setItem(READ_TOKEN_KEY, readTokenInput.value.trim());
});
list.addEventListener("change", handleItemSelectionChange);
renderIcons();

async function init() {
  try {
    transferRecords = await request("/api/transfers");
    renderList();
  } catch (error) {
    console.error("传输记录加载失败：", error);
    list.innerHTML = `<div class="state">传输记录加载失败，请检查后端接口 /api/transfers</div>`;
  }
}

async function refresh() {
  transferRecords = await request("/api/transfers");
  renderList();
}

function renderList() {
  if (!transferRecords.length) {
    list.innerHTML = `<div class="state">暂无传输记录，点右上角「新增」写入第一条</div>`;
    return;
  }
  list.innerHTML = transferRecords.map(renderCard).join("");
  updateShareButton();
  renderIcons();
}

function renderCard(record) {
  const isText = record.kind === "text";
  const iconName = isText ? "file-text" : "file-archive";
  const name = isText
    ? record.title || "文字记录"
    : record.title || record.filename || "文件";
  const meta = isText
    ? `文字记录 · ${formatTime(record.created_at)}`
    : `${record.filename || ""} · ${formatSize(record.filesize)} · ${formatTime(record.created_at)}`;

  const actions = isText
    ? `
        <button class="btn" type="button" data-action="copy" data-id="${record.id}" title="复制全文">${iconSvg("copy")}</button>
        <button class="btn" type="button" data-action="edit" data-id="${record.id}" title="编辑">${iconSvg("pencil")}</button>
      `
    : `
        ${canPreview(record) ? `<button class="btn" type="button" data-action="preview" data-id="${record.id}" title="在线查看">${iconSvg("eye")}</button>` : ""}
        <a class="btn" href="${downloadUrl(record.id)}" title="下载">${iconSvg("download")}</a>
      `;

  return `
    <article class="transfer-card">
      <input class="transfer-check" type="checkbox" data-item-check="${record.id}" aria-label="选择 ${escapeAttr(name)}" ${selectedRecordIds.has(record.id) ? "checked" : ""}>
      <div class="transfer-icon">${iconSvg(iconName)}</div>
      <div class="transfer-body">
        <div class="transfer-name">${escapeHtml(name)}</div>
        <div class="transfer-meta">${escapeHtml(meta)}</div>
      </div>
      <div class="transfer-card-actions">
        <button class="btn" type="button" data-action="share" data-id="${record.id}" title="复制访问链接">${iconSvg("share-2")}</button>
        ${actions}
        <button class="btn danger" type="button" data-action="delete" data-id="${record.id}" title="删除">${iconSvg("trash-2")}</button>
      </div>
    </article>
  `;
}

function handleItemSelectionChange(event) {
  const checkbox = event.target.closest("[data-item-check]");
  if (!checkbox) return;

  const recordId = Number(checkbox.dataset.itemCheck);
  if (checkbox.checked) {
    selectedRecordIds.add(recordId);
  } else {
    selectedRecordIds.delete(recordId);
  }
  updateShareButton();
}

function updateShareButton() {
  const count = selectedRecordIds.size;
  shareSelectedBtn.disabled = count === 0;
  shareSelectedBtn.innerHTML = `${iconSvg("share-2")}分享选中${count ? ` (${count})` : ""}`;
  if (window.lucide) window.lucide.createIcons(shareSelectedBtn.closest(".transfer-actions"));
}

async function handleActionClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const action = button.dataset.action;
  const recordId = Number(button.dataset.id);

  try {
    if (action === "create") await openCreateDialog();
    if (action === "copy") await copyTransfer(recordId);
    if (action === "edit") await editTransfer(recordId);
    if (action === "preview") await previewTransfer(recordId);
    if (action === "share") await shareTransfer(recordId);
    if (action === "share-selected") await shareSelectedTransfers();
    if (action === "delete") await deleteTransfer(recordId);
  } catch (error) {
    console.error("操作失败：", error);
    await openMessageDialog({
      title: "操作失败",
      message: error.message,
      type: "error",
    });
  }
}

async function openCreateDialog() {
  const result = await new Promise((resolve) => {
    editDialog.innerHTML = `
      <form class="dialog-form" method="dialog">
        <div class="dialog-head">
          <div>
            <h2 class="dialog-title">新增传输记录</h2>
            <p class="dialog-subtitle">选择文件或输入文字，标题自动生成。</p>
          </div>
          <button class="dialog-close" value="cancel" type="button" aria-label="关闭">${iconSvg("x")}</button>
        </div>
        <div class="form-grid">
          <div class="field">
            <label for="field-create-file">选择文件</label>
            <input id="field-create-file" name="file" type="file">
            <p class="field-hint">选择文件则按文件传输，标题自动使用文件名；不选文件时按文字传输，标题自动截取内容</p>
          </div>
          <div class="field">
            <label for="field-create-content">文字内容</label>
            <textarea id="field-create-content" name="content" placeholder="输入要传输的文字（不选文件时必填）"></textarea>
          </div>
        </div>
        <div class="dialog-actions">
          <button class="btn" value="cancel" type="button">${iconSvg("x")}取消</button>
          <button class="btn primary" value="save" type="submit">${iconSvg("check")}保存</button>
        </div>
      </form>
    `;

    renderIcons();
    const form = editDialog.querySelector("form");
    const fileInput = form.querySelector("#field-create-file");
    const contentInput = form.querySelector("#field-create-content");
    let settled = false;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      editDialog.close();
      editDialog.innerHTML = "";
      resolve(value);
    };

    form.querySelectorAll('[value="cancel"]').forEach((button) =>
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
      const file = fileInput.files?.[0];
      const content = contentInput.value.trim();
      if (!file && !content) {
        contentInput.setCustomValidity("请选择文件或输入文字");
        contentInput.reportValidity();
        contentInput.setCustomValidity("");
        return;
      }
      if (file) {
        finish({ mode: "file", file });
      } else {
        finish({ mode: "text", content });
      }
    });

    editDialog.showModal();
    contentInput.focus();
  });

  if (!result) return;

  await withLoading("正在保存...", async () => {
    if (result.mode === "text") {
      await request("/api/transfers/text", "POST", {
        content: result.content,
      });
    } else {
      const formData = new FormData();
      formData.append("file", result.file);
      await request("/api/transfers/file", "POST", formData);
    }
    await refresh();
  });
}

async function editTransfer(recordId) {
  const record = await request(`/api/transfers/${recordId}`);
  if (record.kind !== "text") {
    await openMessageDialog({
      title: "无法编辑",
      message: "文件记录不支持编辑内容，如需修改请删除后重新上传。",
      type: "warning",
    });
    return;
  }

  const result = await new Promise((resolve) => {
    editDialog.innerHTML = `
      <form class="dialog-form" method="dialog">
        <div class="dialog-head">
          <div>
            <h2 class="dialog-title">编辑文字记录</h2>
            <p class="dialog-subtitle">修改后其他设备看到的是最新内容。</p>
          </div>
          <button class="dialog-close" value="cancel" type="button" aria-label="关闭">${iconSvg("x")}</button>
        </div>
        <div class="form-grid">
          <div class="field">
            <label for="field-edit-title">标题</label>
            <input id="field-edit-title" name="title" type="text" value="${escapeAttr(record.title || "")}" placeholder="可选，用于列表识别">
          </div>
          <div class="field">
            <label for="field-edit-content">文字内容</label>
            <textarea id="field-edit-content" name="content" required>${escapeHtml(record.content || "")}</textarea>
          </div>
        </div>
        <div class="dialog-actions">
          <button class="btn" value="cancel" type="button">${iconSvg("x")}取消</button>
          <button class="btn primary" value="save" type="submit">${iconSvg("check")}保存</button>
        </div>
      </form>
    `;

    renderIcons();
    const form = editDialog.querySelector("form");
    const titleInput = form.querySelector("#field-edit-title");
    const contentInput = form.querySelector("#field-edit-content");
    let settled = false;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      editDialog.close();
      editDialog.innerHTML = "";
      resolve(value);
    };

    form.querySelectorAll('[value="cancel"]').forEach((button) =>
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
      const content = contentInput.value.trim();
      if (!content) return;
      finish({ title: titleInput.value.trim() || null, content });
    });

    editDialog.showModal();
    titleInput.focus();
  });

  if (!result) return;

  await withLoading("正在保存...", async () => {
    await request(`/api/transfers/${recordId}`, "PATCH", result);
    await refresh();
  });
}

async function copyTransfer(recordId) {
  const record = await request(`/api/transfers/${recordId}`);
  const content = record.content || "";
  try {
    await navigator.clipboard.writeText(content);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = content;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
  await openMessageDialog({
    title: "已复制",
    message: content.length > 80 ? `${content.slice(0, 80)}...` : content,
    type: "success",
  });
}

function canPreview(record) {
  const name = record.filename || "";
  return /\.(md|markdown|txt)$/i.test(name);
}

function downloadUrl(recordId) {
  const token = readTokenInput.value.trim();
  return token
    ? `/api/transfers/${recordId}/download?token=${encodeURIComponent(token)}`
    : `/api/transfers/${recordId}/download`;
}

function shareUrl(record) {
  const token = readTokenInput.value.trim();
  const tokenSuffix = token ? `?token=${encodeURIComponent(token)}` : "";
  const origin = window.location.origin;
  if (record.kind === "text") {
    return `${origin}/api/transfers/${record.id}${tokenSuffix}`;
  }
  if (canPreview(record)) {
    return `${origin}/api/transfers/${record.id}/preview${tokenSuffix}`;
  }
  return `${origin}${downloadUrl(record.id)}`;
}

async function shareTransfer(recordId) {
  const record = transferRecords.find((item) => item.id === recordId);
  if (!record) return;
  await copyToClipboard(shareUrl(record));
  await openMessageDialog({
    title: "已复制访问链接",
    message: shareUrl(record),
    type: "success",
  });
}

async function shareSelectedTransfers() {
  const records = transferRecords.filter((record) => selectedRecordIds.has(record.id));
  if (!records.length) return;
  const urls = records.map(shareUrl).join("\n");
  await copyToClipboard(urls);
  await openMessageDialog({
    title: `已复制 ${records.length} 条访问链接`,
    message: urls,
    type: "success",
  });
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
}

async function previewTransfer(recordId) {
  const result = await withLoading("正在加载文件内容...", () =>
    request(`/api/transfers/${recordId}/preview`),
  );
  const isMarkdown = /\.(md|markdown)$/i.test(result.filename);
  const html = isMarkdown && window.marked
    ? window.marked.parse(result.content)
    : escapeHtml(result.content).replace(/\n/g, "<br>");

  editDialog.innerHTML = `
    <div class="dialog-form preview-dialog">
      <div class="dialog-head">
        <div class="preview-title-wrap">
          <h2 class="dialog-title">${escapeHtml(result.filename)}</h2>
          <p class="dialog-subtitle">${isMarkdown ? "Markdown 渲染预览" : "纯文本预览"}</p>
        </div>
        <button class="dialog-close" type="button" data-preview-close aria-label="关闭">${iconSvg("x")}</button>
      </div>
      <div class="preview-body">${html}</div>
      <div class="dialog-actions">
        <a class="btn primary" href="${downloadUrl(recordId)}">${iconSvg("download")}下载</a>
        <button class="btn" type="button" data-preview-close>${iconSvg("x")}关闭</button>
      </div>
    </div>
  `;
  renderIcons();

  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    editDialog.close();
    editDialog.innerHTML = "";
  };

  editDialog.querySelectorAll("[data-preview-close]").forEach((button) => {
    button.addEventListener("click", finish);
  });
  editDialog.addEventListener(
    "cancel",
    (event) => {
      event.preventDefault();
      finish();
    },
    { once: true },
  );

  editDialog.showModal();
}

async function deleteTransfer(recordId) {
  const record = transferRecords.find((item) => item.id === recordId);
  const name = record?.title || record?.filename || "该记录";
  const confirmed = await openMessageDialog({
    title: "确认删除",
    message: `确认删除「${name}」？删除后无法恢复，文件记录会同时删除已上传的文件。`,
    type: "confirm",
    confirmText: "删除",
    cancelText: "取消",
  });
  if (!confirmed) return;

  await withLoading("正在删除...", async () => {
    await request(`/api/transfers/${recordId}`, "DELETE");
    await refresh();
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

async function request(url, method, payload) {
  const options = { method, headers: {} };
  if (method && !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) {
    const password = adminPasswordInput.value.trim();
    if (!password) throw new Error("请输入管理密码后再修改");
    options.headers["X-Admin-Password"] = password;
  } else {
    const token = readTokenInput.value.trim();
    if (token) options.headers["X-Read-Token"] = token;
  }

  if (payload instanceof FormData) {
    options.body = payload;
  } else if (payload) {
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

async function readError(response) {
  try {
    const data = await response.json();
    return data.detail || "接口返回异常";
  } catch {
    return "接口返回异常";
  }
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

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (num) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatSize(bytes) {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
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
