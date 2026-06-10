import { useMemo, useState } from "react";
import { SitterShell } from "@/components/sitter/SitterShell";
import { SitterPageHeader } from "@/components/sitter/SitterPageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import flyerCream from "@/assets/marketing/flyer-cream.png.asset.json";
import flyerYellow from "@/assets/marketing/flyer-yellow.png.asset.json";
import flyerOrange from "@/assets/marketing/flyer-orange.png.asset.json";
import flyerOrangeFrenchie from "@/assets/marketing/flyer-orange-frenchie.png.asset.json";
import flyerGreen from "@/assets/marketing/flyer-green.png.asset.json";
import businessCards from "@/assets/marketing/business-cards.png.asset.json";
import stickyCards from "@/assets/marketing/sticky-cards.png.asset.json";

type AssetKind = "flyer" | "card";

type MarketingAsset = {
  id: string;
  name: string;
  kind: AssetKind;
  url: string;
};

const ASSETS: MarketingAsset[] = [
  { id: "flyer-cream", name: "Flyer — Cream (Lab)", kind: "flyer", url: flyerCream.url },
  { id: "flyer-yellow", name: "Flyer — Yellow (Doberman)", kind: "flyer", url: flyerYellow.url },
  { id: "flyer-orange", name: "Flyer — Orange (Bulldog)", kind: "flyer", url: flyerOrange.url },
  { id: "flyer-orange-frenchie", name: "Flyer — Orange (Frenchie)", kind: "flyer", url: flyerOrangeFrenchie.url },
  { id: "flyer-green", name: "Flyer — Forest Green (Pomeranian)", kind: "flyer", url: flyerGreen.url },
  { id: "business-cards", name: "Business Cards", kind: "card", url: businessCards.url },
  { id: "sticky-cards", name: "Sticky Cards", kind: "card", url: stickyCards.url },
];

type SizePreset = {
  id: string;
  label: string;
  description: string;
  // longest-edge in pixels at 300 DPI
  pixels: number;
};

const FLYER_SIZES: SizePreset[] = [
  { id: "original", label: "Original (full resolution)", description: "Untouched source PNG", pixels: 0 },
  { id: "letter", label: "Letter / 8.5 × 11 in (300 DPI)", description: "3300 px longest edge — print ready", pixels: 3300 },
  { id: "a4", label: "A4 / 8.27 × 11.69 in (300 DPI)", description: "3508 px longest edge — print ready", pixels: 3508 },
  { id: "half-letter", label: "Half Letter / 5.5 × 8.5 in (300 DPI)", description: "2550 px longest edge", pixels: 2550 },
  { id: "5x7", label: "Postcard 5 × 7 in (300 DPI)", description: "2100 px longest edge", pixels: 2100 },
  { id: "web-lg", label: "Web — Large (1600 px)", description: "Email / website hero", pixels: 1600 },
  { id: "web-md", label: "Web — Medium (1080 px)", description: "Instagram post / story", pixels: 1080 },
  { id: "web-sm", label: "Web — Small (720 px)", description: "Thumbnails / previews", pixels: 720 },
];

const CARD_SIZES: SizePreset[] = [
  { id: "original", label: "Original (full resolution)", description: "Untouched source PNG", pixels: 0 },
  { id: "card-print", label: "Print sheet 3.5 × 2 in (300 DPI)", description: "1050 px longest edge per card", pixels: 3000 },
  { id: "card-print-bleed", label: "Print sheet w/ bleed (300 DPI)", description: "3300 px longest edge", pixels: 3300 },
  { id: "web-lg", label: "Web — Large (1600 px)", description: "Email / website hero", pixels: 1600 },
  { id: "web-md", label: "Web — Medium (1080 px)", description: "Social post", pixels: 1080 },
  { id: "web-sm", label: "Web — Small (720 px)", description: "Thumbnails", pixels: 720 },
];

type Format = "png" | "jpg";

async function downloadResized(
  sourceUrl: string,
  filenameBase: string,
  pixels: number,
  format: Format,
): Promise<void> {
  if (pixels === 0) {
    // Download original directly
    const res = await fetch(sourceUrl);
    const blob = await res.blob();
    triggerDownload(blob, `${filenameBase}-original.png`);
    return;
  }

  const img = await loadImage(sourceUrl);
  const longest = Math.max(img.naturalWidth, img.naturalHeight);
  const scale = pixels / longest;
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  // For JPG, fill white background so transparency doesn't go black
  if (format === "jpg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);

  const mime = format === "jpg" ? "image/jpeg" : "image/png";
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      mime,
      format === "jpg" ? 0.92 : undefined,
    ),
  );
  triggerDownload(blob, `${filenameBase}-${w}x${h}.${format}`);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function SitterMarketing() {
  const [selectedId, setSelectedId] = useState<string>(ASSETS[0].id);
  const [sizeId, setSizeId] = useState<string>("original");
  const [format, setFormat] = useState<Format>("png");
  const [downloading, setDownloading] = useState(false);

  const selected = useMemo(
    () => ASSETS.find((a) => a.id === selectedId) ?? ASSETS[0],
    [selectedId],
  );
  const sizeOptions = selected.kind === "flyer" ? FLYER_SIZES : CARD_SIZES;
  const size = sizeOptions.find((s) => s.id === sizeId) ?? sizeOptions[0];

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadResized(selected.url, selected.id, size.pixels, format);
      toast.success("Download started");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't generate the file. Try the original size.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <SitterShell>
      <SitterPageHeader title="Marketing assets" description="Pick a design, choose a size, download." />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Gallery */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {ASSETS.map((a) => {
            const active = a.id === selectedId;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setSelectedId(a.id);
                  setSizeId("original");
                }}
                className={
                  "group relative overflow-hidden rounded-lg border-2 bg-muted/40 text-left transition " +
                  (active
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-border hover:border-muted-foreground/40")
                }
              >
                <div className="aspect-[3/4] w-full overflow-hidden bg-white">
                  <img
                    src={a.url}
                    alt={a.name}
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="border-t bg-card px-2 py-1.5 text-xs font-medium">
                  {a.name}
                </div>
              </button>
            );
          })}
        </div>

        {/* Download panel */}
        <Card className="h-fit p-5 lg:sticky lg:top-4">
          <h2 className="text-lg font-semibold">{selected.name}</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Choose a size and format, then download.
          </p>

          <div className="space-y-4">
            <div>
              <Label htmlFor="size">Size</Label>
              <Select value={sizeId} onValueChange={setSizeId}>
                <SelectTrigger id="size" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sizeOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">{size.description}</p>
            </div>

            <div>
              <Label htmlFor="format">Format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
                <SelectTrigger id="format" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="png">PNG (best quality, larger file)</SelectItem>
                  <SelectItem value="jpg">JPG (smaller file, no transparency)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full"
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing…
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" /> Download
                </>
              )}
            </Button>

            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              <strong>Tip:</strong> For professional printing, use the 300 DPI presets. For
              email, social, or web, the Web sizes are plenty.
            </div>
          </div>
        </Card>
      </div>
    </SitterShell>
  );
}
