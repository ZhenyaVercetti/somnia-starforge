# Resize interface PNGs to ~2x on-screen size and strip chroma-key leftovers.
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1] / "frontend" / "public" / "assets"

# Native pixel size after optimize. Display size in game stays the same via setDisplaySize.
TARGETS = {
    "button_base.png": (512, 200),
    "button_start.png": (800, 264),
    "preview_frame.png": (440, 680),
    "profile_frame.png": (680, 344),
    "slot_team.png": (224, 224),
    "slot_ai.png": (160, 160),
    "slot_equipped.png": (192, 192),
    "slot_shop.png": (192, 192),
    "background/logo.png": (480, 216),
}

# Same pixel size — only clean + recompress.
KEEP = [
    "collection_frame.png",
    "outer_frame.png",
]


def clean_rgba(arr: np.ndarray) -> np.ndarray:
    out = arr.copy()
    alpha = out[:, :, 3]
    rgb = out[:, :, :3].astype(np.float32)

    rgb[alpha == 0] = 0

    green = rgb[:, :, 1]
    red_blue = np.maximum(rgb[:, :, 0], rgb[:, :, 2])
    excess = green - red_blue
    spill = (excess > 10) & (alpha < 250)
    rgb[:, :, 1] = np.where(spill, red_blue + 6, green)

    out[:, :, :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    return out


def save_png(image: Image.Image, path: Path, colors: int = 96) -> None:
    quantized = image.quantize(colors=colors, method=Image.Quantize.FASTOCTREE)
    quantized.save(path, format="PNG", optimize=True, compress_level=9)


def process(rel: str, size: tuple[int, int] | None) -> None:
    path = ROOT / rel
    source = Image.open(path).convert("RGBA")
    before = path.stat().st_size
    cleaned = Image.fromarray(clean_rgba(np.array(source)), "RGBA")
    if size and cleaned.size != size:
        cleaned = cleaned.resize(size, Image.Resampling.LANCZOS)
        cleaned = cleaned.filter(ImageFilter.UnsharpMask(radius=0.7, percent=60, threshold=2))
        cleaned = Image.fromarray(clean_rgba(np.array(cleaned)), "RGBA")
    save_png(cleaned, path)
    after = path.stat().st_size
    print(
        f"{rel:28} {source.size[0]}x{source.size[1]:>4} -> "
        f"{cleaned.size[0]}x{cleaned.size[1]:<4}  "
        f"{before/1024:7.1f} KB -> {after/1024:6.1f} KB"
    )


def main() -> None:
    for rel, size in TARGETS.items():
        process(rel, size)
    for rel in KEEP:
        process(rel, None)


if __name__ == "__main__":
    main()
