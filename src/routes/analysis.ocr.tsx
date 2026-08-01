import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Construction } from "lucide-react";

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
      <div>
        <h1 className="text-xl font-semibold">OCR / Chat Analysis</h1>
        <p className="text-sm text-muted-foreground">This module is partially planned only.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Construction className="h-4 w-4" /> Work in progress
          </CardTitle>
          <CardDescription>We tested Tesseract.js separately but did not integrate it yet.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Remaining work:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Run OCR on an uploaded chat screenshot in the browser</li>
            <li>Match the extracted text against a keyword list (OTP, KYC, refund, etc.)</li>
            <li>Show the matched words and save them to the case</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
