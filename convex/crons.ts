import { cronJobs, makeFunctionReference } from "convex/server";

const cleanupDue = makeFunctionReference<"mutation", { limit?: number }>(
  "retention:cleanupDue",
);
const crons = cronJobs();

crons.hourly("delete expired raw documents", {}, cleanupDue, {});

export default crons;
