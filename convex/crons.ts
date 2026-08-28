import { cronJobs, makeFunctionReference } from "convex/server";

const cleanupDue = makeFunctionReference<"mutation", { limit?: number }>(
  "retention:cleanupDue",
);
const crons = cronJobs();

crons.interval("delete expired raw documents", { hours: 1 }, cleanupDue, {});

export default crons;
