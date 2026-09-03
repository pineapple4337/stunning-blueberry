// config.js

export const APP_CONFIG = {
  FIREBASE_CONFIG: {
    apiKey: "AIzaSyAnbPPt2sviHc3RckDeZb1T-DNyM-In4eg",
    authDomain: "expenses-f72cc.firebaseapp.com",
    projectId: "expenses-f72cc",
    storageBucket: "expenses-f72cc.firebasestorage.app",
    messagingSenderId: "1036960578872",
    appId: "1:1036960578872:web:488c01c0efa5cbd1b4d5cd",
    measurementId: "G-WL6GQD3RGT"
  },

  defaultCategory: "shopping",
  dateFormat: "YYYY-MM-DD",
  autoTimeoutMs: 15 * 60 * 1000
};

export const CATEGORY_MAP = {
  "food & drink": {
    label: "food & drink",
    emoji: "🍔",
    badgeColor: "pastel-pink-2 text-stone-800",
    barColor: "pastel-pink-1"
  },

  shopping: {
    label: "shopping",
    emoji: "🛍️",
    badgeColor: "pastel-pink-2 text-stone-800",
    barColor: "pastel-orchid"
  },

  subscriptions: {
    label: "subscriptions",
    emoji: "📺",
    badgeColor: "pastel-purple-2 text-stone-800",
    barColor: "pastel-purple-1"
  },

  events: {
    label: "events",
    emoji: "🎟️",
    badgeColor: "pastel-blue text-stone-800",
    barColor: "pastel-blue"
  },

  fees: {
    label: "fees",
    emoji: "💵",
    badgeColor: "pastel-yellow text-stone-800",
    barColor: "pastel-yellow"
  },

  health: {
    label: "health",
    emoji: "💊",
    badgeColor: "pastel-mint text-stone-800",
    barColor: "pastel-mint"
  },

  transport: {
    label: "transport",
    emoji: "🚌",
    badgeColor: "pastel-mint text-stone-800",
    barColor: "pastel-mint"
  }
};
