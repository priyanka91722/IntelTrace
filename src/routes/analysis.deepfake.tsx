import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/analysis/deepfake")({
  head: () => ({
    meta: [
      { title: "Deepfake Check (Planned) — IntelTrace" },
      { name: "description", content: "Planned module for video and image authenticity checking. Not implemented in the current build." },
      { property: "og:title", content: "Deepfake Check (Planned)" },
      { property: "og:description", content: "Planned module for media authenticity checking." },
    ],
  }),
  component: Deepfake,
});

function Deepfake() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Deepfake Check</h1>
      <p>Work in progress</p>
    </div>
  );
}
