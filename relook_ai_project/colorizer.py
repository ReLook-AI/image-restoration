"""
colorizer.py — Module AI Colorization cho ReLook-AI.

Hỗ trợ 2 chế độ:
  - AI mode: Dùng model Zhang et al. (ECCV 2016) qua OpenCV DNN (yêu cầu tải model)
  - Fallback mode: Thuật toán warm-tone colorization chạy ngay, không cần tải model
"""

import os
import numpy as np
import cv2


class Colorizer:
    """Chuyển đổi ảnh trắng đen sang ảnh màu.

    Tự động dùng AI model nếu có, fallback về thuật toán warm-tone nếu chưa tải model.
    """

    PROTOTXT    = "colorization_deploy_v2.prototxt"
    CAFFEMODEL  = "colorization_release_v2.caffemodel"
    HULL_PTS    = "pts_in_hull.npy"
    MIN_CAFFE_SIZE = 100 * 1024 * 1024  # 100 MB — tránh nhận file HTML lỗi

    def __init__(self, model_dir: str = "models"):
        self.model_dir = model_dir
        self._net = None        # None = fallback mode
        self.mode = "fallback"  # "ai" hoặc "fallback"
        self._try_load_model()

    # ─── Load model (không raise, chỉ log) ────────────────────────
    def _try_load_model(self):
        prototxt_path    = os.path.join(self.model_dir, self.PROTOTXT)
        caffemodel_path  = os.path.join(self.model_dir, self.CAFFEMODEL)
        hull_path        = os.path.join(self.model_dir, self.HULL_PTS)

        # Kiểm tra đủ 3 file và kích thước hợp lệ
        for path in (prototxt_path, caffemodel_path, hull_path):
            if not os.path.isfile(path):
                print(f"[Colorizer] Model chưa sẵn sàng: {os.path.basename(path)} — dùng fallback mode.")
                return
        if os.path.getsize(caffemodel_path) < self.MIN_CAFFE_SIZE:
            size_kb = os.path.getsize(caffemodel_path) // 1024
            print(f"[Colorizer] caffemodel bị hỏng ({size_kb} KB, cần ~129 MB) — dùng fallback mode.")
            print("[Colorizer] Chạy: python download_models.py  để tải lại.")
            return

        try:
            pts = np.load(hull_path).transpose().reshape(2, 313, 1, 1)
            net = cv2.dnn.readNetFromCaffe(prototxt_path, caffemodel_path)
            class8 = net.getLayer(net.getLayerId("class8_ab"))
            class8.blobs = [pts.astype(np.float32)]
            conv8 = net.getLayer(net.getLayerId("conv8_313_rh"))
            conv8.blobs = [np.full([1, 313], 2.606, dtype=np.float32)]
            self._net  = net
            self.mode  = "ai"
            print("[Colorizer] AI model (Zhang et al.) đã sẵn sàng.")
        except Exception as e:
            print(f"[Colorizer] Không load được model: {e} — dùng fallback mode.")

    # ─── Public API ────────────────────────────────────────────────
    def colorize(self, input_path: str, output_path: str) -> str:
        img_bgr = cv2.imread(input_path)
        if img_bgr is None:
            raise ValueError(f"Không thể đọc ảnh: {input_path}")

        if self.mode == "ai":
            result = self._ai_colorize(img_bgr)
        else:
            result = self._fallback_colorize(img_bgr)

        cv2.imwrite(output_path, result)
        return output_path

    # ─── AI Colorization (Zhang et al.) ───────────────────────────
    def _ai_colorize(self, img_bgr: np.ndarray) -> np.ndarray:
        h, w = img_bgr.shape[:2]
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        img_lab = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2Lab)
        img_l   = img_lab[:, :, 0]

        l_resized = cv2.resize(img_l, (224, 224)) - 50.0
        self._net.setInput(cv2.dnn.blobFromImage(l_resized))
        ab_out = self._net.forward()[0, :, :, :].transpose(1, 2, 0)  # (56,56,2)
        ab_up  = cv2.resize(ab_out, (w, h))

        lab_out = np.zeros((h, w, 3), dtype=np.float32)
        lab_out[:, :, 0]  = img_l
        lab_out[:, :, 1:] = ab_up

        rgb_out = np.clip(cv2.cvtColor(lab_out, cv2.COLOR_Lab2RGB), 0, 1)
        return (cv2.cvtColor(rgb_out, cv2.COLOR_RGB2BGR) * 255).astype(np.uint8)

    # ─── Fallback: Warm-tone algorithmic colorization ─────────────
    def _fallback_colorize(self, img_bgr: np.ndarray) -> np.ndarray:
        """
        Không cần model. Áp dụng màu sắc dựa trên độ sáng (luminance):
          - Vùng tối  → tông xanh lạnh (shadows)
          - Vùng trung → tông ấm vàng/cam (midtones)
          - Vùng sáng  → tông kem/trắng ấm (highlights)
        Sau đó blend ngược với ảnh grayscale gốc để giữ chi tiết.
        """
        # Chuyển về grayscale → LAB
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape
        L_float = gray.astype(np.float32)          # [0, 255]
        L_norm  = L_float / 255.0                  # [0, 1]

        # Trọng số cho 3 vùng tông màu
        shadow    = np.clip(1.0 - L_norm * 3.0, 0, 1)          # tối
        midtone   = np.clip(1.0 - np.abs(L_norm - 0.45) * 3.5, 0, 1)  # trung
        highlight = np.clip((L_norm - 0.70) * 4.0, 0, 1)       # sáng

        # Kênh màu (BGR) cho từng vùng
        # Shadow: xanh lam lạnh (B+, G-, R-)
        b_s, g_s, r_s = 110.0, 80.0, 60.0
        # Midtone: vàng ấm (B-, G+, R++)
        b_m, g_m, r_m = 55.0,  115.0, 145.0
        # Highlight: kem trắng ấm (B+, G+, R+)
        b_h, g_h, r_h = 200.0, 210.0, 220.0

        B = shadow * b_s + midtone * b_m + highlight * b_h
        G = shadow * g_s + midtone * g_m + highlight * g_h
        R = shadow * r_s + midtone * r_m + highlight * r_h

        colored = np.stack([B, G, R], axis=2).astype(np.uint8)

        # Làm mượt màu để tránh banding
        colored = cv2.bilateralFilter(colored, 15, 75, 75)

        # Blend với ảnh gốc (giữ lại texture/chi tiết)
        gray_3ch  = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR).astype(np.float32)
        colored_f = colored.astype(np.float32)
        blend     = (colored_f * 0.65 + gray_3ch * 0.35).astype(np.uint8)

        return blend

