---
title: ReLook AI Backend
emoji: 🎨
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
pinned: false
---

# ReLook AI Backend

Docker Space for the ReLook backend and image colorization model.

The public service runs on port `7860` and exposes:

- `GET /health`
- `POST /api/segment`
- `POST /api/payments/create`
- `GET /api/payments/status?orderId=...`
- `POST /api/payments/webhook`

The Flask model service runs internally on `127.0.0.1:5000/colorize`.

## Deploy to Hugging Face Spaces

1. Create a new Hugging Face Space.
2. Choose **Docker** as the Space SDK.
3. Push this `HF-Backend` folder as the root of the Space repository.
4. Add the model files with Git LFS because `colorization_release_v2.caffemodel` is large.

Required model files:

- `Model/models/colorization_deploy_v2.prototxt`
- `Model/models/colorization_release_v2.caffemodel`
- `Model/models/pts_in_hull.npy`

Example deploy commands from this folder:

```bash
git init
git lfs install
git add .
git commit -m "Deploy ReLook backend to Hugging Face Spaces"
git branch -M main
git remote add space https://huggingface.co/spaces/<your-user>/<your-space>
git push -u space main
```

Do not commit `backend/.env`. Add secrets in the Hugging Face Space settings instead.

Optional environment variables:

- `CORS_ORIGIN`
- `MODEL_WORKERS`
- `MODEL_TIMEOUT`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_API_BASE`
- `ZALOPAY_APP_ID`
- `ZALOPAY_KEY1`
- `ZALOPAY_ENDPOINT`
- `VIETQR_BANK_ID`
- `VIETQR_ACCOUNT_NO`
- `VIETQR_ACCOUNT_NAME`
