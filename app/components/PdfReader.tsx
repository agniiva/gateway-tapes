"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";

type PdfReaderProps = {
  waveId: string;
  label: string;
  pages: number;
  miniPlayerVisible: boolean;
  onClose: () => void;
};

const ZOOM_LEVELS = [1, 1.35, 1.7, 2];

export default function PdfReader({ waveId, label, pages, miniPlayerVisible, onClose }: PdfReaderProps) {
  // The first scan's left half is the blank back cover; open on the titled front cover.
  const [position, setPosition] = useState(1);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [loadedSrc, setLoadedSrc] = useState("");
  const [failedSrc, setFailedSrc] = useState("");
  const [layoutTick, setLayoutTick] = useState(0);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const readerRef = useRef<HTMLElement | null>(null);
  const gestureStart = useRef<{ x: number; y: number } | null>(null);

  const totalPages = pages * 2 - 1;
  const spreadPage = Math.floor(position / 2) + 1;
  const side = position % 2;
  const src = `/api/manual-page/${waveId}/${spreadPage}`;
  const ready = loadedSrc === src;
  const failed = failedSrc === src;

  const alignPage = useCallback(() => {
    window.requestAnimationFrame(() => {
      const stage = stageRef.current;
      const image = imageRef.current;
      if (!stage || !image) return;
      const imageWidth = image.getBoundingClientRect().width;
      const target = side === 0 ? image.offsetLeft : image.offsetLeft + imageWidth / 2;
      stage.scrollTo({ left: Math.round(target), top: 0 });
    });
  }, [side]);

  const goTo = useCallback((next: number) => {
    setPosition(Math.min(totalPages, Math.max(1, next)));
  }, [totalPages]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(() => setLayoutTick((value) => value + 1));
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (ready) alignPage();
  }, [alignPage, layoutTick, ready, zoomIndex]);

  useEffect(() => {
    if (spreadPage >= pages) return;
    const next = new Image();
    next.src = `/api/manual-page/${waveId}/${spreadPage + 1}`;
  }, [pages, spreadPage, waveId]);

  useEffect(() => {
    readerRef.current?.focus();
  }, []);

  const pageStyle = {
    "--page-zoom": ZOOM_LEVELS[zoomIndex],
  } as CSSProperties;

  return (
    <section
      ref={readerRef}
      className={`pdf-reader ${miniPlayerVisible ? "with-mini-player" : ""}`}
      aria-label={`${label} manual`}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") goTo(position - 1);
        if (event.key === "ArrowRight") goTo(position + 1);
        if (event.key === "Escape") onClose();
      }}
    >
      <header className="pdf-header">
        <button aria-label="Close manual" onClick={onClose}><ArrowLeft /></button>
        <div><small>MANUAL</small><b>{label}</b></div>
        <span>{position}/{totalPages}</span>
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
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) goTo(position + (dx < 0 ? 1 : -1));
        }}
        onPointerCancel={() => { gestureStart.current = null; }}
      >
        {!ready && !failed && <p className="pdf-status">OPENING PAGE</p>}
        {failed && <p className="pdf-status">PAGE UNAVAILABLE</p>}
        <div className={`pdf-spread ${ready ? "visible" : ""}`} style={pageStyle}>
          {/* The private page endpoint already serves a pre-sized, optimized JPEG. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imageRef}
            src={src}
            alt={`${label}, page ${position} of ${totalPages}`}
            draggable={false}
            onLoad={() => { setFailedSrc(""); setLoadedSrc(src); alignPage(); }}
            onError={() => setFailedSrc(src)}
          />
        </div>
      </div>

      <nav className="pdf-controls" aria-label="Manual controls">
        <button aria-label="Previous page" disabled={position <= 1} onClick={() => goTo(position - 1)}><ChevronLeft /></button>
        <div className="pdf-zoom">
          <button aria-label="Zoom out" disabled={zoomIndex === 0} onClick={() => setZoomIndex((value) => Math.max(0, value - 1))}><Minus /></button>
          <span>{Math.round(ZOOM_LEVELS[zoomIndex] * 100)}%</span>
          <button aria-label="Zoom in" disabled={zoomIndex === ZOOM_LEVELS.length - 1} onClick={() => setZoomIndex((value) => Math.min(ZOOM_LEVELS.length - 1, value + 1))}><Plus /></button>
        </div>
        <button aria-label="Next page" disabled={position >= totalPages} onClick={() => goTo(position + 1)}><ChevronRight /></button>
      </nav>
    </section>
  );
}
