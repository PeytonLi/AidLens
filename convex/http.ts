import { httpRouter, makeFunctionReference } from "convex/server";
import { Webhook } from "svix";
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
const ingestAgentMailWebhook = makeFunctionReference<
  "mutation",
  {
    eventId: string;
    eventType: "message.received";
    inboxId: string;
    providerMessageId: string;
    threadId: string;
    subject: string;
    bodyText: string;
    sender: string;
  }
>("agentMail:ingestWebhook");
type DeliveryEventType =
  | "message.sent"
  | "message.delivered"
  | "message.bounced"
  | "message.rejected"
  | "message.complained";
const ingestAgentMailDelivery = makeFunctionReference<
  "mutation",
  {
    eventId: string;
    eventType: DeliveryEventType;
    inboxId: string;
    providerMessageId: string;
    threadId: string;
  }
>("agentMail:ingestDeliveryWebhook");

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

http.route({
  path: "/webhooks/agentmail",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.AGENTMAIL_WEBHOOK_SECRET;
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (!secret || contentLength > 256_000) {
      return new Response(null, { status: 400 });
    }
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 256_000) {
      return new Response(null, { status: 400 });
    }
    let payload: unknown;
    try {
      payload = new Webhook(secret).verify(raw, {
        "svix-id": request.headers.get("svix-id") ?? "",
        "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
        "svix-signature": request.headers.get("svix-signature") ?? "",
      });
    } catch {
      return new Response(null, { status: 400 });
    }
    if (
      typeof payload !== "object" ||
      payload === null ||
      !("event_type" in payload) ||
      typeof payload.event_type !== "string" ||
      !("event_id" in payload) ||
      typeof payload.event_id !== "string"
    ) {
      return new Response(null, { status: 400 });
    }
    const deliveryFields: Partial<Record<DeliveryEventType, string>> = {
      "message.sent": "send",
      "message.delivered": "delivery",
      "message.bounced": "bounce",
      "message.rejected": "reject",
      "message.complained": "complaint",
    };
    const deliveryField =
      deliveryFields[payload.event_type as DeliveryEventType];
    if (deliveryField) {
      const event = Reflect.get(payload, deliveryField) as unknown;
      if (typeof event !== "object" || event === null)
        return new Response(null, { status: 400 });
      const data = event as Record<string, unknown>;
      if (
        typeof data.inbox_id !== "string" ||
        typeof data.message_id !== "string" ||
        typeof data.thread_id !== "string"
      )
        return new Response(null, { status: 400 });
      await ctx.runMutation(ingestAgentMailDelivery, {
        eventId: payload.event_id,
        eventType: payload.event_type as DeliveryEventType,
        inboxId: data.inbox_id,
        providerMessageId: data.message_id,
        threadId: data.thread_id,
      });
      return new Response(null, { status: 204 });
    }
    if (
      payload.event_type !== "message.received" ||
      !("message" in payload) ||
      typeof payload.message !== "object" ||
      payload.message === null
    )
      return new Response(null, { status: 400 });
    const message = payload.message as Record<string, unknown>;
    if (
      typeof message.inbox_id !== "string" ||
      typeof message.message_id !== "string" ||
      typeof message.thread_id !== "string" ||
      typeof message.subject !== "string" ||
      typeof message.text !== "string" ||
      typeof message.from !== "string"
    ) {
      return new Response(null, { status: 400 });
    }
    await ctx.runMutation(ingestAgentMailWebhook, {
      eventId: payload.event_id,
      eventType: "message.received",
      inboxId: message.inbox_id,
      providerMessageId: message.message_id,
      threadId: message.thread_id,
      subject: message.subject,
      bodyText: message.text,
      sender: message.from,
    });
    return new Response(null, { status: 204 });
  }),
});

export default http;
