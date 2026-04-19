"use client";

import { useEffect, useRef, useState } from "react";

const TOTAL_FRAMES = 294;
const FRAME_PATH = (n: number) =>
  `/segment2/ezgif-frame-${String(n).padStart(3, "0")}.jpg`;

export function ScrollAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const frameIndexRef = useRef(1);
  const rafRef = useRef<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Preload all frames
  useEffect(() => {
    let loadedCount = 0;
    const images: HTMLImageElement[] = new Array(TOTAL_FRAMES);

    for (let i = 1; i <= TOTAL_FRAMES; i++) {
      const img = new Image();
      const idx = i;
      img.src = FRAME_PATH(idx);
      img.onload = () => {
        images[idx - 1] = img;
        loadedCount++;
        if (loadedCount === TOTAL_FRAMES) {
          imagesRef.current = images;
          setLoaded(true);
          renderFrame(1, images);
        }
      };
    }
  }, []);

  function renderFrame(index: number, images?: HTMLImageElement[]) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const imgs = images ?? imagesRef.current;
    const img = imgs[index - 1];
    if (!img?.complete) return;

    // Resize canvas to fill window
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Cover-fit: draw image centred and scaled to fill
    const scale = Math.max(
      canvas.width / img.naturalWidth,
      canvas.height / img.naturalHeight
    );
    const sw = img.naturalWidth * scale;
    const sh = img.naturalHeight * scale;
    const sx = (canvas.width - sw) / 2;
    const sy = (canvas.height - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh);
  }

  // Scroll → frame mapping (entire page)
  useEffect(() => {
    if (!loaded) return;

    const onScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const scrolled = window.scrollY;
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const p = maxScroll > 0 ? Math.min(Math.max(scrolled / maxScroll, 0), 1) : 0;

        const frameIndex = Math.min(
          Math.max(Math.round(p * (TOTAL_FRAMES - 1)) + 1, 1),
          TOTAL_FRAMES
        );

        if (frameIndex !== frameIndexRef.current) {
          frameIndexRef.current = frameIndex;
          renderFrame(frameIndex);
        }
      });
    };

    const onResize = () => renderFrame(frameIndexRef.current);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [loaded]);

  return (
    <>
      {/* Fixed background canvas */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full object-cover pointer-events-none"
        style={{
          zIndex: 0,
          opacity: loaded ? 1 : 0,
          transition: "opacity 0.6s ease",
        }}
      />

      {/* Dark overlay so content remains readable */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 1,
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.55) 50%, rgba(0,0,0,0.7) 100%)",
        }}
      />

      {/* Loading screen */}
      {!loaded && (
        <div
          className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-4"
          style={{ zIndex: 100 }}
        >
          <div className="w-12 h-12 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
          <p className="text-xs font-mono text-zinc-100 tracking-widest">
            LOADING SEQUENCE...
          </p>
        </div>
      )}
    </>
  );
}
