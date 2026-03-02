import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

interface SetupSupabaseParams {
  organization_id: string;
  project_name?: string;
  db_password: string;
  region?: string;
}

interface SetupSupabaseResult {
  project_id: string;
  url: string;
  anon_key: string;
  service_role_key: string;
}

const SUPABASE_API = "https://api.supabase.com";

function getAccessToken(): string {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    throw new Error("SUPABASE_ACCESS_TOKEN environment variable is not set");
  }
  return token;
}

async function supabaseFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getAccessToken();
  const res = await fetch(`${SUPABASE_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase API error (${res.status}): ${body}`);
  }
  return res;
}

async function waitForProjectReady(
  projectId: string,
  maxAttempts = 60,
  intervalMs = 5000
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await supabaseFetch(`/v1/projects/${projectId}`);
    const project = (await res.json()) as { status: string };
    if (project.status === "ACTIVE_HEALTHY") {
      return;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    "Timed out waiting for Supabase project to become ready"
  );
}

async function readMigrationSQL(): Promise<string> {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const migrationPath = resolve(
    __dirname,
    "..",
    "..",
    "..",
    "supabase",
    "migrations",
    "001_initial_schema.sql"
  );
  try {
    return await readFile(migrationPath, "utf-8");
  } catch {
    throw new Error(
      `Could not read migration file at ${migrationPath}. Ensure it exists.`
    );
  }
}

export async function setupSupabase(
  params: SetupSupabaseParams
): Promise<SetupSupabaseResult> {
  const {
    organization_id,
    project_name = "soundsense",
    db_password,
    region = "us-east-1",
  } = params;

  // Step 1: Create the project
  const createRes = await supabaseFetch("/v1/projects", {
    method: "POST",
    body: JSON.stringify({
      organization_id,
      name: project_name,
      db_pass: db_password,
      region,
      plan: "free",
    }),
  });
  const project = (await createRes.json()) as { id: string };
  const projectId = project.id;

  // Step 2: Wait for the project to be ready
  await waitForProjectReady(projectId);

  // Step 3: Run the SQL migration
  const sql = await readMigrationSQL();
  await supabaseFetch(`/v1/projects/${projectId}/database/query`, {
    method: "POST",
    body: JSON.stringify({ query: sql }),
  });

  // Step 4: Configure Google OAuth provider
  await supabaseFetch(`/v1/projects/${projectId}/config/auth`, {
    method: "PATCH",
    body: JSON.stringify({
      external_google_enabled: true,
      external_google_client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      external_google_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  });

  // Step 5: Retrieve API keys
  const keysRes = await supabaseFetch(`/v1/projects/${projectId}/api-keys`);
  const keys = (await keysRes.json()) as Array<{
    name: string;
    api_key: string;
  }>;

  const anonKey =
    keys.find((k) => k.name === "anon")?.api_key ?? "";
  const serviceRoleKey =
    keys.find((k) => k.name === "service_role")?.api_key ?? "";

  const url = `https://${projectId}.supabase.co`;

  return {
    project_id: projectId,
    url,
    anon_key: anonKey,
    service_role_key: serviceRoleKey,
  };
}
