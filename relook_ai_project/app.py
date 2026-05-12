import os
import uuid
from flask import Flask, render_template, request, jsonify, send_from_directory
from colorizer import Colorizer

app = Flask(__name__)

# ─── Cấu hình ───────────────────────────────────────────────────────────────
UPLOAD_FOLDER = os.path.join(app.static_folder, "uploads")
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "bmp", "webp"}
MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ─── Khởi tạo AI Colorizer (Lazy loading) ─────────────────────────────────
MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
_colorizer = None


def get_colorizer() -> Colorizer:
    """Trả về Colorizer instance, khởi tạo lần đầu khi cần (lazy load model)."""
    global _colorizer
    if _colorizer is None:
        _colorizer = Colorizer(model_dir=MODEL_DIR)
    return _colorizer


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def secure_unique_filename(filename: str) -> str:
    """Tạo tên file an toàn, duy nhất để tránh trùng lặp và path traversal."""
    ext = filename.rsplit(".", 1)[1].lower() if "." in filename else "png"
    if ext not in ALLOWED_EXTENSIONS:
        ext = "png"
    return f"{uuid.uuid4().hex}.{ext}"


# ─── Routes ──────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/colorize", methods=["POST"])
def colorize():
    """Nhận ảnh upload, xử lý AI colorization, trả về đường dẫn ảnh kết quả."""
    if "image" not in request.files:
        return jsonify({"error": "Không tìm thấy file ảnh."}), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "Chưa chọn file ảnh."}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "Định dạng ảnh không được hỗ trợ. Vui lòng dùng PNG, JPG, BMP hoặc WEBP."}), 400

    # Lưu file gốc
    original_name = secure_unique_filename(file.filename)
    original_path = os.path.join(app.config["UPLOAD_FOLDER"], original_name)
    file.save(original_path)

    # Chạy AI Colorization
    try:
        result_name = f"color_{original_name}"
        result_path = os.path.join(app.config["UPLOAD_FOLDER"], result_name)
        get_colorizer().colorize(original_path, result_path)
    except Exception as e:
        # Xóa file gốc nếu xử lý thất bại
        if os.path.exists(original_path):
            os.remove(original_path)
        return jsonify({"error": f"Lỗi khi xử lý ảnh: {str(e)}"}), 500

    return jsonify({
        "original":   f"/static/uploads/{original_name}",
        "colorized":  f"/static/uploads/{result_name}",
        "download":   f"/download/{result_name}",
        "mode":       get_colorizer().mode,
    })


@app.route("/download/<filename>")
def download(filename):
    """Cho phép tải ảnh kết quả về máy."""
    # Chỉ cho phép tải file trong thư mục uploads, chống path traversal
    safe_name = os.path.basename(filename)
    return send_from_directory(
        app.config["UPLOAD_FOLDER"],
        safe_name,
        as_attachment=True,
        download_name=f"ReLook-AI_{safe_name}",
    )


# ─── Chạy Server ────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
