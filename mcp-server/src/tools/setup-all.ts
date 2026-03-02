import { setupSupabase } from "./setup-supabase.js";
import { setupStripe } from "./setup-stripe.js";
import { setupVercel } from "./setup-vercel.js";

interface SetupAllParams {
  organization_id: string;
  db_password: string;
  github_repo: string;
  region?: string;
  project_name?: string;
}

interface SetupAllResult {
  supabase: {
    project_id: string;
    url: string;
    anon_key: string;
    service_role_key: string;
  };
  stripe: {
    product_id: string;
    price_id: string;
  };
  vercel: {
    project_id: string;
    deployment_url: string;
  };
}

export async function setupAll(
  params: SetupAllParams
): Promise<SetupAllResult> {
  const {
    organization_id,
    db_password,
    github_repo,
    region,
    project_name,
  } = params;

  // Step 1: Set up Supabase
  const supabaseResult = await setupSupabase({
    organization_id,
    db_password,
    project_name,
    region,
  });

  // Step 2: Set up Stripe
  const stripeResult = await setupStripe();

  // Step 3: Set up Vercel with the generated env vars
  const vercelResult = await setupVercel({
    github_repo,
    env_vars: {
      NEXT_PUBLIC_SUPABASE_URL: supabaseResult.url,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseResult.anon_key,
      SUPABASE_SERVICE_ROLE_KEY: supabaseResult.service_role_key,
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? "",
      STRIPE_WEBHOOK_SECRET: "",
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "",
      STRIPE_PRODUCT_ID: stripeResult.product_id,
      STRIPE_PRICE_ID: stripeResult.price_id,
    },
  });

  return {
    supabase: supabaseResult,
    stripe: stripeResult,
    vercel: vercelResult,
  };
}
