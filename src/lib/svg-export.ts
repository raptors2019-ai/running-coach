/**
 * Rasterize an on-screen <svg> to a PNG blob. The card is drawn entirely with
 * SVG primitives and no external references, so what the screen shows and what
 * gets posted are the same render — no second layout engine to keep in sync.
 */
export async function svgToPngBlob(
  svg: SVGSVGElement,
  width: number,
  height: number,
  scale = 1
): Promise<Blob> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  // Tailwind classes mean nothing once the node leaves the document.
  clone.removeAttribute("class");
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));

  const source = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml;charset=utf-8" }));

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not render the card"));
      img.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable on this device");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the image"))),
        "image/png"
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Hand the PNG to the OS share sheet, falling back to a download. */
export async function shareOrDownloadPng(blob: Blob, filename: string, text?: string) {
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return "shared" as const;
    } catch (e) {
      // A cancelled share sheet is not a failure worth reporting.
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled" as const;
    }
  }
  downloadBlob(blob, filename);
  return "downloaded" as const;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
