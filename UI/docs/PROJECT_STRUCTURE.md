# Project Structure

Use this as the quick map when you need to find a file.

```text
UI/
  backend/              Node API for inference proxy and payments
    payments/           Payment order, status, webhook, and adapters

  frontend/             React + Vite web app
    public/             Static public assets
    src/
      components/       Shared UI components used across pages
      features/         Feature-specific helpers and components
        payment/        Payment plans and order summary UI
        unet/           AI studio constants and model API client
      pages/            Route-level pages only
      services/         API, Supabase, and external service clients

  Model/                Local Flask model service and model artifacts
  HF-Backend/           Hugging Face deployment copy/artifacts
```

Most edits should start in one of these places:

- Web screens: `frontend/src/pages`
- Reusable UI: `frontend/src/components`
- Payment UI/helpers: `frontend/src/features/payment`
- AI studio helpers/API: `frontend/src/features/unet`
- Browser API config: `frontend/src/services`
- Node backend API: `backend`
