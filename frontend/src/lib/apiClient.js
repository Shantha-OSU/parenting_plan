// Crreate API key by importing from env. If not available, default to localhost
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// Function to build API url for specific routing
export function buildApiUrl(path = '') {
  // Path defaults to '' if a path is not passed in when function is called
  if (!path) {
    // If there is no given path, just return the base url
    return API_BASE_URL;
  }

  // Sanitize format of the url
  return path.startsWith('/')
    ? `${API_BASE_URL}${path}`
    : `${API_BASE_URL}/${path}`;
}

