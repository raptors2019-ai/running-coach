import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import {
  STICKER_HEIGHT,
  STICKER_WIDTH,
  type StickerLayout,
} from "@/lib/route-overlay";
import { popState, stickerTimeline } from "@/lib/sticker-timeline";
import {
  StickerTileSvg,
  TOTALS_CARD,
  TotalsCardSvg,
  type StickerTotals,
} from "@/components/route-overlay-svg";

/**
 * Records the sticker pop-in as a video in the browser: each sticker is
 * rasterised once, then drawn frame by frame on a canvas whose stream feeds
 * a MediaRecorder. Black background, so a Screen blend in a video editor
 * drops it and leaves the stickers over footage.
 */

const RECORDER_MIMES = [
  "video/mp4;codecs=avc1.42E01E",
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

export function pickRecorderMime(isSupported: (mime: string) => boolean): string | null {
  return RECORDER_MIMES.find((m) => isSupported(m)) ?? null;
}

export function extensionForMime(mime: string): string {
  return mime.startsWith("video/mp4") ? "mp4" : "webm";
}

function svgImage(markup: string): Promise<HTMLImageElement> {
  // Fonts referenced by CSS variables don't resolve inside an <img>; use the fallbacks.
  const svg = markup.replace(/var\(--font-geist-sans\), /g, "");
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not rasterise a sticker"));
    };
    img.src = url;
  });
}

export interface RecordStickerVideoOptions {
  layout: StickerLayout;
  totals?: StickerTotals;
  fps?: number;
  onProgress?: (fraction: number) => void;
}

export interface RecordedVideo {
  blob: Blob;
  extension: string;
  seconds: number;
}

export async function recordStickerVideo({
  layout,
  totals,
  fps = 30,
  onProgress,
}: RecordStickerVideoOptions): Promise<RecordedVideo> {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("This browser can't record video. Try Chrome or Safari 14.5+.");
  }
  const mime = pickRecorderMime((m) => MediaRecorder.isTypeSupported(m));
  if (!mime) throw new Error("This browser can't record MP4 or WebM video.");

  const tiles = await Promise.all(
    layout.stickers.map((s) => svgImage(renderToStaticMarkup(createElement(StickerTileSvg, { sticker: s }))))
  );
  const card = totals ? await svgImage(renderToStaticMarkup(createElement(TotalsCardSvg, { totals }))) : null;

  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");

  const timeline = stickerTimeline(layout.stickers.length, Boolean(totals));
  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const drawAt = (t: number) => {
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    layout.stickers.forEach((s, i) => {
      const pop = popState(t, timeline.startOf(i));
      if (pop.opacity <= 0) return;
      const w = STICKER_WIDTH * s.scale * pop.scale;
      const h = STICKER_HEIGHT * s.scale * pop.scale;
      const cx = s.x + (STICKER_WIDTH * s.scale) / 2;
      const cy = s.y + (STICKER_HEIGHT * s.scale) / 2;
      ctx.globalAlpha = pop.opacity;
      ctx.drawImage(tiles[i], cx - w / 2, cy - h / 2, w, h);
    });
    if (card && timeline.totalsAt !== null) {
      const pop = popState(t, timeline.totalsAt);
      if (pop.opacity > 0) {
        const w = TOTALS_CARD.width * pop.scale;
        const h = TOTALS_CARD.height * pop.scale;
        const cx = TOTALS_CARD.x + TOTALS_CARD.width / 2;
        const cy = TOTALS_CARD.y + TOTALS_CARD.height / 2;
        ctx.globalAlpha = pop.opacity;
        ctx.drawImage(card, cx - w / 2, cy - h / 2, w, h);
      }
    }
    ctx.globalAlpha = 1;
  };

  drawAt(0);
  return new Promise<RecordedVideo>((resolve, reject) => {
    recorder.onerror = () => reject(new Error("Recording failed"));
    recorder.onstop = () => {
      resolve({ blob: new Blob(chunks, { type: mime }), extension: extensionForMime(mime), seconds: timeline.end });
    };
    recorder.start(250);
    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      drawAt(Math.min(t, timeline.end));
      onProgress?.(Math.min(1, t / timeline.end));
      if (t < timeline.end) {
        requestAnimationFrame(tick);
      } else {
        recorder.stop();
        stream.getTracks().forEach((track) => track.stop());
      }
    };
    requestAnimationFrame(tick);
  });
}
