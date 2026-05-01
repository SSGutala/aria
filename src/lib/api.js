// Central API base URL — set VITE_API_URL in your .env for production
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
// cache-bust: force Netlify rebuild with env vars
