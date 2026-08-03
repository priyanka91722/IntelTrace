import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/analysis/ocr")({
  head: () => ({
    meta: [
      { title: "OCR / Chat Analysis (Planned) — IntelTrace" },
      { name: "description", content: "Planned module to read text from chat screenshots. Not implemented in the current build." },
      { property: "og:title", content: "OCR / Chat Analysis (Planned)" },
      { property: "og:description", content: "Planned module to read text from chat screenshots." },
    ],
  }),
  component: OcrPage,
});

function OcrPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">OCR / Chat Analysis</h1>
      <p>Work in progress</p>
    </div>
  );
}
