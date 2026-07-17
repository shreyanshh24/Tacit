/**
 * One-shot setup: warm the local embedding model so the first in-app action is
 * fast. Run with: `npm run setup`
 *
 * Note: data is now created per-project inside the app (create a project, then
 * load the NimbusPay sample or connect Jira / capture docs). This script no
 * longer wipes or seeds the database, so it is safe to run at any time.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { warmEmbeddings } = await import("../lib/embeddings");

  console.log("→ Warming embedding model (first run downloads ~25MB)…");
  await warmEmbeddings();
  console.log("  ✓ Embedding model ready");

  console.log(
    "\n✅ Setup complete. Run `npm run dev`, open http://localhost:3000,\n" +
      "   sign in (team → member → project), then load the NimbusPay sample\n" +
      "   or connect Jira to fill the project's memory."
  );
}

main().catch((e) => {
  console.error("\n❌ Setup failed:", e);
  process.exit(1);
});
