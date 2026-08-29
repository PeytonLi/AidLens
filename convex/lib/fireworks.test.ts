import { describe, expect, it, vi } from "vitest";
import {
  buildFireworksExtractionRequest,
  readFireworksConfig,
  requestFireworksExtraction,
} from "./fireworks";

it("S5.1: requires server-side Fireworks configuration", () => {
  expect(() => readFireworksConfig({})).toThrow("FIREWORKS_NOT_CONFIGURED");
  expect(
    readFireworksConfig({
      FIREWORKS_API_KEY: "secret-test-key",
      FIREWORKS_MODEL: "accounts/fireworks/models/kimi-k2p6",
    }),
  ).toEqual({
    apiKey: "secret-test-key",
    model: "accounts/fireworks/models/kimi-k2p6",
  });
});

describe("buildFireworksExtractionRequest", () => {
  it("S5.1: builds a strict, tool-free vision extraction request", () => {
    const request = buildFireworksExtractionRequest({
      model: "accounts/fireworks/models/kimi-k2p6",
      mimeType: "image/png",
      base64: "iVBORw0KGgo=",
    });

    expect(request).toMatchObject({
      model: "accounts/fireworks/models/kimi-k2p6",
      temperature: 0,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "aidlens_extraction_v1",
          strict: true,
        },
      },
      messages: [
        expect.objectContaining({ role: "system" }),
        {
          role: "user",
          content: [
            expect.objectContaining({ type: "text" }),
            {
              type: "image_url",
              image_url: { url: "data:image/png;base64,iVBORw0KGgo=" },
            },
          ],
        },
      ],
    });
    expect(request).not.toHaveProperty("tools");
  });

  it("S5.1: refuses unsupported direct PDF inlining", () => {
    expect(() =>
      buildFireworksExtractionRequest({
        model: "accounts/fireworks/models/kimi-k2p6",
        mimeType: "application/pdf",
        base64: "JVBERi0=",
      }),
    ).toThrow("PDF_RENDER_REQUIRED");
  });

  it("S5.1: sends every rendered PDF page as a vision image", () => {
    const request = buildFireworksExtractionRequest({
      model: "accounts/fireworks/models/kimi-k2p6",
      mimeType: "image/png",
      base64: ["page-one", "page-two"],
    });

    expect(request.messages[1].content).toEqual([
      expect.objectContaining({ type: "text" }),
      {
        type: "image_url",
        image_url: { url: "data:image/png;base64,page-one" },
      },
      {
        type: "image_url",
        image_url: { url: "data:image/png;base64,page-two" },
      },
    ]);
  });
});

it("S5.1: calls Fireworks server-side and returns the structured content", async () => {
  const extraction = {
    version: "v1",
    schoolCandidates: [],
    offer: {
      academicYear: "2026-2027",
      startTerm: "Fall 2026",
      endTerm: "Spring 2027",
      enrollmentIntensity: "full_time",
      housingAssumption: "unknown",
      residencyAssumption: "unknown",
      overallConfidence: 0.5,
      lineItems: [],
    },
  };
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify(extraction),
            },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );

  await expect(
    requestFireworksExtraction(
      {
        apiKey: "secret-test-key",
        model: "accounts/fireworks/models/kimi-k2p6",
        mimeType: "image/jpeg",
        base64: "/9j/2Q==",
      },
      fetcher,
    ),
  ).resolves.toEqual(extraction);
  expect(fetcher).toHaveBeenCalledWith(
    "https://api.fireworks.ai/inference/v1/chat/completions",
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        Authorization: "Bearer secret-test-key",
      }),
    }),
  );
});
