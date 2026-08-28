import { httpRouter, makeFunctionReference } from "convex/server";
import { auth } from "./auth";
import type { Id } from "./_generated/dataModel";
import { httpAction } from "./_generated/server";

const http = httpRouter();

auth.addHttpRoutes(http);

const getPreviewFile = makeFunctionReference<
  "query",
  { documentId: Id<"offerDocuments"> },
  {
    storageId: Id<"_storage">;
    mimeType: string;
    fileName: string;
  }
>("documents:getPreviewFile");

http.route({
  path: "/documents/preview",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const params = new URL(request.url).searchParams;
    const documentId = params.get("documentId");
    if (!documentId || [...params.keys()].some((key) => key !== "documentId")) {
      return new Response("Not found", { status: 404 });
    }
    try {
      const preview = await ctx.runQuery(getPreviewFile, {
        documentId: documentId as Id<"offerDocuments">,
      });
      const blob = await ctx.storage.get(preview.storageId);
      if (!blob) return new Response("Not found", { status: 404 });
      return new Response(blob, {
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Type": preview.mimeType,
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  }),
});

export default http;
