import { getRouteUser } from "@/lib/auth";
import { stripe, PLANS } from "@/lib/stripe";
import { getSubscription } from "@/lib/store";
import { NextResponse } from "next/server";

export async function POST() {
  const auth = await getRouteUser();
  if (auth.error) return auth.error;
  const { user } = auth;

  try {
    const subscription = await getSubscription(user.id);

    if (subscription?.plan === "pro") {
      return NextResponse.json(
        { error: "Already subscribed to Pro" },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        { price: process.env.STRIPE_PRO_PRICE_ID || PLANS.pro.priceId, quantity: 1 },
      ],
      success_url: `${appUrl}/settings?tab=subscription&success=true`,
      cancel_url: `${appUrl}/settings?tab=subscription`,
      customer_email: user.email!,
      metadata: { user_id: user.id },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
