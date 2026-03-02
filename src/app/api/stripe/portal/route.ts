import { getAuthUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { getSubscription } from "@/lib/store";
import { NextResponse } from "next/server";

export async function POST() {
  const user = await getAuthUser();
  const subscription = await getSubscription(user.id);

  if (!subscription?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No billing account found" },
      { status: 400 }
    );
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL ? "" : "http://localhost:3000"}/settings?tab=subscription`,
  });

  return NextResponse.json({ url: session.url });
}
