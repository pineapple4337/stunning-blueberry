window.APP_CONFIG = {
    SUPABASE_URL: 'https://rvuidgtkyerxhbiknznr.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2dWlkZ3RreWVyeGhiaWtuem5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMjA2MTUsImV4cCI6MjA5NTY5NjYxNX0.D_a_Ez5PHNnANp9O_zPeZbztphBP2pBHtLDN67-Ren4'
};

// Category mapping with icons and fallback defaults
export const CATEGORY_MAP = {
  food: { label: 'Food & Drink', emoji: '🍱', color: '#ff7675' },
  shopping: { label: 'Shopping', emoji: '🛍️', color: '#74b9ff' },
  transport: { label: 'Transport', emoji: '🚌', color: '#55efc4' },
  utilities: { label: 'Utilities', emoji: '⚡', color: '#ffeaa7' },
  other: { label: 'Other', emoji: '📦', color: '#a29bfe' }
};

// UI Theme Palette and Settings
export const APP_CONFIG = {
  defaultCategory: 'other',
  dateFormat: 'YYYY-MM-DD',
  autoTimeoutMs: 15 * 60 * 1000, // 15 minutes auto-logout
};
