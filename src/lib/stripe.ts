import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe() {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-02-25.clover",
    });
  }
  return _stripe;
}

// Re-export as `stripe` for convenience but lazy
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    recommendations_per_day: 5,
    features: [
      "5 AI recommendations per day",
      "Basic listening analytics",
      "YouTube Music sync",
    ],
  },
  pro: {
    name: "Pro",
    price: 9,
    recommendations_per_day: Infinity,
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    features: [
      "Unlimited AI recommendations",
      "Advanced listening analytics",
      "Priority sync",
      "Mood-based playlists",
      "Artist deep dives",
    ],
  },
} as const;
