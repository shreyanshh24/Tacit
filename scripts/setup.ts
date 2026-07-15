/**
 * One-shot setup: warm the embedding model, ingest the seed dataset, then run
 * decision extraction. Run with: `npm run setup`
 *
 * Loads .env.local FIRST (before any lib import) so the Gemini client is
 * constructed with GOOGLE_API_KEY already present.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const hasKey = !!process.env.GOOGLE_API_KEY;

  // Dynamic imports so env is populated before gemini.ts initializes.
  const { warmEmbeddings } = await import("../lib/embeddings");
  const { runIngest, runExtract } = await import("../lib/ingest");

  console.log("→ Warming embedding model (first run downloads ~25MB)…");
  await warmEmbeddings();
  console.log("  ✓ Embedding model ready");

  console.log("→ Ingesting seed dataset…");
  const ing = await runIngest();
  console.log(
    `  ✓ Ingested ${ing.documents} documents, ${ing.interviews} pending interview(s)`
  );

  if (!hasKey) {
    console.warn(
      "\n⚠ GOOGLE_API_KEY not found in .env.local — skipping decision extraction.\n" +
        "  Add your key and run `npm run setup` again (or trigger /api/extract from the app)."
    );
    return;
  }

  console.log("→ Extracting decisions with Gemini…");
  const ext = await runExtract();
  console.log(`  ✓ Extracted ${ext.decisions} decisions`);

  console.log("\n✅ Setup complete. Run `npm run dev` and open http://localhost:3000");
}

main().catch((e) => {
  console.error("\n❌ Setup failed:", e);
  process.exit(1);
});
