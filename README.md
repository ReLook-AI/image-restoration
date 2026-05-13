# 🎨 ReLook-AI - Automated Image Restoration & Colorization Platform

Welcome to **ReLook-AI**! This is an AI-powered web application for restoring, enhancing, colorizing, and restyling images. It helps bring old, low-quality, black-and-white, or damaged photos back to life with a modern web interface, user accounts, payment flows, and an extensible backend for real AI model services.

![ReLook-AI Banner](https://via.placeholder.com/800x200/4F46E5/FFFFFF?text=ReLook-AI+Image+Restoration)

## ✨ Key Features

- **B&W Image Colorization**: Connect your own AI model backend to colorize or restore old black-and-white photos.
- **HD Image Enhancement**: Improve clarity, sharpness, detail, contrast, and overall image quality through the Gemini image enhancement endpoint.
- **AI Style Editing**: Use prompt-based Gemini editing to restyle uploaded images while preserving the main subject and composition.
- **Intuitive Studio UI**: Modern React interface with image upload, preview, result display, and AI controls.
- **Supabase Authentication**: Email/password and optional Google login with user profile syncing.
- **Image History Support**: Supabase SQL scripts are included for storing restored image history and storage policies.
- **Admin Dashboard**: Role-based admin access through Supabase profiles.
- **Account Management**: Backend support for deleting user account data and Supabase Auth users.
- **Convenient Payments**: Backend payment flow with PayPal and VietQR adapters for plan upgrades and sponsorship/payment use cases.
- **Deployment Ready Backend**: Node.js backend supports local demo mode, external model forwarding, Gemini image editing, payment callbacks, and health checks.

## 🛠️ Technology Stack

This project is built with modern web technologies for fast development and scalable deployment:

- **Frontend Framework**: [React 19](https://react.dev/) with [Vite](https://vitejs.dev/).
- **Routing**: [React Router v7](https://reactrouter.com/).
- **Styling**: [Bootstrap 5](https://getbootstrap.com/), React Bootstrap, Bootstrap Icons, and custom CSS.
- **Backend**: Node.js HTTP server with Busboy for secure image upload parsing.
- **Authentication & Database**: Supabase Auth, database tables, storage policies, and service-role backend operations.
- **AI Image Editing**: Gemini Image API through a protected backend endpoint.
- **Payments**: PayPal and VietQR backend adapters.
- **Model Integration**: External inference service support through `MODEL_ENDPOINT`.

## Project Structure

```text
frontend/              React + Vite user interface
  public/              Static assets
  src/
    components/        Shared UI components
    features/          Feature-specific logic
      payment/         Payment plans and order summary UI
      unet/            AI studio constants and model API client
    pages/             Route-level pages
    services/          API config, Supabase client, account/payment clients

backend/               Node API for model inference, Gemini enhance, payments, account deletion
  payments/            Payment service, webhook handler, PayPal and VietQR adapters
  supabase-*.sql       Supabase database setup scripts

Model/                 Local Flask model service and model artifacts
HF-Backend/            Hugging Face deployment copy/artifacts
docs/                  Extra project documentation
```

For a more detailed map, see [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md).

## Supabase Auth Database

Create a Supabase project, then add these values to `frontend/.env`:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Run these SQL files in the Supabase SQL Editor:

```text
backend/supabase-profiles.sql
backend/supabase-image-history.sql
backend/supabase-admin.sql
```

What they do:

- `supabase-profiles.sql` creates `public.profiles` and automatically copies new Supabase Auth users into that profile table.
- `supabase-image-history.sql` creates image history/storage-related tables and policies.
- `supabase-admin.sql` adds admin-role support for the admin dashboard.

To promote one user to admin:

```sql
update public.profiles
set role = 'admin'
where email = 'your-admin-email@example.com';
```

After that account signs in, the `/admin` route becomes available.

For Google login, enable Google in Supabase Authentication > Providers and add your local callback URL in Supabase Authentication > URL Configuration:

```text
http://localhost:5173/payment
```

## Environment Variables

### Frontend

Create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_MODEL_API_URL=http://localhost:8000/api/segment
VITE_IMAGE_ENHANCE_API_URL=http://localhost:8000/api/image/enhance
VITE_PAYMENT_API_URL=http://localhost:8000/api/payments/create

VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

If `VITE_API_BASE_URL` is not set, the frontend uses the default deployed backend URL configured in `frontend/src/services/apiConfig.js`.

### Backend

Create `backend/.env`:

```env
PORT=8000
CORS_ORIGIN=http://localhost:5173

MODEL_ENDPOINT=http://localhost:9000/predict

GEMINI_API_KEY=your-gemini-api-key
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image

SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

Notes:

- `MODEL_ENDPOINT` is optional. If it is not configured, `/api/segment` returns a demo response.
- `GEMINI_API_KEY` is required for `/api/image/enhance`.
- `SUPABASE_SERVICE_ROLE_KEY` is required for protected backend account deletion.
- Never expose service-role keys, payment secrets, or Gemini API keys in React.

## Payment API Contract

The payment page calls `VITE_PAYMENT_API_URL` when it is set. Otherwise, it calls:

```text
http://localhost:8000/api/payments/create
```

Request body:

```json
{
  "provider": "paypal | qr",
  "planId": "pro",
  "planName": "Professional",
  "amount": 16.72,
  "currency": "USD",
  "promoCode": "RELOOK20",
  "returnUrl": "http://localhost:5173/payment"
}
```

Expected response:

```json
{
  "redirectUrl": "https://payment-gateway.example/checkout",
  "qrCodeUrl": "https://payment-gateway.example/qr.png",
  "qrCode": "000201...",
  "status": "pending"
}
```

Payment links, VietQR bank/API credentials, PayPal keys, order verification, and payment callbacks must stay on the backend. Do not expose payment secrets in React.

## Model Backend

Start the Node backend from the project root:

```bash
npm run backend
```

The React app calls `/api/segment` for model inference. To connect a real model service, start the backend with `MODEL_ENDPOINT` pointing to your inference API:

```bash
MODEL_ENDPOINT=http://localhost:9000/predict npm run backend
```

On PowerShell:

```powershell
$env:MODEL_ENDPOINT='http://localhost:9000/predict'
npm run backend
```

The model service should accept JSON with `imageDataURL`, `modelId`, and `params`, then return an image field such as:

```json
{
  "maskDataURL": "data:image/png;base64,...",
  "resolution": "256x256"
}
```

If `MODEL_ENDPOINT` ends with `/colorize`, the backend sends the uploaded image as multipart form data and expects a colorized image path in the response.

## Gemini Image Enhance API

The frontend calls:

```text
POST /api/image/enhance
```

This endpoint accepts multipart form data:

```text
image: PNG, JPEG, or WebP file
mode: hd | style
prompt: optional text prompt
```

Supported modes:

- `hd`: Enhances image quality, sharpness, details, contrast, and noise reduction.
- `style`: Applies prompt-based image editing. A prompt is required in this mode.

The backend validates image type/signature and limits uploads to 10MB.

## Backend API Routes

```http
GET /health
POST /api/segment
POST /api/image/enhance
POST /api/payments/create
GET /api/payments/status?orderId=<order-id>
POST /api/payments/webhook
DELETE /api/account
```

`DELETE /api/account` requires:

```http
Authorization: Bearer <supabase-access-token>
```

## 🚀 Getting Started

To view and run the web application locally, make sure [Node.js](https://nodejs.org/) LTS is installed.

### Setup Instructions

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd UI
   ```

2. **Install frontend dependencies**

   ```bash
   npm --prefix frontend install
   ```

3. **Install backend dependencies**

   ```bash
   npm --prefix backend install
   ```

4. **Start the backend**

   Open one terminal from the project root:

   ```bash
   npm run backend
   ```

5. **Start the frontend**

   Open another terminal from the project root:

   ```bash
   npm run frontend
   ```

6. **Experience the app**

   Open your browser and navigate to:

   ```text
   http://localhost:5173/
   ```

   Explore the home page, sign in, try the AI studio at `/app`, test image enhancement, and review the payment flow.

## Available Scripts

```bash
npm run frontend       # Start React/Vite dev server
npm run backend        # Start Node backend
npm run build          # Build frontend
npm run lint           # Lint frontend
npm run check:backend  # Check backend syntax
npm run model          # Start local model service
```

## Deployment

Build the frontend:

```bash
npm run build
```

The build output is generated in:

```text
frontend/dist
```

Start the backend in production mode:

```bash
npm --prefix backend run start
```

When deploying, configure frontend and backend environment variables for your production domain, Supabase project, payment providers, model service, and Gemini API key.

---

✨ *Thank you for checking out ReLook-AI! Let's restore memories and bring old photos back to life.*
