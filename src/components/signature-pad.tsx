"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { PenLine, Upload, X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface SignaturePadProps {
  /** The hidden input `name` that will carry the base64 PNG data URL */
  inputName: string;
  /** Label shown above the pad */
  label: string;
  /** Initial data URL (e.g. when re-editing an approved loan) */
  initialDataUrl?: string | null;
}

type Tab = "draw" | "upload";

export function SignaturePad({
  inputName,
  label,
  initialDataUrl,
}: SignaturePadProps) {
  const [tab, setTab] = useState<Tab>("draw");
  const [dataUrl, setDataUrl] = useState<string | null>(initialDataUrl ?? null);
  const [scale, setScale] = useState(100); // percentage
  const [isDrawing, setIsDrawing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // ─── canvas helpers ────────────────────────────────────────────────────────

  const getCtx = () => canvasRef.current?.getContext("2d") ?? null;

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const exportCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Export only the bounding box with content so we don't get a huge blank image
    const ctx = canvas.getContext("2d")!;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const a = data[(y * canvas.width + x) * 4 + 3];
        if (a > 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX || maxY < minY) {
      // nothing drawn
      setDataUrl(null);
      return;
    }
    const pad = 6;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(canvas.width, maxX + pad);
    maxY = Math.min(canvas.height, maxY + pad);
    const w = maxX - minX;
    const h = maxY - minY;
    const crop = document.createElement("canvas");
    crop.width = w;
    crop.height = h;
    crop.getContext("2d")!.drawImage(canvas, minX, minY, w, h, 0, 0, w, h);
    setDataUrl(crop.toDataURL("image/png"));
  }, []);

  // ─── pointer drawing ───────────────────────────────────────────────────────

  function getPos(
    e: React.PointerEvent<HTMLCanvasElement>
  ): { x: number; y: number } {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvasRef.current!.width / rect.width),
      y: (e.clientY - rect.top) * (canvasRef.current!.height / rect.height),
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    canvasRef.current!.setPointerCapture(e.pointerId);
    const ctx = getCtx();
    if (!ctx) return;
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setIsDrawing(true);
    const pos = getPos(e);
    lastPos.current = pos;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 1, 0, Math.PI * 2);
    ctx.fillStyle = "#0f172a";
    ctx.fill();
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing) return;
    const ctx = getCtx();
    if (!ctx || !lastPos.current) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  }

  function onPointerUp() {
    setIsDrawing(false);
    lastPos.current = null;
    exportCanvas();
  }

  // ─── file upload ───────────────────────────────────────────────────────────

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Scale to fit canvas
        const ratio = Math.min(
          canvas.width / img.width,
          canvas.height / img.height
        );
        const w = img.width * ratio;
        const h = img.height * ratio;
        const x = (canvas.width - w) / 2;
        const y = (canvas.height - h) / 2;
        ctx.drawImage(img, x, y, w, h);
        exportCanvas();
      };
      img.src = ev.target!.result as string;
    };
    reader.readAsDataURL(file);
  }

  // ─── clear ─────────────────────────────────────────────────────────────────

  function handleClear() {
    clearCanvas();
    setDataUrl(null);
  }

  // ─── init canvas background ────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  // ─── Scaled preview size for the PDF ──────────────────────────────────────
  // We encode scale into the stored data as a separate hidden input.
  // The PDF renderer will read it and apply width accordingly.

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-400">{label}</p>
        {dataUrl && (
          <button
            type="button"
            onClick={handleClear}
            className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Hapus tanda tangan
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg bg-zinc-950 p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab("draw")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            tab === "draw"
              ? "bg-zinc-700 text-white"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <PenLine className="w-3.5 h-3.5" /> Gambar
        </button>
        <button
          type="button"
          onClick={() => setTab("upload")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            tab === "upload"
              ? "bg-zinc-700 text-white"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Upload className="w-3.5 h-3.5" /> Upload
        </button>
      </div>

      {/* Canvas (always mounted so draw state persists across tab switch) */}
      <div
        className={`relative rounded-xl border-2 border-dashed overflow-hidden bg-white ${
          isDrawing ? "border-orange-400" : "border-zinc-600"
        } ${tab === "upload" ? "hidden" : ""}`}
        style={{ touchAction: "none" }}
      >
        <canvas
          ref={canvasRef}
          width={500}
          height={160}
          className="w-full h-40 cursor-crosshair block"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
        <button
          type="button"
          onClick={handleClear}
          title="Bersihkan"
          className="absolute top-2 right-2 p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        {!dataUrl && tab === "draw" && (
          <p className="absolute inset-0 flex items-center justify-center text-zinc-400 text-xs pointer-events-none select-none">
            Gambar tanda tangan di sini
          </p>
        )}
      </div>

      {/* Upload area */}
      {tab === "upload" && (
        <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-600 bg-zinc-950 p-6 cursor-pointer hover:border-orange-500/60 transition-colors">
          <Upload className="w-5 h-5 text-zinc-400" />
          <span className="text-xs text-zinc-400">
            Klik untuk pilih gambar (PNG/JPG/SVG)
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
        </label>
      )}

      {/* Preview + scale */}
      {dataUrl && (
        <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <p className="text-[11px] text-zinc-400 font-medium">
            Preview tanda tangan (akan muncul di PDF)
          </p>
          <div className="bg-white rounded-lg p-3 flex items-center justify-center min-h-16">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={dataUrl}
              alt="Tanda tangan"
              style={{ maxHeight: 80, width: "auto", transform: `scale(${scale / 100})`, transformOrigin: "center" }}
            />
          </div>
          {/* Scale slider */}
          <div className="flex items-center gap-2">
            <ZoomOut className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <input
              type="range"
              min={30}
              max={200}
              step={5}
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              className="flex-1 accent-orange-500"
            />
            <ZoomIn className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="text-[11px] text-zinc-400 w-8 text-right shrink-0">
              {scale}%
            </span>
          </div>
        </div>
      )}

      {/* Hidden inputs that the server action reads */}
      <input type="hidden" name={inputName} value={dataUrl ?? ""} />
      <input
        type="hidden"
        name={`${inputName}Scale`}
        value={dataUrl ? String(scale) : ""}
      />
    </div>
  );
}
