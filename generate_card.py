"""卡片生成器 — 从模板 + 内容数据生成卡片 HTML
用法: python generate_card.py <card_id>
从 output/cards/<card_id>/content.json 读取内容，套用指定模板。
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).parent
TEMPLATES_DIR = ROOT / "templates"
CARDS_DIR = ROOT / "output" / "cards"
INDEX_FILE = ROOT / "output" / "cards-index.json"
SETTINGS_FILE = ROOT / "output" / "settings.json"


def generate(card_id: str):
    content_file = CARDS_DIR / card_id / "content.json"
    if not content_file.exists():
        print(f"错误: 找不到 {content_file}")
        return False

    content = json.loads(content_file.read_text("utf-8"))
    template_id = content.get("template", "")

    # 查找模板文件
    settings = json.loads(SETTINGS_FILE.read_text("utf-8"))
    templates = settings.get("templates", [])
    tpl_info = next((t for t in templates if t["id"] == template_id), None)
    if not tpl_info:
        print(f"错误: 模板 '{template_id}' 不存在")
        return False

    tpl_path = TEMPLATES_DIR / tpl_info["file"]
    if not tpl_path.exists():
        print(f"错误: 模板文件 {tpl_path} 不存在")
        return False

    html = tpl_path.read_text("utf-8")

    # 替换所有占位符 {{变量名}}
    placeholders = content.get("placeholders", {})
    for key, value in placeholders.items():
        html = html.replace("{{" + key + "}}", str(value))

    # 输出
    card_dir = CARDS_DIR / card_id
    card_dir.mkdir(parents=True, exist_ok=True)
    output_path = card_dir / "index.html"
    output_path.write_text(html, "utf-8")

    # 更新 meta.json 时间戳
    meta_file = card_dir / "meta.json"
    if meta_file.exists():
        meta = json.loads(meta_file.read_text("utf-8"))
        from datetime import datetime
        meta["updated_at"] = datetime.now().isoformat()
        meta["template"] = template_id
        meta_file.write_text(json.dumps(meta, ensure_ascii=False, indent=2), "utf-8")

    print(f"OK: {output_path}")
    print(f"  模板: {template_id} ({tpl_info['file']})")
    print(f"  替换了 {len(placeholders)} 个占位符")
    return True


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python generate_card.py <card_id>")
        sys.exit(1)
    generate(sys.argv[1])
