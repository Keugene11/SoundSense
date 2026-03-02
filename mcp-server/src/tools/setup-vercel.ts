interface SetupVercelParams {
  github_repo: string;
  env_vars?: Record<string, string>;
}

interface SetupVercelResult {
  project_id: string;
  deployment_url: string;
}

function getVercelToken(): string {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    throw new Error("VERCEL_TOKEN environment variable is not set");
  }
  return token;
}

async function vercelFetch(
  path: string,
  options: RequestInit = {}
): Promise<Record<string, unknown>> {
  const token = getVercelToken();
  const res = await fetch(`https://api.vercel.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vercel API error (${res.status}): ${text}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

export async function setupVercel(
  params: SetupVercelParams
): Promise<SetupVercelResult> {
  const { github_repo, env_vars = {} } = params;

  // Parse owner/repo from the github_repo string
  const [owner, repo] = github_repo.split("/");
  if (!owner || !repo) {
    throw new Error(
      'github_repo must be in the format "owner/repo"'
    );
  }

  // Step 1: Create the Vercel project linked to the GitHub repo
  const project = await vercelFetch("/v10/projects", {
    method: "POST",
    body: JSON.stringify({
      name: repo,
      framework: "nextjs",
      gitRepository: {
        type: "github",
        repo: github_repo,
      },
    }),
  });
  const projectId = project.id as string;
  const projectName = project.name as string;

  // Step 2: Set environment variables
  const envEntries = Object.entries(env_vars);
  if (envEntries.length > 0) {
    const envPayload = envEntries.map(([key, value]) => ({
      key,
      value,
      target: ["production", "preview", "development"],
      type: "encrypted",
    }));

    await vercelFetch(`/v10/projects/${projectId}/env`, {
      method: "POST",
      body: JSON.stringify(envPayload),
    });
  }

  // Step 3: Trigger a deployment
  const deployment = await vercelFetch("/v13/deployments", {
    method: "POST",
    body: JSON.stringify({
      name: projectName,
      project: projectId,
      gitSource: {
        type: "github",
        repo: github_repo,
        ref: "main",
      },
    }),
  });
  const deploymentUrl = deployment.url as string;

  return {
    project_id: projectId,
    deployment_url: `https://${deploymentUrl}`,
  };
}
