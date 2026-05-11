"""
download_models.py — Script tự động tải pre-trained model cho ReLook-AI.
Chạy: python download_models.py
"""

import os
import shutil
import urllib.request

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODEL_DIR, exist_ok=True)

# Kích thước tối thiểu mong đợi (bytes)
FILE_MIN_SIZES = {
    "colorization_deploy_v2.prototxt": 5_000,
    "colorization_release_v2.caffemodel": 100 * 1024 * 1024,  # ~129 MB
    "pts_in_hull.npy": 5_000,
}

# Các URL thay thế cho caffemodel (theo thứ tự ưu tiên)
FILE_URLS = {
    "colorization_deploy_v2.prototxt": [
        "https://raw.githubusercontent.com/richzhang/colorization/caffe/colorization/models/colorization_deploy_v2.prototxt",
    ],
    "colorization_release_v2.caffemodel": [
        "http://eecs.berkeley.edu/~rich.zhang/projects/2016_colorization/files/demo_v2/colorization_release_v2.caffemodel",
        "https://www.dropbox.com/s/dx0qvber5cejhtf/colorization_release_v2.caffemodel?dl=1",
    ],
    "pts_in_hull.npy": [
        "https://github.com/richzhang/colorization/raw/caffe/colorization/resources/pts_in_hull.npy",
    ],
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ReLook-AI/1.0",
}


def download_file(filename: str) -> bool:
    dest = os.path.join(MODEL_DIR, filename)
    min_size = FILE_MIN_SIZES.get(filename, 0)

    # Kiểm tra file đã tồn tại và hợp lệ
    if os.path.exists(dest):
        actual_size = os.path.getsize(dest)
        if actual_size >= min_size:
            print(f"  [OK] Đã tồn tại: {filename} ({actual_size / 1024 / 1024:.1f} MB)")
            return True
        else:
            print(f"  [!]  File bị hỏng ({actual_size / 1024:.0f} KB) — đang tải lại...")
            os.remove(dest)

    urls = FILE_URLS.get(filename, [])
    for i, url in enumerate(urls):
        print(f"  Đang tải [{i+1}/{len(urls)}]: {filename}")
        print(f"            URL: {url}")
        tmp = dest + ".tmp"
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=120) as resp, open(tmp, "wb") as f:
                total = int(resp.headers.get("Content-Length", 0))
                downloaded = 0
                block = 1024 * 256  # 256 KB chunks
                while True:
                    chunk = resp.read(block)
                    if not chunk:
                        break
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total > 0:
                        pct = downloaded * 100 // total
                        print(f"\r    {pct}% ({downloaded/1024/1024:.1f}/{total/1024/1024:.1f} MB)",
                              end="", flush=True)
            print()

            actual_size = os.path.getsize(tmp)
            if actual_size < min_size:
                os.remove(tmp)
                print(f"  [X]  Kích thước không hợp lệ: {actual_size/1024:.0f} KB (cần ≥{min_size//1024//1024} MB). Thử URL tiếp theo...")
                continue

            shutil.move(tmp, dest)
            print(f"  [OK] Hoàn tất: {filename} ({actual_size/1024/1024:.1f} MB)")
            return True

        except Exception as e:
            if os.path.exists(tmp):
                os.remove(tmp)
            print(f"  [X]  Lỗi: {e}")
            if i + 1 < len(urls):
                print("       Đang thử URL dự phòng...")

    return False


MANUAL_INSTRUCTIONS = """
╔══════════════════════════════════════════════════════════════╗
║          HƯỚNG DẪN TẢI THỦ CÔNG CAFFEMODEL                 ║
╠══════════════════════════════════════════════════════════════╣
║  File cần tải: colorization_release_v2.caffemodel (~129 MB) ║
║                                                              ║
║  Cách 1 — PowerShell:                                       ║
║    Invoke-WebRequest `                                       ║
║      -Uri "http://eecs.berkeley.edu/~rich.zhang/projects/    ║
║            2016_colorization/files/demo_v2/                  ║
║            colorization_release_v2.caffemodel" `            ║
║      -OutFile "models\colorization_release_v2.caffemodel"   ║
║                                                              ║
║  Cách 2 — curl (nếu đã cài):                                ║
║    curl -L -o models/colorization_release_v2.caffemodel \   ║
║      "http://eecs.berkeley.edu/~rich.zhang/projects/         ║
║       2016_colorization/files/demo_v2/                       ║
║       colorization_release_v2.caffemodel"                   ║
║                                                              ║
║  Sau khi tải xong, chạy lại: python download_models.py      ║
╚══════════════════════════════════════════════════════════════╝
"""


def main():
    print("=" * 62)
    print("  ReLook-AI — Tải Pre-trained Colorization Model")
    print("  (Zhang et al., ECCV 2016)")
    print("=" * 62)
    all_ok = True
    for filename in FILE_URLS:
        success = download_file(filename)
        if not success:
            all_ok = False
            if "caffemodel" in filename:
                print(MANUAL_INSTRUCTIONS)

    print()
    if all_ok:
        print("✓ Tất cả model đã sẵn sàng!")
        print("  Chạy server: python app.py")
    else:
        print("✗ Có file tải thất bại. Xem hướng dẫn thủ công ở trên.")


if __name__ == "__main__":
    main()
