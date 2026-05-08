# 🎨 ReLook-AI - Automated Image Restoration & Colorization Platform

Welcome to **ReLook-AI**! This is an advanced web application that utilizes artificial intelligence to restore and colorize black-and-white and old photos, bringing them back to life with vibrant, realistic colors.

![ReLook-AI Banner](https://via.placeholder.com/800x200/4F46E5/FFFFFF?text=ReLook-AI+Image+Colorization)

## ✨ Key Features

- **B&W Image Colorization**: Uses state-of-the-art AI models to automatically add natural colors to old or black-and-white photos.
- **Intuitive GUI**: A modern, user-friendly design featuring Drag & Drop functionality and an interactive before/after comparison slider.
- **Lightning Fast**: Powered by modern web technologies for a smooth, lag-free experience with instant feedback right in the browser.
- **Convenient Payments**: Built-in integrations with PayPal and VietQR for easy account upgrades and server sponsorships.

## 🛠️ Technology Stack

This project is built upon modern web technologies, ensuring high performance and scalability:
- **Frontend Framework**: [React 19](https://react.dev/) running on the blazing-fast [Vite](https://vitejs.dev/) bundler.
- **Styling**: [Bootstrap 5](https://getbootstrap.com/) combined with vanilla CSS for a beautiful, responsive layout on any device.
- **Routing**: [React Router v7](https://reactrouter.com/) for seamless page transitions without reloading.

## Project structure

```text
frontend/  React + Vite user interface
backend/   Node API for model inference and payment callbacks
```

## Supabase auth database

Create a Supabase project, then add these values to `frontend/.env`:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Run [backend/supabase-profiles.sql](backend/supabase-profiles.sql) in the Supabase SQL Editor to create `public.profiles` and automatically copy new Auth users into that profile table. Supabase Auth stores email/password users in `auth.users`; `public.profiles` stores app-level fields like first name and last name.

For Google login, enable Google in Supabase Authentication > Providers and add your local callback URL in Supabase Authentication > URL Configuration:

```text
http://localhost:5173/payment
```

## Payment API contract

The payment page calls `VITE_PAYMENT_API_URL` when it is set, otherwise it calls `http://localhost:8000/api/payments/create`. You can copy `frontend/.env.example` to `frontend/.env` when you want to override API URLs.

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

PayPal links, VietQR bank/API credentials, order verification, and payment callbacks must stay on the backend. Do not expose payment secrets in React.

## Model backend

Start the model backend from the project root:

```bash
npm run backend
```

The React app calls `http://localhost:8000/api/segment` by default. To connect a real model service, start the backend with `MODEL_ENDPOINT` pointing to your inference API:

```bash
MODEL_ENDPOINT=http://localhost:9000/predict npm run backend
```

On PowerShell:

```powershell
$env:MODEL_ENDPOINT='http://localhost:9000/predict'
npm run backend
```

The model service should accept JSON with `imageDataURL`, `modelId`, and `params`, then return one of these image fields:

```json
{
  "maskDataURL": "data:image/png;base64,...",
  "resolution": "256x256"
}
```

## 🚀 Getting Started

To view and run the web application locally on your machine, ensure that you have [Node.js](https://nodejs.org/) installed (LTS version recommended).

### Setup Instructions:

1. **Clone the repository**
   Open your terminal and run:
   ```bash
   git clone <repository-url>
   cd ui
   ```

2. **Install frontend dependencies**
   Frontend dependencies live in `frontend/`:
   ```bash
   cd frontend
   npm install
   cd ..
   ```
   *(This process will download all required NPM packages and may take a few moments)*

3. **Start the backend**
   Open one terminal from the project root:
   ```bash
   npm run backend
   ```

4. **Start the frontend**
   Open another terminal from the project root:
   ```bash
   npm run frontend
   ```

5. **Experience the app**
   Open your web browser and navigate to the local URL provided by your terminal (typically `http://localhost:5173/`).
   - *Explore the home page, try the image colorization feature in UNet Studio, and test the integrated payment flow.*

---
✨ *Thank you for checking out ReLook-AI! Let's bring those old photos back to life.*
---
title: ReLook AI
emoji: 🎨
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
pinned: false
---
