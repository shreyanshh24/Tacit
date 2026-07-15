// Local embeddings via @xenova/transformers. Model runs in-process in Node,
// no API key required. Xenova/all-MiniLM-L6-v2 => 384-dim vectors.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractorPromise: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getExtractor(): Promise<any> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const { pipeline, env } = await import("@xenova/transformers");
      // Allow remote model download on first run; cache locally afterward.
      env.allowLocalModels = true;
      return pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    })();
  }
  return extractorPromise;
}

/**
 * Embed a single string into a 384-dim, L2-normalized vector.
 * Because vectors are normalized, cosine similarity == dot product.
 */
export async function embed(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array).map(Number);
}

/** Warm the model (used by setup script so the demo starts fast). */
export async function warmEmbeddings(): Promise<void> {
  await embed("warmup");
}
