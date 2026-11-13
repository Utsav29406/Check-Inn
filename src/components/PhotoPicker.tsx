"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";

/** Longest side of an uploaded photo; big enough for the restaurant page hero on a desktop screen. */
const MAX_SIDE = 1600;

/** Shrinks a photo in the browser (so phone photos of 5–10 MB upload as about 300 KB) and returns a JPEG data URL. */
async function shrink(file: File): Promise<string> {
  const { image, width, height, done } = await decode(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
  done();
  return canvas.toDataURL("image/jpeg", 0.82);
}

/** createImageBitmap where the browser has it; an <img> otherwise (older iPhones). */
async function decode(file: File): Promise<{ image: CanvasImageSource; width: number; height: number; done: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return { image: bitmap, width: bitmap.width, height: bitmap.height, done: () => bitmap.close?.() };
    } catch {
      // Fall back to <img> below.
    }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
  return { image: img, width: img.naturalWidth, height: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
}

/**
 * A photo upload with a preview. The shrunk photo goes in a hidden `name` field as a data URL.
 * `current` shows a photo that's already saved (it's kept unless a new one is picked).
 */
export function PhotoPicker({ name, current, required = false }: { name: string; current?: string; required?: boolean }) {
  const [photo, setPhoto] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  const shown = photo || current;

  return (
    <div>
      <input type="hidden" name={name} value={photo} />
      <div className="flex items-center gap-4">
        <div className="relative grid h-24 w-32 shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-black/15 bg-sand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {shown ? <img src={shown} alt="Restaurant photo" className="h-full w-full object-cover" /> : <ImagePlus className="h-7 w-7 text-muted" />}
          {photo && (
            <button type="button" onClick={() => setPhoto("")} aria-label="Remove photo" className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="text-sm">
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3.5 py-2 font-semibold hover:border-brand-500 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {shown ? "Choose another photo" : "Upload a photo"}
          </button>
          <p className="mt-1 text-xs text-muted">A clear photo of the dining room or food. JPG, PNG or WebP.</p>
          {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        // Lets the browser's own "please fill in" message stop a form that needs a photo.
        required={required && !shown}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setError(undefined);
          setBusy(true);
          try {
            setPhoto(await shrink(file));
          } catch {
            setError("That photo couldn't be read. Try a JPG or PNG.");
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
