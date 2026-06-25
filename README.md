# 知识卡片生成器

网页端知识内容展示工具。输入话题 → 深度研究 → HTML 模板渲染 → 精美图文卡片。

## 技术栈

Python Flask + 纯 HTML/CSS/JS，零数据库，JSON 文件存储。

## 功能

- **8 套模板**：产品介绍 / 极简报告 / 技术深度 / 杂志长文 / 农学家门户 / 通用门户线框 / 通用门户页面 / 粗黑招聘海报
- **双展示模式**：网页全屏 / 16:9 PPT / 4:3 PPT（CSS transform 等比缩放）
- **Stripe Docs 风格布局**：持久化左侧边栏 + 内容区居中，移动端自适应折叠
- **设置页**：模板预览与默认切换、卡片图片管理（上传/替换/删除）、图标库浏览与复制

## 快速开始

```bash
cd d:/Vscode/02项目/知识卡片生成器
pip install flask
python server.py
```

打开 `http://localhost:8899`

## 目录结构

```
知识卡片生成器/
├── server.py              # Flask 服务器（端口 8899）
├── templates/             # HTML 模板（8 套）
├── icons/                 # SVG 图标库
├── output/
│   ├── index.html         # 首页 shell（侧边栏 + iframe）
│   ├── settings.html      # 设置页（模板/图片/图标）
│   ├── app.css            # 全局样式
│   ├── app.js             # 全局脚本
│   ├── settings.json      # 模板注册表 + 默认设置
│   ├── cards-index.json   # 卡片索引
│   └── cards/             # 卡片文件（每张一个目录）
│       └── <id>/
│           ├── index.html # 卡片 HTML
│           └── meta.json  # 卡片元数据
└── 发给GPT-模板生成提示词.txt  # 模板生成规范
```

## 卡片生成流程

1. **选题** → 确定话题
2. **深研** → 全网搜索真实数据、研究、案例
3. **选模板** → 适合内容风格的 HTML 模板
4. **找图** → 每个内容板块匹配对应 Unsplash 实拍图
5. **生成** → 模板占位符替换 → `output/cards/<id>/index.html`
6. **注册** → 更新 `cards-index.json`，侧边栏即时可见

## 模板规范

模板是纯 HTML 线框，要求：

- 只定义 CSS 排版体系（字体层级、颜色系统、间距节奏、圆角阴影）
- 图片位用 `<div class="img-placeholder">` 占位，不画图标
- 内容用 `{{双大括号变量}}` 占位，命名唯一不重复
- 完整独立 HTML（`<style>` 内联），768px 响应式断点，不要 JS
