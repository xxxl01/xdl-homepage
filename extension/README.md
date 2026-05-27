# XDL 导航采集助手 MVP

这是一个可演示的 Chrome 插件 MVP，用来采集当前网页的标题、链接、描述，并先暂存到浏览器本地。后续可以把“模拟写入后端”替换成真实接口请求。

## 功能

- 自动检测当前标签页标题和链接
- 尝试读取 `canonical` 链接、`description`、`og:title`、站点图标
- 支持手动修改标题、链接、描述、分类
- 支持暂存到 `chrome.storage.local`
- 支持复制 JSON，便于调试后端字段
- 支持模拟写入后端，在 console 中查看 payload

## 本地安装

1. 打开 Chrome 地址栏：`chrome://extensions/`
2. 打开右上角“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择当前目录：`D:\Decument\git\xdl-homepage`
5. 打开任意网页，点击浏览器右上角插件图标即可演示

## 后续接入后端的位置

后续主要修改 `popup.js` 里的 `mockSubmit()` 函数，例如：

```js
async function submitToBackend() {
  const item = buildItem();
  const error = validateItem(item);
  if (error) {
    setStatus(error, "error");
    return;
  }

  const response = await fetch("https://你的后端域名/api/nav-items", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(item)
  });

  if (!response.ok) {
    setStatus("写入后端失败。", "error");
    return;
  }

  setStatus("已写入后端。", "success");
}
```

如果要请求后端域名，还需要在 `manifest.json` 增加对应权限：

```json
{
  "host_permissions": ["https://你的后端域名/*"]
}
```
