USE `xdl-homepage`;

INSERT INTO nav_categories (name, description, sort_order)
VALUES
('常用工具', '日常常用工具', 10),
('开发资源', '开发相关资源', 20),
('AI 工具', 'AI 相关工具', 30);

INSERT INTO nav_items (category_id, title, url, description, icon, sort_order)
VALUES
(1, 'GitHub', 'https://github.com', '代码托管平台', 'github', 10),
(1, 'Google', 'https://www.google.com', '搜索引擎', 'search', 20),
(2, 'FastAPI', 'https://fastapi.tiangolo.com', 'Python Web 框架', 'fastapi', 10),
(3, 'ChatGPT', 'https://chat.openai.com', 'AI 对话工具', 'bot', 10);
