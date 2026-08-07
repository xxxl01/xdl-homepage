const list = document.querySelector("#transferList");
const editDialog = document.querySelector("#transferDialog");
const adminPasswordInput = document.querySelector("#adminPassword");
const loadingOverlay = document.querySelector("#loadingOverlay");
const loadingText = document.querySelector("#loadingText");
const ADMIN_PASSWORD_KEY = "xdl_homepage_admin_password";
let transferRecords = [];
let loadingCount = 0;

adminPasswordInput.value = localStorage.getItem(ADMIN_PASSWORD_KEY) || "";
init();
document.addEventListener("click", handleActionClick);
adminPasswordInput.addEventListener("input", () => {
  localStorage.setItem(ADMIN_PASSWORD_KEY, adminPasswordInput.value);
});
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
        <a class="btn" href="/api/transfers/${record.id}/download" title="下载">${iconSvg("download")}</a>
      `;

  return `
    <article class="transfer-card">
      <div class="transfer-icon">${iconSvg(iconName)}</div>
      <div class="transfer-body">
        <div class="transfer-name">${escapeHtml(name)}</div>
        <div class="transfer-meta">${escapeHtml(meta)}</div>
      </div>
      <div class="transfer-card-actions">
        ${actions}
        <button class="btn danger" type="button" data-action="delete" data-id="${record.id}" title="删除">${iconSvg("trash-2")}</button>
      </div>
    </article>
  `;
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
            <p class="dialog-subtitle">选择内容类型：文字直接记录，文件上传保存。</p>
          </div>
          <button class="dialog-close" value="cancel" type="button" aria-label="关闭">${iconSvg("x")}</button>
        </div>
        <div class="form-grid">
          <div class="field">
            <label>内容类型</label>
            <div class="mode-switch">
              <label class="mode-option"><input type="radio" name="mode" value="text" checked>${iconSvg("file-text")}文字记录</label>
              <label class="mode-option"><input type="radio" name="mode" value="file">${iconSvg("file-archive")}上传文件</label>
            </div>
          </div>
          <div class="field" data-mode-field="text">
            <label for="field-create-title">标题</label>
            <input id="field-create-title" name="title" type="text" placeholder="可选，用于列表识别">
          </div>
          <div class="field" data-mode-field="text">
            <label for="field-create-content">文字内容</label>
            <textarea id="field-create-content" name="content" placeholder="要传输的文字内容" required></textarea>
          </div>
          <div class="field" data-mode-field="file" hidden>
            <label for="field-create-file">选择文件</label>
            <input id="field-create-file" name="file" type="file">
            <p class="field-hint">单文件最大 500MB</p>
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
    const titleInput = form.querySelector("#field-create-title");
    const contentInput = form.querySelector("#field-create-content");
    const fileInput = form.querySelector("#field-create-file");
    let settled = false;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      editDialog.close();
      editDialog.innerHTML = "";
      resolve(value);
    };

    const switchMode = () => {
      const isText = form.querySelector('input[name="mode"]:checked').value === "text";
      form.querySelectorAll("[data-mode-field]").forEach((field) => {
        field.hidden = !(isText === (field.dataset.modeField === "text"));
      });
      if (isText) titleInput.focus();
    };

    form.querySelectorAll('input[name="mode"]').forEach((input) =>
      input.addEventListener("change", switchMode),
    );
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
      const isText = form.querySelector('input[name="mode"]:checked').value === "text";
      if (isText) {
        const content = contentInput.value.trim();
        if (!content) return;
        finish({ mode: "text", title: titleInput.value.trim() || null, content });
      } else {
        const file = fileInput.files?.[0];
        if (!file) return;
        finish({ mode: "file", title: titleInput.value.trim() || null, file });
      }
    });

    editDialog.showModal();
    titleInput.focus();
  });

  if (!result) return;

  await withLoading("正在保存...", async () => {
    if (result.mode === "text") {
      await request("/api/transfers/text", "POST", {
        title: result.title,
        content: result.content,
      });
    } else {
      const formData = new FormData();
      if (result.title) formData.append("title", result.title);
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
