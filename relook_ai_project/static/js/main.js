/* ═══════════════════════════════════════════════════════════════
   ReLook-AI — main.js
   Drag & Drop upload, API call, Image Comparison Slider
   ═══════════════════════════════════════════════════════════════ */
(function () {
    "use strict";

    // ─── DOM Elements ───────────────────────────────────────────
    const dropzone        = document.getElementById("dropzone");
    const fileInput       = document.getElementById("fileInput");
    const uploadCard      = document.getElementById("uploadCard");
    const previewArea     = document.getElementById("previewArea");
    const previewImage    = document.getElementById("previewImage");
    const previewFilename = document.getElementById("previewFilename");
    const btnColorize     = document.getElementById("btnColorize");
    const btnRemove       = document.getElementById("btnRemove");
    const loadingArea     = document.getElementById("loadingArea");
    const resultSection   = document.getElementById("result-section");
    const uploadSection   = document.getElementById("upload-section");
    const originalImg     = document.getElementById("originalImg");
    const colorizedImg    = document.getElementById("colorizedImg");
    const btnDownload     = document.getElementById("btnDownload");
    const btnRetry        = document.getElementById("btnRetry");
    const comparisonWrapper  = document.getElementById("comparisonWrapper");
    const comparisonOverlay  = document.getElementById("comparisonOverlay");
    const comparisonSlider   = document.getElementById("comparisonSlider");

    let selectedFile = null;

    // ─── Drag & Drop ────────────────────────────────────────────
    ["dragenter", "dragover"].forEach(function (evt) {
        dropzone.addEventListener(evt, function (e) {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add("drag-over");
        });
    });
    ["dragleave", "drop"].forEach(function (evt) {
        dropzone.addEventListener(evt, function (e) {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove("drag-over");
        });
    });
    dropzone.addEventListener("drop", function (e) {
        var files = e.dataTransfer.files;
        if (files.length > 0) handleFile(files[0]);
    });
    dropzone.addEventListener("click", function (e) {
        if (e.target.closest(".btn-choose") || e.target.closest("label")) return;
        fileInput.click();
    });
    fileInput.addEventListener("change", function () {
        if (fileInput.files.length > 0) handleFile(fileInput.files[0]);
    });

    // ─── Handle File Selection ──────────────────────────────────
    function handleFile(file) {
        var allowed = ["image/png", "image/jpeg", "image/bmp", "image/webp"];
        if (allowed.indexOf(file.type) === -1) {
            alert("Định dạng ảnh không được hỗ trợ.\nVui lòng dùng PNG, JPG, BMP hoặc WEBP.");
            return;
        }
        if (file.size > 16 * 1024 * 1024) {
            alert("File quá lớn! Vui lòng chọn ảnh dưới 16 MB.");
            return;
        }
        selectedFile = file;
        var reader = new FileReader();
        reader.onload = function (e) {
            previewImage.src = e.target.result;
            previewFilename.textContent = file.name;
            dropzone.classList.add("d-none");
            previewArea.classList.remove("d-none");
        };
        reader.readAsDataURL(file);
    }

    // ─── Remove / Cancel ────────────────────────────────────────
    btnRemove.addEventListener("click", resetUpload);

    function resetUpload() {
        selectedFile = null;
        fileInput.value = "";
        previewImage.src = "";
        previewFilename.textContent = "";
        previewArea.classList.add("d-none");
        loadingArea.classList.add("d-none");
        dropzone.classList.remove("d-none");
        resultSection.classList.add("d-none");
        uploadSection.classList.remove("d-none");
    }

    // ─── Colorize Button ────────────────────────────────────────
    btnColorize.addEventListener("click", function () {
        if (!selectedFile) return;
        // Show loading
        previewArea.classList.add("d-none");
        loadingArea.classList.remove("d-none");

        var formData = new FormData();
        formData.append("image", selectedFile);

        fetch("/colorize", { method: "POST", body: formData })
            .then(function (res) { return res.json(); })
            .then(function (data) {
                loadingArea.classList.add("d-none");
                if (data.error) {
                    alert("Lỗi: " + data.error);
                    resetUpload();
                    return;
                }
                showResult(data);
            })
            .catch(function (err) {
                loadingArea.classList.add("d-none");
                alert("Đã xảy ra lỗi kết nối. Vui lòng thử lại.");
                resetUpload();
            });
    });

    // ─── Show Result ────────────────────────────────────────────
    function showResult(data) {
        uploadSection.classList.add("d-none");
        resultSection.classList.remove("d-none");

        // Set image sources
        originalImg.src  = data.original;
        colorizedImg.src = data.colorized;
        btnDownload.href = data.download;

        // Wait for images to load then init slider
        var loaded = 0;
        function onImgLoad() {
            loaded++;
            if (loaded >= 2) {
                initSlider();
                resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }
        originalImg.onload  = onImgLoad;
        colorizedImg.onload = onImgLoad;

        // Fallback if images already cached
        if (originalImg.complete) { loaded++; }
        if (colorizedImg.complete) { loaded++; }
        if (loaded >= 2) {
            initSlider();
            resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }

    // ─── Image Comparison Slider ────────────────────────────────
    var sliderActive = false;

    function initSlider() {
        // Reset position to 50%
        setSliderPosition(50);

        // Set original image width to match container
        var wrapperWidth = comparisonWrapper.offsetWidth;
        originalImg.style.width = wrapperWidth + "px";
    }

    function setSliderPosition(percent) {
        percent = Math.max(0, Math.min(100, percent));
        comparisonOverlay.style.width = percent + "%";
        comparisonSlider.style.left   = percent + "%";

        // Keep original image width matching container
        var wrapperWidth = comparisonWrapper.offsetWidth;
        if (wrapperWidth > 0) {
            originalImg.style.width = wrapperWidth + "px";
        }
    }

    function getSliderPercent(e) {
        var rect = comparisonWrapper.getBoundingClientRect();
        var clientX = e.touches ? e.touches[0].clientX : e.clientX;
        return ((clientX - rect.left) / rect.width) * 100;
    }

    // Mouse events
    comparisonWrapper.addEventListener("mousedown", function (e) {
        e.preventDefault();
        sliderActive = true;
        setSliderPosition(getSliderPercent(e));
    });
    document.addEventListener("mousemove", function (e) {
        if (!sliderActive) return;
        setSliderPosition(getSliderPercent(e));
    });
    document.addEventListener("mouseup", function () {
        sliderActive = false;
    });

    // Touch events
    comparisonWrapper.addEventListener("touchstart", function (e) {
        sliderActive = true;
        setSliderPosition(getSliderPercent(e));
    }, { passive: true });
    document.addEventListener("touchmove", function (e) {
        if (!sliderActive) return;
        setSliderPosition(getSliderPercent(e));
    }, { passive: true });
    document.addEventListener("touchend", function () {
        sliderActive = false;
    });

    // Resize handler
    window.addEventListener("resize", function () {
        if (!resultSection.classList.contains("d-none")) {
            initSlider();
        }
    });

    // ─── Retry Button ───────────────────────────────────────────
    btnRetry.addEventListener("click", function () {
        resetUpload();
        uploadSection.scrollIntoView({ behavior: "smooth", block: "start" });
    });

})();
