import { defineConfig } from "vite-plus";
import fs from "node:fs/promises";
import type { ServerResponse } from "node:http";
import path from "node:path";
import type { Connect, Plugin, ViteDevServer } from "vite-plus";

type PlanVersion = {
  version: string;
  fileName: string;
  path: string;
  mtime: string;
};

const reviewDir = path.resolve(process.env.PLAN_REVIEW_DIR ?? ".plan-review");
const plansDir = path.join(reviewDir, "plans");
const feedbackDir = path.join(reviewDir, "feedback");
const currentVersionFile = path.join(reviewDir, ".current-version");

async function ensureReviewDirs() {
  await fs.mkdir(plansDir, { recursive: true });
  await fs.mkdir(feedbackDir, { recursive: true });
}

async function listVersions(): Promise<PlanVersion[]> {
  await ensureReviewDirs();
  const entries = await fs.readdir(plansDir, { withFileTypes: true });
  const versions = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && /^plan-v\d+\.md$/.test(entry.name))
      .map(async (entry) => {
        const version = entry.name.match(/^plan-(v\d+)\.md$/)?.[1] ?? "";
        const filePath = path.join(plansDir, entry.name);
        const stats = await fs.stat(filePath);

        return {
          version,
          fileName: entry.name,
          path: filePath,
          mtime: stats.mtime.toISOString(),
        };
      }),
  );

  return versions.sort(
    (first, second) => Number(first.version.slice(1)) - Number(second.version.slice(1)),
  );
}

async function getCurrentVersion(versions: PlanVersion[]) {
  try {
    const currentVersion = (await fs.readFile(currentVersionFile, "utf8")).trim();
    return (
      versions.find((version) => version.version === currentVersion) ?? versions.at(-1) ?? null
    );
  } catch {
    return versions.at(-1) ?? null;
  }
}

async function getPlan(versionId?: string) {
  const versions = await listVersions();
  const version = versionId
    ? versions.find((candidate) => candidate.version === versionId)
    : await getCurrentVersion(versions);

  if (!version) {
    return {
      status: 404,
      body: {
        content: "",
        version: null,
        planFile: null,
        versions,
        error: "No plan versions were found in .plan-review/plans.",
      },
    };
  }

  const content = await fs.readFile(version.path, "utf8");

  return {
    status: 200,
    body: {
      content,
      version: version.version,
      planFile: version.path,
      versions,
    },
  };
}

function writeJson(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(body, null, 2));
}

async function readJsonBody(request: Connect.IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

function refinedPlanModeApi(): Plugin {
  return {
    name: "refined-plan-mode-api",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(
        async (
          request: Connect.IncomingMessage,
          response: ServerResponse,
          next: Connect.NextFunction,
        ) => {
          const url = new URL(request.url ?? "/", "http://localhost");

          try {
            if (request.method === "GET" && url.pathname === "/api/plan") {
              const plan = await getPlan();
              writeJson(response, plan.status, plan.body);
              return;
            }

            if (request.method === "GET" && url.pathname.startsWith("/api/plan/")) {
              const version = decodeURIComponent(url.pathname.replace("/api/plan/", ""));
              const plan = await getPlan(version);
              writeJson(response, plan.status, plan.body);
              return;
            }

            if (request.method === "GET" && url.pathname === "/api/versions") {
              writeJson(response, 200, { versions: await listVersions() });
              return;
            }

            if (request.method === "GET" && url.pathname.startsWith("/api/feedback/")) {
              const version = decodeURIComponent(url.pathname.replace("/api/feedback/", ""));
              const feedbackPath = path.join(feedbackDir, `plan-${version}-feedback.json`);
              const feedback = await fs.readFile(feedbackPath, "utf8");
              writeJson(response, 200, JSON.parse(feedback) as unknown);
              return;
            }

            if (request.method === "POST" && url.pathname.startsWith("/api/feedback/")) {
              await ensureReviewDirs();
              const version = decodeURIComponent(url.pathname.replace("/api/feedback/", ""));
              const payload = await readJsonBody(request);
              const feedbackPath = path.join(feedbackDir, `plan-${version}-feedback.json`);
              await fs.writeFile(feedbackPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

              if (
                typeof payload === "object" &&
                payload !== null &&
                "status" in payload &&
                (payload.status === "approved" || payload.status === "approved_with_comments")
              ) {
                const plan = await getPlan(version);
                if (plan.status === 200 && plan.body.planFile) {
                  await fs.copyFile(plan.body.planFile, path.join(reviewDir, "approved-plan.md"));
                }
              }

              writeJson(response, 200, { ok: true, feedbackPath });
              return;
            }
          } catch (error) {
            writeJson(response, 500, {
              error: error instanceof Error ? error.message : "Unexpected API error.",
            });
            return;
          }

          next();
        },
      );
    },
  };
}

export default defineConfig({
  plugins: [refinedPlanModeApi()],
  staged: {
    "*": "vp check --fix",
  },
  fmt: {},
  lint: { options: { typeAware: true, typeCheck: true } },
});
