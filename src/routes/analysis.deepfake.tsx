import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Construction } from "lucide-react";

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
      <div>
        <h1 className="text-xl font-semibold">Deepfake Check</h1>
        <p className="text-sm text-muted-foreground">This module is not built yet.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Construction className="h-4 w-4" /> Work in progress
          </CardTitle>
          <CardDescription>Planned for the next phase of the project.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            We could not finish this module within the available time. The idea is to upload a
            video or image and get a basic authenticity result.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Read the file metadata and show it</li>
            <li>Try an open-source model or API for face manipulation detection</li>
            <li>Store the result along with the evidence record</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
