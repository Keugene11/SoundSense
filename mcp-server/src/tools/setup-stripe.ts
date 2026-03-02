interface SetupStripeResult {
  product_id: string;
  price_id: string;
}

function getStripeKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY environment variable is not set");
  }
  return key;
}

async function stripeFetch(
  path: string,
  body: Record<string, string>
): Promise<Record<string, unknown>> {
  const key = getStripeKey();
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe API error (${res.status}): ${text}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

export async function setupStripe(): Promise<SetupStripeResult> {
  // Step 1: Create the product
  const product = await stripeFetch("/products", {
    name: "SoundSense Pro",
    description:
      "Premium access to SoundSense — AI-powered sound analysis and monitoring with advanced features.",
  });
  const productId = product.id as string;

  // Step 2: Create a recurring monthly price
  const price = await stripeFetch("/prices", {
    product: productId,
    unit_amount: "900",
    currency: "usd",
    "recurring[interval]": "month",
  });
  const priceId = price.id as string;

  return {
    product_id: productId,
    price_id: priceId,
  };
}
