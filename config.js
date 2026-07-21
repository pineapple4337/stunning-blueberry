// config.js

// Supabase credentials & UI settings combined into one exported object
export const APP_CONFIG = {
  SUPABASE_URL: 'https://rvuidgtkyerxhbiknznr.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2dWlkZ3RreWVyeGhiaWtuem5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMjA2MTUsImV4cCI6MjA5NTY5NjYxNX0.D_a_Ez5PHNnANp9O_zPeZbztphBP2pBHtLDN67-Ren4',
  defaultCategory: 'other',
  dateFormat: 'YYYY-MM-DD',
  autoTimeoutMs: 15 * 60 * 1000 // 15 minutes auto-logout
};

// Category mapping with icons, UI colors, and button DOM IDs
export const CATEGORY_MAP = {
  'food & drink': { label: 'Food & Drink', emoji: '🍱', color: 'bg-rose-200', btnId: 'cat-btn-food' },
  'shopping': { label: 'Shopping', emoji: '🛍️', color: 'bg-amber-200', btnId: 'cat-btn-shop' },
  'transport': { label: 'Transport', emoji: '🚌', color: 'bg-amber-100', btnId: 'cat-btn-trans' },
  'utilities': { label: 'Utilities', emoji: '⚡', color: 'bg-purple-200', btnId: 'cat-btn-util' },
  'other': { label: 'Other', emoji: '📦', color: 'bg-emerald-200', btnId: 'cat-btn-other' }
};
