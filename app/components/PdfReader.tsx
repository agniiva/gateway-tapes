"use client";

import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";

type PdfReaderProps = {
  waveId: string;
  label: string;
  miniPlayerVisible: boolean;
  onClose: () => void;
};

const ZOOM_LEVELS = [1, 1.25, 1.5, 2];

export default function PdfReader({ waveId, label, miniPlayerVisible, onClose }: PdfReaderProps) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [layoutTick, setLayoutTick] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const readerRef = useRef<HTMLElement | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const gestureStart = useRef<{ x: number; y: number } | null>(null);

  const goTo = useCallback((next: number) => {
    if (!document) return;
    setPageNumber(Math.min(document.numPages, Math.max(1, next)));
    stageRef.current?.scrollTo({ top: 0, left: 0 });
  }, [document]);

  useEffect(() => {
    let disposed = false;
    let loadingTask: ReturnType<typeof import("pdfjs-dist")["getDocument"]> | null = null;

    void import("pdfjs-dist").then((pdfjs) => {
      if (disposed) return;
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      loadingTask = pdfjs.getDocument({ url: `/api/manual/${waveId}`, rangeChunkSize: 128 * 1024 });
      return loadingTask.promise;
    }).then((loaded) => {
      if (!loaded || disposed) return;
      setDocument(loaded);
      setStatus("ready");
    }).catch(() => {
      if (!disposed) setStatus("error");
    });

    return () => {
      disposed = true;
      void loadingTask?.destroy();
    };
  }, [waveId]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(() => setLayoutTick((value) => value + 1));
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!document || !canvasRef.current || !stageRef.current) return;
    let disposed = false;

    void document.getPage(pageNumber).then((page) => {
      if (disposed || !canvasRef.current || !stageRef.current) return;
      const natural = page.getViewport({ scale: 1 });
      const stage = stageRef.current;
      const fitScale = Math.min(
        Math.max(0.1, (stage.clientWidth - 24) / natural.width),
        Math.max(0.1, (stage.clientHeight - 24) / natural.height),
      );
      const viewport = page.getViewport({ scale: fitScale * ZOOM_LEVELS[zoomIndex] });
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Canvas unavailable");

      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = page.render({
        canvas,
        canvasContext: context,
        viewport,
        transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
      });
      return renderTaskRef.current.promise;
    }).catch((error: unknown) => {
      if (!disposed && (error as { name?: string })?.name !== "RenderingCancelledException") setStatus("error");
    });

    return () => {
      disposed = true;
      renderTaskRef.current?.cancel();
    };
  }, [document, layoutTick, pageNumber, zoomIndex]);

  useEffect(() => {
    readerRef.current?.focus();
  }, []);

  return (
    <section
      ref={readerRef}
      className={`pdf-reader ${miniPlayerVisible ? "with-mini-player" : ""}`}
      aria-label={`${label} manual`}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") goTo(pageNumber - 1);
        if (event.key === "ArrowRight") goTo(pageNumber + 1);
        if (event.key === "Escape") onClose();
      }}
    >
      <header className="pdf-header">
        <button aria-label="Close manual" onClick={onClose}><ArrowLeft /></button>
        <div><small>MANUAL</small><b>{label}</b></div>
        <span>{document ? `${pageNumber}/${document.numPages}` : "—"}</span>
      </header>

      <div
        ref={stageRef}
        className={`pdf-stage ${zoomIndex > 0 ? "is-zoomed" : ""}`}
        onPointerDown={(event) => { gestureStart.current = { x: event.clientX, y: event.clientY }; }}
        onPointerUp={(event) => {
          const start = gestureStart.current;
          gestureStart.current = null;
          if (!start || zoomIndex > 0) return;
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) goTo(pageNumber + (dx < 0 ? 1 : -1));
        }}
        onPointerCancel={() => { gestureStart.current = null; }}
      >
        {status === "loading" && <p className="pdf-status">OPENING MANUAL</p>}
        {status === "error" && <p className="pdf-status">MANUAL UNAVAILABLE</p>}
        <canvas ref={canvasRef} className={status === "ready" ? "visible" : ""} />
      </div>

      <nav className="pdf-controls" aria-label="Manual controls">
        <button aria-label="Previous page" disabled={pageNumber <= 1} onClick={() => goTo(pageNumber - 1)}><ChevronLeft /></button>
        <div className="pdf-zoom">
          <button aria-label="Zoom out" disabled={zoomIndex === 0} onClick={() => setZoomIndex((value) => Math.max(0, value - 1))}><Minus /></button>
          <span>{Math.round(ZOOM_LEVELS[zoomIndex] * 100)}%</span>
          <button aria-label="Zoom in" disabled={zoomIndex === ZOOM_LEVELS.length - 1} onClick={() => setZoomIndex((value) => Math.min(ZOOM_LEVELS.length - 1, value + 1))}><Plus /></button>
        </div>
        <button aria-label="Next page" disabled={!document || pageNumber >= document.numPages} onClick={() => goTo(pageNumber + 1)}><ChevronRight /></button>
      </nav>
    </section>
  );
}
