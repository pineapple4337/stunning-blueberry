// config.js

export const APP_CONFIG = {
  SUPABASE_URL: 'https://rvuidgtkyerxhbiknznr.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2dWlkZ3RreWVyeGhiaWtuem5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMjA2MTUsImV4cCI6MjA5NTY5NjYxNX0.D_a_Ez5PHNnANp9O_zPeZbztphBP2pBHtLDN67-Ren4',
  defaultCategory: 'shopping',
  dateFormat: 'YYYY-MM-DD',
  autoTimeoutMs: 15 * 60 * 1000
};

// Unified category mapping matching HTML dropdowns and CSS colors
export const CATEGORY_MAP = {
  'food & drink': { 
    label: 'food & drink', 
    emoji: '🍔', 
    badgeColor: 'pastel-pink-2 text-stone-800', 
    barColor: 'pastel-pink-1' 
  },
  'shopping': { 
    label: 'shopping', 
    emoji: '🛍️', 
    badgeColor: 'pastel-pink-2 text-stone-800', 
    barColor: 'pastel-orchid' 
  },
  'subscriptions': { 
    label: 'subscriptions', 
    emoji: '📺', 
    badgeColor: 'pastel-purple-2 text-stone-800', 
    barColor: 'pastel-purple-1' 
  },
  'events': { 
    label: 'events', 
    emoji: '🎟️', 
    badgeColor: 'pastel-blue text-stone-800', 
    barColor: 'pastel-blue' 
  },
  'fees': { 
    label: 'fees', 
    emoji: '💵', 
    badgeColor: 'pastel-yellow text-stone-800', 
    barColor: 'pastel-yellow' 
  },
  'health': { 
    label: 'health', 
    emoji: '💊', 
    badgeColor: 'pastel-mint text-stone-800', 
    barColor: 'pastel-mint' 
  },
  'transport': { 
    label: 'transport', 
    emoji: '🚌', 
    badgeColor: 'pastel-mint text-stone-800', 
    barColor: 'pastel-mint' 
  }
};
