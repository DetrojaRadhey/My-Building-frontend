// Values come from .env — copy .env.example to .env and fill in your values
// EXPO_PUBLIC_ prefix makes them available in the app bundle (Expo SDK 49+)
export const API_BASE   = process.env.EXPO_PUBLIC_API_BASE   ?? 'http://localhost:5000/api';
export const ENTRY_BASE = process.env.EXPO_PUBLIC_ENTRY_BASE ?? 'http://localhost:5000/entry';
