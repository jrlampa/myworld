/**
 * API Configuration
 * Automatically detects the correct API URL based on environment
 */

// In development, Vite proxy will forward /api requests to the backend
// In production, the backend serves the frontend, so relative URLs work
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export { API_BASE_URL };
