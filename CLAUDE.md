# 知识卡片生成器 — 项目规则

## UI 开发强制标准

以下规则在生成/修改任何 HTML/CSS/JS 时自动遵守：

### 1. 图标
禁止自绘 SVG、禁止使用 emoji 作为 UI 图标。所有图标从图标库调用：
```html
<img class="ico" src="/api/icons/{style}/{file}" alt="描述">
```
可用风格：`solid_glyph_enterprise_ui_svg`（纯色 Glyph · 48个）、`enterprise_3d_blue_svg`（3D 蓝色 · 48个）、`button_icons_svg_only`（按钮图标 · 60个）。
开发前先浏览 `http://localhost:8899/settings#icon` 选中合适的图标。

### 2. 颜色
只用 CSS 变量，禁止裸色值（`#xxx`、`rgb()`）。可用变量：`--bg`、`--surface`、`--text`、`--text2`、`--text3`、`--accent`、`--border`、`--border2`、`--danger`、`--success`、`--warning`。

### 3. 组件交互四态
每个交互元素必须覆盖：
- 默认（default）
- 悬停（hover）— 颜色偏移或背景变化
- 按下（active）— `transform: scale(0.97)` 或等效反馈
- 禁用（disabled）— 降低透明度，明确不可交互

### 4. 焦点指示器
全局 `:focus-visible` 必须可见：
```css
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
:focus:not(:focus-visible) { outline: none; }
```

### 5. 加载态
所有异步内容区域在 fetch 完成前，先渲染骨架屏（`.skeleton` shimmer），不显示空白区域。

### 6. 空状态
空状态必须包含操作入口（如"+ 新建"按钮），禁止只写"暂无数据"。

### 7. 触控目标
交互元素最小高度 ≥ 32px（桌面），移动端 ≥ 44px。

### 8. 对比度
文字与背景对比度 ≥ 4.5:1（WCAG AA）。`--text3` 已校准为 `#6b6b6b`（5.3:1），不得改回更浅的值。

---

## 技术栈

- 后端：Python Flask（`server.py`），端口 8899
- 前端：纯 HTML/CSS/JS，无框架
- 存储：JSON 文件（`cards-index.json`、`meta.json`、`settings.json`）
- 卡片渲染：iframe 嵌入独立 HTML 页面

## 启动

```bash
cd d:/Vscode/02项目/知识卡片生成器
python server.py
# → http://localhost:8899
```
