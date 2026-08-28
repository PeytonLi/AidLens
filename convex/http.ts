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

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin");
  return origin && origin === process.env.SITE_URL
    ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" }
    : {};
}

http.route({
  path: "/documents/preview",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    const headers = corsHeaders(request);
    if (!("Access-Control-Allow-Origin" in headers)) {
      return new Response(null, { status: 403 });
    }
    return new Response(null, {
      status: 204,
      headers: {
        ...headers,
        "Access-Control-Allow-Headers": "Authorization",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Max-Age": "86400",
      },
    });
  }),
});

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
          ...corsHeaders(request),
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
