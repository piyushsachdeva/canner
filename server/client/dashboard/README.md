# API Monitoring Dashboard

## Project Overview

This is a real-time API monitoring dashboard that connects to a Flask backend to display metrics about API performance.

## Setup Instructions

### Backend Setup

1. Navigate to the server directory: `cd ../../server`
2. Install Python dependencies: `pip install -r requirements.txt`
3. Start the Flask server: `python app.py`
4. The backend will be available at `http://localhost:5000`

### Frontend Setup

1. Install dependencies: `npm install`
2. Start the development server: `npm run dev`
3. Access the dashboard at `http://localhost:8080`
4. Build for production: `npm run build`

## Development

To contribute to this project:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Features

- Real-time dashboard with auto-refresh every 30 seconds
- Summary cards showing total requests, average response time, and error rate
- Table of endpoints with request count, average latency, and error percentage
- Charts visualizing request trends and latency by endpoint
- Responsive design that works on desktop and mobile devices
- Connection to Flask backend running on <http://localhost:5000>
- Error handling with retry functionality

## Technologies Used

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Recharts for data visualization
- React Query for data fetching

## API Endpoints

The dashboard connects to the following backend endpoints:

- `GET /health` - Returns overall system health and metrics
- `GET /metrics` - Returns detailed metrics per endpoint
- `GET /metrics/recent` - Returns recent request logs

## Deployment

To deploy this project to production:

1. Build the frontend: `npm run build`
2. Serve the built files from the `dist` directory
3. Ensure the Flask backend is accessible at the expected API endpoint

For cloud deployment, you can use services like:

- Vercel
- Netlify
- AWS S3 + CloudFront
- Google Cloud Storage

Make sure to set the appropriate environment variables for production API endpoints.
