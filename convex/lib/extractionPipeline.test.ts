import { expect, test, vi } from "vitest";
import { blobToVisionInput } from "./extractionPipeline";

test("S5.1: image uploads are encoded directly without PDF rendering", async () => {
  const render = vi.fn();
  await expect(
    blobToVisionInput(
      new Blob([Buffer.from("jpeg bytes")], { type: "image/jpeg" }),
      "image/jpeg",
      render,
    ),
  ).resolves.toEqual({
    mimeType: "image/jpeg",
    base64: Buffer.from("jpeg bytes").toString("base64"),
  });
  expect(render).not.toHaveBeenCalled();
});
