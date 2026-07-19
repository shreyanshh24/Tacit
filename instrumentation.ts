// Runs once on server startup. Boots the in-process agent cron scheduler.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initScheduler } = await import("./lib/agents/scheduler");
    initScheduler();
  }
}
