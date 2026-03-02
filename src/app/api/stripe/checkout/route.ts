import { getAuthUser } from "@/lib/auth";
import { stripe, PLANS } from "@/lib/stripe";
import { getSubscription } from "@/lib/store";
import { NextResponse } from "next/server";

export async function POST() {
  const user = await getAuthUser();
  const subscription = await getSubscription(user.id);

  if (subscription?.plan === "pro") {
    return NextResponse.json(
      { error: "Already subscribed to Pro" },
      { status: 400 }
    );
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: PLANS.pro.priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL ? "" : "http://localhost:3000"}/settings?tab=subscription&success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL ? "" : "http://localhost:3000"}/settings?tab=subscription`,
    customer_email: user.email!,
    metadata: { user_id: user.id },
  });

  return NextResponse.json({ url: session.url });
}
