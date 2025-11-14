# Deployment Guide

This guide explains how to deploy the Personal Productivity App to production.

## Architecture

- **Frontend**: React + Vite + TypeScript (deployed on Vercel)
- **Backend**: FastAPI + Python (deployed on Render)
- **Database**: SQLite (development) / PostgreSQL (production)

## Prerequisites

- GitHub account
- Vercel account (free tier available)
- Render account (free tier available)

## Backend Deployment (Render)

### Option 1: Using Dashboard (Recommended)

1. **Create a new Web Service**
   - Go to [Render](https://render.com/)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select your `personalApp` repository

2. **Configure service settings**
   - Name: `personalapp-backend`
   - Region: Choose closest to your users
   - Root Directory: `backend`
   - Runtime: `Python 3`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

3. **Configure environment variables**
   - Click "Advanced" → "Add Environment Variable"
   - Add:
     ```
     CORS_ORIGINS=https://your-app.vercel.app
     ```
   - Optional: Add PostgreSQL database
     - In Render dashboard, create new PostgreSQL instance
     - Copy the Internal Database URL
     - Add as `DATABASE_URL` environment variable

4. **Deploy**
   - Click "Create Web Service"
   - Render will automatically build and deploy
   - Note your backend URL (e.g., `https://personalapp-backend.onrender.com`)
   - **Important**: Free tier services may spin down after inactivity

### Option 2: Using render.yaml (Infrastructure as Code)

1. **Deploy from repository**
   - The `render.yaml` file in the repository root is already configured
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click "New +" → "Blueprint"
   - Connect your repository
   - Render will auto-detect and use `render.yaml`
   - Update the `CORS_ORIGINS` environment variable after getting your Vercel URL

## Frontend Deployment (Vercel)

1. **Create a new Vercel project**
   - Go to [Vercel](https://vercel.com/)
   - Click "Add New Project"
   - Import your GitHub repository

2. **Configure build settings**
   - Framework Preset: Vite
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`

3. **Configure environment variables**
   - In Vercel dashboard → Settings → Environment Variables
   - Add:
     ```
     VITE_API_URL=https://personalapp-backend.onrender.com
     ```

4. **Deploy**
   - Click "Deploy"
   - Vercel will build and deploy your app
   - Get your frontend URL (e.g., `https://your-app.vercel.app`)

5. **Update backend CORS**
   - Go back to Render
   - Navigate to your backend service → Environment
   - Update `CORS_ORIGINS` to include your Vercel URL:
     ```
     CORS_ORIGINS=https://your-app.vercel.app
     ```
   - Click "Save Changes" - Render will automatically redeploy

## Local Development

1. **Backend**
   ```bash
   cd backend
   python -m venv venv
   venv\Scripts\activate  # Windows
   # source venv/bin/activate  # Mac/Linux
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```

2. **Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Environment Variables Reference

### Frontend (.env)
- `VITE_API_URL`: Backend API URL

### Backend (.env)
- `CORS_ORIGINS`: Comma-separated list of allowed frontend URLs
- `DATABASE_URL`: Database connection string (optional, defaults to SQLite)

## Database Migration

For production with PostgreSQL:

```bash
cd backend
alembic upgrade head
```

## Troubleshooting

### CORS Errors
- Ensure `CORS_ORIGINS` in Render includes your Vercel URL
- Check that both HTTP and HTTPS variants are included if needed
- Make sure to redeploy after updating environment variables

### API Connection Errors
- Verify `VITE_API_URL` in Vercel points to your Render backend
- Check Render logs (Dashboard → Service → Logs) for backend errors
- Free tier Render services spin down after 15 minutes of inactivity - first request may be slow

### Build Failures
- Clear build cache in Vercel/Render
- Check that all dependencies are in package.json/requirements.txt
- Verify Python version (3.11+) and Node version (18+) compatibility

### Render-Specific Issues
- **Cold starts**: Free tier services sleep after inactivity. First request after sleep will be slow (30-60 seconds)
- **502 errors**: Backend may still be starting up. Wait 1-2 minutes and retry
- **Database connection**: Ensure DATABASE_URL is properly set if using PostgreSQL
