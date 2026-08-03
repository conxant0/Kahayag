// Defines validated browser environment configuration.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Vercel writes "[SENSITIVE]" for vars marked Sensitive, which vercel pull cannot decrypt.
// Without a scheme, fetch resolves the base relative to the page origin and silently hits the frontend.
if (!/^https?:\/\//.test(API_BASE_URL ?? "")) {
  throw new Error(`Invalid VITE_API_BASE_URL: ${API_BASE_URL}`);
}
