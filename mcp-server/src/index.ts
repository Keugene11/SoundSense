import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { setupSupabase } from "./tools/setup-supabase.js";
import { setupStripe } from "./tools/setup-stripe.js";
import { setupVercel } from "./tools/setup-vercel.js";
import { setupAll } from "./tools/setup-all.js";

const server = new McpServer({
  name: "soundsense-setup",
  version: "1.0.0",
});

// Tool: setup_supabase
server.tool(
  "setup_supabase",
  "Create a Supabase project, run the initial migration, and configure Google OAuth",
  {
    organization_id: z.string().describe("Supabase organization ID"),
    project_name: z
      .string()
      .optional()
      .describe("Project name (defaults to 'soundsense')"),
    db_password: z.string().describe("Database password for the new project"),
    region: z
      .string()
      .optional()
      .describe("AWS region for the project (defaults to 'us-east-1')"),
  },
  async (params) => {
    try {
      const result = await setupSupabase(params);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

// Tool: setup_stripe
server.tool(
  "setup_stripe",
  "Create the SoundSense Pro product and $9/month recurring price in Stripe",
  {},
  async () => {
    try {
      const result = await setupStripe();
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

// Tool: setup_vercel
server.tool(
  "setup_vercel",
  "Create a Vercel project, link a GitHub repo, set environment variables, and trigger a deployment",
  {
    github_repo: z
      .string()
      .describe('GitHub repository in "owner/repo" format'),
    env_vars: z
      .record(z.string())
      .optional()
      .describe("Environment variables to set on the Vercel project"),
  },
  async (params) => {
    try {
      const result = await setupVercel(params);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

// Tool: setup_all
server.tool(
  "setup_all",
  "Run the full infrastructure setup: Supabase, Stripe, and Vercel in sequence",
  {
    organization_id: z.string().describe("Supabase organization ID"),
    db_password: z.string().describe("Database password for the Supabase project"),
    github_repo: z
      .string()
      .describe('GitHub repository in "owner/repo" format'),
    region: z
      .string()
      .optional()
      .describe("AWS region for Supabase (defaults to 'us-east-1')"),
    project_name: z
      .string()
      .optional()
      .describe("Supabase project name (defaults to 'soundsense')"),
  },
  async (params) => {
    try {
      const result = await setupAll(params);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

// Connect via stdio transport
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
