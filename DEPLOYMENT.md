# Deployment Guide

This guide explains how to deploy the Personal Productivity App to production.

## Architecture

- **Frontend**: React + Vite + TypeScript (deployed on Vercel)
- **Backend**: FastAPI + Python (deployed on Railway)
- **Database**: SQLite (development) / PostgreSQL (production)

## Prerequisites

- GitHub account
- Vercel account (free tier available)
- Railway account (free tier available)

## Backend Deployment (Railway)

1. **Create a new Railway project**
   - Go to [Railway](https://railway.app/)
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository
   - Railway will auto-detect the Python app

2. **Configure environment variables**
   - In Railway dashboard, go to your service → Variables
   - Add the following:
     ```
     CORS_ORIGINS=https://your-app.vercel.app
     PORT=8000
     ```
   - Optional: Add PostgreSQL database
     - Click "New" → "Database" → "Add PostgreSQL"
     - Railway will auto-set `DATABASE_URL`

3. **Configure build settings**
   - Root directory: `backend`
   - Build command: `pip install -r requirements.txt`
   - Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

4. **Deploy**
   - Railway will automatically deploy on push to main
   - Note your backend URL (e.g., `https://your-app.up.railway.app`)

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
     VITE_API_URL=https://your-backend.up.railway.app
     ```

4. **Deploy**
   - Click "Deploy"
   - Vercel will build and deploy your app
   - Get your frontend URL (e.g., `https://your-app.vercel.app`)

5. **Update backend CORS**
   - Go back to Railway
   - Update `CORS_ORIGINS` to include your Vercel URL:
     ```
     CORS_ORIGINS=https://your-app.vercel.app
     ```

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
- Ensure `CORS_ORIGINS` in Railway includes your Vercel URL
- Check that both HTTP and HTTPS variants are included if needed

### API Connection Errors
- Verify `VITE_API_URL` in Vercel points to your Railway backend
- Check Railway logs for backend errors

### Build Failures
- Clear build cache in Vercel/Railway
- Check that all dependencies are in package.json/requirements.txt
