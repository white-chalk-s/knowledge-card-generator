"""知识百科平台 — Flask 服务器
启动后访问 http://localhost:8899
"""
import json
import shutil
from datetime import datetime
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

app = Flask(__name__, static_folder="output", static_url_path="")
OUTPUT = Path(__file__).parent / "output"
CARDS_DIR = OUTPUT / "cards"
INDEX_FILE = OUTPUT / "cards-index.json"
SETTINGS_FILE = OUTPUT / "settings.json"
QUEUE_FILE = OUTPUT / ".generate-queue.json"

CARDS_DIR.mkdir(parents=True, exist_ok=True)
for f in (INDEX_FILE, SETTINGS_FILE):
    if not f.exists():
        f.write_text("{}", encoding="utf-8")


def _read_json(path):
    try:
        return json.loads(path.read_text("utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), "utf-8")


# ── Page routes ──────────────────────────────────────────────

@app.route("/")
def index():
    return send_from_directory(str(OUTPUT), "index.html")


@app.route("/settings")
def settings_page():
    return send_from_directory(str(OUTPUT), "settings.html")


@app.route("/card/<card_id>")
def card_detail(card_id):
    card_dir = CARDS_DIR / card_id
    if card_dir.exists():
        return send_from_directory(str(card_dir), "index.html")
    return "卡片不存在", 404


@app.route("/card/<card_id>/<path:filename>")
def card_file(card_id, filename):
    card_dir = CARDS_DIR / card_id
    if card_dir.exists():
        return send_from_directory(str(card_dir), filename)
    return "文件不存在", 404


# ── Card API ─────────────────────────────────────────────────

@app.route("/api/cards", methods=["GET"])
def list_cards():
    data = _read_json(INDEX_FILE)
    cards = data.get("cards", {})
    q = request.args.get("q", "").lower()
    result = list(cards.values())
    if q:
        result = [c for c in result
                  if q in c.get("title", "").lower()
                  or any(q in t.lower() for t in c.get("tags", []))]
    result.sort(key=lambda c: c.get("updated_at", ""), reverse=True)
    return jsonify({"cards": result})


@app.route("/api/cards/<card_id>", methods=["GET"])
def get_card(card_id):
    meta_file = CARDS_DIR / card_id / "meta.json"
    if not meta_file.exists():
        return jsonify({"error": "not found"}), 404
    return jsonify(_read_json(meta_file))


@app.route("/api/cards/<card_id>", methods=["PUT"])
def update_card(card_id):
    """更新卡片元数据（标题、分类、标签）"""
    meta_file = CARDS_DIR / card_id / "meta.json"
    index = _read_json(INDEX_FILE)
    if not meta_file.exists() or card_id not in index.get("cards", {}):
        return jsonify({"error": "not found"}), 404

    data = request.get_json()
    meta = _read_json(meta_file)
    for field in ("title", "category", "tags", "accent_color"):
        if field in data:
            meta[field] = data[field]
    meta["updated_at"] = datetime.now().isoformat()

    # 同步更新索引
    card_entry = index["cards"][card_id]
    for field in ("title", "category", "tags", "accent_color"):
        if field in data:
            card_entry[field] = data[field]
    card_entry["updated_at"] = meta["updated_at"]

    _write_json(meta_file, meta)
    _write_json(INDEX_FILE, index)
    return jsonify({"ok": True})


@app.route("/api/cards/<card_id>", methods=["DELETE"])
def delete_card(card_id):
    """删除卡片（文件夹 + 索引条目）"""
    card_dir = CARDS_DIR / card_id
    index = _read_json(INDEX_FILE)
    if card_dir.exists():
        shutil.rmtree(card_dir)
    index.get("cards", {}).pop(card_id, None)
    _write_json(INDEX_FILE, index)
    return jsonify({"ok": True})


# ── Image API ────────────────────────────────────────────────

@app.route("/api/cards/<card_id>/images", methods=["GET"])
def list_images(card_id):
    meta = _read_json(CARDS_DIR / card_id / "meta.json")
    return jsonify({"images": meta.get("images", [])})


@app.route("/api/cards/<card_id>/images/upload", methods=["POST"])
def upload_image(card_id):
    """上传图片（替换已有 或 新增）"""
    meta_file = CARDS_DIR / card_id / "meta.json"
    if not meta_file.exists():
        return jsonify({"error": "not found"}), 404

    img_id = request.form.get("replace_image_id", "")
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "missing file"}), 400

    ext = Path(file.filename).suffix.lower()
    if ext not in (".png", ".jpg", ".jpeg", ".webp"):
        return jsonify({"error": "unsupported format"}), 400

    images_dir = CARDS_DIR / card_id / "images"
    images_dir.mkdir(parents=True, exist_ok=True)
    safe_name = file.filename.replace("\\", "/").split("/")[-1]
    file.save(str(images_dir / safe_name))

    meta = _read_json(meta_file)
    existing = next((img for img in meta.get("images", []) if img["id"] == img_id), None)

    if existing and not img_id.startswith("new_"):
        existing["ai_file"] = f"images/{safe_name}"
        existing["status"] = "ai-generated"
    else:
        new_id = f"img-{len(meta.get('images', []))+1}"
        meta.setdefault("images", []).append({
            "id": new_id,
            "original_url": f"/card/{card_id}/images/{safe_name}",
            "local_file": f"images/{safe_name}",
            "ai_file": None,
            "alt": file.filename.rsplit(".", 1)[0],
            "section": "new",
            "status": "external",
        })

    ai_count = sum(1 for img in meta.get("images", []) if img.get("status") == "ai-generated")
    meta["updated_at"] = datetime.now().isoformat()
    meta["image_count"] = len(meta.get("images", []))
    _write_json(meta_file, meta)

    index = _read_json(INDEX_FILE)
    if card_id in index.get("cards", {}):
        index["cards"][card_id]["ai_image_count"] = ai_count
        index["cards"][card_id]["image_count"] = meta["image_count"]
        index["cards"][card_id]["updated_at"] = meta["updated_at"]
        _write_json(INDEX_FILE, index)

    return jsonify({"ok": True, "filename": safe_name})


@app.route("/api/cards/<card_id>/images/<img_id>", methods=["DELETE"])
def delete_image(card_id, img_id):
    """彻底删除图片（从 meta.json 移除，删除文件）"""
    meta_file = CARDS_DIR / card_id / "meta.json"
    if not meta_file.exists():
        return jsonify({"error": "not found"}), 404

    meta = _read_json(meta_file)
    images = meta.get("images", [])
    removed = None
    for img in images:
        if img["id"] == img_id:
            removed = img
            break
    if removed:
        for field in ("ai_file", "local_file"):
            if removed.get(field):
                fp = CARDS_DIR / card_id / removed[field]
                if fp.exists():
                    fp.unlink()
        images.remove(removed)

    meta["image_count"] = len(images)
    meta["updated_at"] = datetime.now().isoformat()
    _write_json(meta_file, meta)

    index = _read_json(INDEX_FILE)
    if card_id in index.get("cards", {}):
        index["cards"][card_id]["image_count"] = len(images)
        index["cards"][card_id]["ai_image_count"] = sum(1 for img in images if img.get("status") == "ai-generated")
        index["cards"][card_id]["updated_at"] = meta["updated_at"]
        _write_json(INDEX_FILE, index)

    return jsonify({"ok": True})


# ── Template API ─────────────────────────────────────────────

TEMPLATE_DIR = Path(__file__).parent / "templates"


@app.route("/api/templates/<path:template_id>/preview", methods=["POST"])
def upload_template_preview(template_id):
    """上传/替换模板预览图"""
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "missing file"}), 400

    ext = Path(file.filename).suffix.lower()
    if ext not in (".png", ".jpg", ".jpeg", ".webp"):
        return jsonify({"error": "unsupported format"}), 400

    previews_dir = OUTPUT / "previews"
    previews_dir.mkdir(parents=True, exist_ok=True)
    safe_name = f"{template_id}{ext}"

    # Remove old preview with any extension
    for old in previews_dir.glob(f"{template_id}.*"):
        old.unlink()

    file.save(str(previews_dir / safe_name))

    # Update settings.json
    settings = _read_json(SETTINGS_FILE)
    for t in settings.get("templates", []):
        if t["id"] == template_id:
            t["preview"] = safe_name
            break
    _write_json(SETTINGS_FILE, settings)

    return jsonify({"ok": True, "filename": safe_name})


@app.route("/api/template-settings/<template_id>", methods=["DELETE"])
def delete_template(template_id):
    """从 settings.json 中移除模板条目"""
    settings = _read_json(SETTINGS_FILE)
    templates = settings.get("templates", [])
    settings["templates"] = [t for t in templates if t["id"] != template_id]
    if settings.get("default_template") == template_id and settings["templates"]:
        settings["default_template"] = settings["templates"][0]["id"]
    _write_json(SETTINGS_FILE, settings)
    return jsonify({"ok": True})


@app.route("/previews/<path:filename>")
def serve_preview(filename):
    """提供模板预览图"""
    previews_dir = OUTPUT / "previews"
    return send_from_directory(str(previews_dir), filename)


@app.route("/api/previews", methods=["GET"])
def list_previews():
    """列出所有预览图文件"""
    previews_dir = OUTPUT / "previews"
    files = []
    if previews_dir.exists():
        for f in sorted(previews_dir.iterdir()):
            if f.is_file() and f.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp"):
                files.append({"name": f.name, "stem": f.stem})
    return jsonify({"files": files})


@app.route("/api/templates/<path:filename>")
def get_template(filename):
    """返回模板 HTML 源码"""
    file_path = TEMPLATE_DIR / filename
    if file_path.exists() and file_path.suffix == ".html":
        return send_from_directory(str(TEMPLATE_DIR), filename)
    return "模板不存在", 404


# ── Icon API ─────────────────────────────────────────────────

ICONS_DIR = Path(__file__).parent / "icons"


@app.route("/api/icons", methods=["GET"])
def list_icons():
    """列出所有图标（支持嵌套目录）"""
    result = []
    if ICONS_DIR.exists():
        for style_dir in sorted(ICONS_DIR.iterdir()):
            if style_dir.is_dir():
                style_name = style_dir.name
                icons = []
                seen = set()
                for f in sorted(style_dir.rglob("*.svg")):
                    name = f.stem
                    if name in seen:
                        continue
                    seen.add(name)
                    rel = f.relative_to(ICONS_DIR)
                    icons.append({
                        "name": name,
                        "file": str(rel).replace("\\", "/"),
                        "style": style_name,
                    })
                if icons:
                    result.append({"style": style_name, "icons": icons})
    return jsonify({"styles": result})


@app.route("/api/icons/<path:filepath>")
def serve_icon(filepath):
    """返回单个 SVG 图标"""
    file_path = ICONS_DIR / filepath
    if file_path.exists() and file_path.suffix == ".svg":
        return send_from_directory(str(ICONS_DIR), filepath)
    return "图标不存在", 404


# ── Settings API ─────────────────────────────────────────────

@app.route("/api/settings", methods=["GET"])
def get_settings():
    return jsonify(_read_json(SETTINGS_FILE))


@app.route("/api/settings", methods=["PUT"])
def update_settings():
    current = _read_json(SETTINGS_FILE)
    data = request.get_json()
    current.update(data)
    _write_json(SETTINGS_FILE, current)
    return jsonify({"ok": True})


# ── Tags API ─────────────────────────────────────────────────

@app.route("/api/tags", methods=["GET"])
def list_tags():
    data = _read_json(INDEX_FILE)
    tags = set()
    for c in data.get("cards", {}).values():
        for t in c.get("tags", []):
            tags.add(t)
    return jsonify({"tags": sorted(tags)})


# ── Generate Queue API ───────────────────────────────────────

@app.route("/api/generate", methods=["POST"])
def queue_generate():
    """提交新卡片生成任务"""
    data = request.get_json()
    topic = data.get("topic", "").strip()
    if not topic:
        return jsonify({"error": "topic is required"}), 400

    queue = _read_json(QUEUE_FILE)
    task_id = datetime.now().strftime("%H%M%S")
    task = {
        "id": task_id,
        "topic": topic,
        "template": data.get("template", "产品介绍"),
        "status": "pending",
        "created_at": datetime.now().isoformat(),
    }
    queue[task_id] = task
    _write_json(QUEUE_FILE, queue)
    return jsonify({"ok": True, "id": task_id})


@app.route("/api/generate/queue", methods=["GET"])
def get_queue():
    queue = _read_json(QUEUE_FILE)
    return jsonify({"queue": list(queue.values())})


# ── Main ─────────────────────────────────────────────────────

if __name__ == "__main__":
    print(f"知识百科平台: http://localhost:8899")
    app.run(host="127.0.0.1", port=8899, debug=False)
