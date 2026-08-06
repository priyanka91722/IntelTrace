import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/cases/$caseId/deepfake")({ component: Deepfake });

function Deepfake() {
  return (
    <div className="space-y-2">
      <h2 className="text-base font-semibold">Deepfake Check</h2>
      <p className="text-sm text-muted-foreground">Work in progress</p>
    </div>
  );
}
