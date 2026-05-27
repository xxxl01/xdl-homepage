function getMetaContent(selector) {
  const element = document.querySelector(selector);
  return element?.getAttribute("content")?.trim() || "";
}

function detectPageInfo() {
  const canonical = document.querySelector('link[rel="canonical"]')?.href || "";
  const description =
    getMetaContent('meta[name="description"]') ||
    getMetaContent('meta[property="og:description"]');
  const ogTitle = getMetaContent('meta[property="og:title"]');
  const icon =
    document.querySelector('link[rel="icon"]')?.href ||
    document.querySelector('link[rel="shortcut icon"]')?.href ||
    "";

  return {
    title: (ogTitle || document.title || "未命名页面").trim(),
    url: canonical || window.location.href,
    rawUrl: window.location.href,
    description,
    icon,
    detectedAt: new Date().toISOString()
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "DETECT_PAGE_INFO") {
    sendResponse({ ok: true, data: detectPageInfo() });
  }
});
