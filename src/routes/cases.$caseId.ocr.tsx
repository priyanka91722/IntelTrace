import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/cases/$caseId/ocr")({ component: Ocr });

function Ocr() {
  return (
    <div className="space-y-2">
      <h2 className="text-base font-semibold">OCR / Chat Analysis</h2>
      <p className="text-sm text-muted-foreground">Work in progress</p>
    </div>
  );
}
