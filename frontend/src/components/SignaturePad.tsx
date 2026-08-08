import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export interface SignaturePadHandle {
  toDataURL: () => string | null;
  clear: () => void;
  isEmpty: () => boolean;
}

/** Minimal canvas signature pad — draws a stroke matching IntelTrace's own
 * phosphor palette rather than depending on an unstyled third-party kit.
 * Exposes toDataURL() via the exported helpers below rather than a ref
 * forwarding API, to keep this a plain function component. */
export default function SignaturePad({
  onChange,
  height = 140,
}: {
  onChange?: (dataUrl: string | null) => void;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#3cff7a";
  }, []);

  const pointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    lastPoint.current = pointFromEvent(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    const p = pointFromEvent(e);
    if (ctx && lastPoint.current) {
      ctx.beginPath();
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    lastPoint.current = p;
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    setHasSignature(true);
    onChange?.(canvasRef.current?.toDataURL("image/png") ?? null);
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onChange?.(null);
  }

  return (
    <div>
      <div className="relative rounded-md border border-line bg-panel-2">
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height }}
          className="touch-none rounded-md"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
        {!hasSignature && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted">
            Sign here
          </div>
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-xs text-muted">Draw your signature above</span>
        <Button type="button" variant="ghost" size="sm" onClick={clear}>
          Clear
        </Button>
      </div>
    </div>
  );
}
