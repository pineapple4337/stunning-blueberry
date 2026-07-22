// config.js

export const APP_CONFIG = {
  SUPABASE_URL: 'https://rvuidgtkyerxhbiknznr.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2dWlkZ3RreWVyeGhiaWtuem5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMjA2MTUsImV4cCI6MjA5NTY5NjYxNX0.D_a_Ez5PHNnANp9O_zPeZbztphBP2pBHtLDN67-Ren4',
  defaultCategory: 'other',
  dateFormat: 'YYYY-MM-DD',
  autoTimeoutMs: 15 * 60 * 1000
};

// Expanded category mapping with icons, UI badge colors, and progress bar colors
export const CATEGORY_MAP = {
  'food & drink': { label: 'food & drink', emoji: '🍱', badgeColor: 'bg-rose-100 text-rose-800', barColor: 'bg-rose-500' },
  'shopping': { label: 'shopping', emoji: '🛍️', badgeColor: 'bg-amber-100 text-amber-800', barColor: 'bg-amber-500' },
  'clothing': { label: 'clothing', emoji: '👕', badgeColor: 'bg-amber-100 text-amber-800', barColor: 'bg-amber-500' },
  'transport': { label: 'transport', emoji: '🚌', badgeColor: 'bg-emerald-100 text-emerald-800', barColor: 'bg-emerald-500' },
  'travel': { label: 'travel', emoji: '✈️', badgeColor: 'bg-emerald-100 text-emerald-800', barColor: 'bg-emerald-500' },
  'subscriptions': { label: 'subscriptions', emoji: '📺', badgeColor: 'bg-purple-100 text-purple-800', barColor: 'bg-purple-500' },
  'mobile': { label: 'mobile', emoji: '📱', badgeColor: 'bg-purple-100 text-purple-800', barColor: 'bg-purple-500' },
  'events': { label: 'events', emoji: '🎟️', badgeColor: 'bg-indigo-100 text-indigo-800', barColor: 'bg-indigo-500' },
  'fees': { label: 'fees', emoji: '💵', badgeColor: 'bg-blue-100 text-blue-800', barColor: 'bg-blue-500' },
  'education': { label: 'education', emoji: '🎓', badgeColor: 'bg-blue-100 text-blue-800', barColor: 'bg-blue-500' },
  'health': { label: 'health', emoji: '💊', badgeColor: 'bg-teal-100 text-teal-800', barColor: 'bg-teal-500' },
  'utilities': { label: 'utilities', emoji: '⚡', badgeColor: 'bg-sky-100 text-sky-800', barColor: 'bg-sky-500' },
  'other': { label: 'other', emoji: '📦', badgeColor: 'bg-gray-100 text-gray-800', barColor: 'bg-gray-400' }
};
