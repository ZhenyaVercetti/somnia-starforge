"""Generate additive combat VFX sprites (white, tintable, premultiplied-looking)."""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageFilter

OUT = Path(__file__).resolve().parents[1] / "frontend" / "public" / "assets" / "fx"
OUT.mkdir(parents=True, exist_ok=True)


def new(w: int, h: int) -> Image.Image:
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def add_blob(img: Image.Image, cx: float, cy: float, rx: float, ry: float, rgb: tuple[int, int, int], peak: int) -> None:
    w, h = img.size
    px = img.load()
    x0 = max(0, int(cx - rx - 1))
    x1 = min(w - 1, int(cx + rx + 1))
    y0 = max(0, int(cy - ry - 1))
    y1 = min(h - 1, int(cy + ry + 1))
    rx = max(0.5, rx)
    ry = max(0.5, ry)
    for y in range(y0, y1 + 1):
        ny = (y + 0.5 - cy) / ry
        for x in range(x0, x1 + 1):
            nx = (x + 0.5 - cx) / rx
            d = nx * nx + ny * ny
            if d >= 1.0:
                continue
            # Smooth cubic falloff — hot core, soft bloom
            t = 1.0 - d
            a = int(peak * t * t * (3.0 - 2.0 * t))
            if a <= 0:
                continue
            r, g, b, oa = px[x, y]
            na = min(255, oa + a - (oa * a) // 255)
            if na <= 0:
                continue
            inv = 1.0 / na
            px[x, y] = (
                min(255, int((r * oa + rgb[0] * a) * inv)),
                min(255, int((g * oa + rgb[1] * a) * inv)),
                min(255, int((b * oa + rgb[2] * a) * inv)),
                na,
            )


def save(img: Image.Image, name: str) -> None:
    path = OUT / name
    img.save(path, "PNG")
    print("wrote", path.name, img.size)


def bolt() -> None:
    # 160x48, points +X. Soft body + white needle + hotter tip.
    img = new(160, 48)
    cx, cy = 86, 24
    add_blob(img, cx, cy, 78, 18, (160, 210, 255), 70)
    add_blob(img, cx + 6, cy, 62, 10, (210, 235, 255), 150)
    add_blob(img, cx + 10, cy, 50, 4.2, (255, 255, 255), 255)
    add_blob(img, 138, cy, 16, 6, (255, 255, 255), 255)
    add_blob(img, 146, cy, 8, 8, (255, 255, 255), 180)
    save(img.filter(ImageFilter.GaussianBlur(radius=0.6)), "bolt.png")


def needle() -> None:
    img = new(64, 20)
    cy = 10
    add_blob(img, 34, cy, 28, 7, (180, 220, 255), 80)
    add_blob(img, 36, cy, 22, 3.2, (255, 255, 255), 255)
    add_blob(img, 54, cy, 7, 3.4, (255, 255, 255), 220)
    save(img, "needle.png")


def slug() -> None:
    img = new(192, 64)
    cx, cy = 108, 32
    add_blob(img, cx, cy, 92, 26, (180, 200, 255), 60)
    add_blob(img, cx + 8, cy, 70, 14, (230, 240, 255), 160)
    add_blob(img, cx + 16, cy, 52, 6, (255, 255, 255), 255)
    add_blob(img, 168, cy, 20, 10, (255, 255, 255), 255)
    add_blob(img, 176, cy, 12, 12, (255, 255, 255), 170)
    save(img.filter(ImageFilter.GaussianBlur(radius=0.5)), "slug.png")


def beam_core() -> None:
    img = new(256, 16)
    for x in range(256):
        edge = min(x / 10.0, (255 - x) / 18.0, 1.0)
        for y in range(16):
            ny = abs(y + 0.5 - 8) / 8.0
            t = max(0.0, 1.0 - ny * ny)
            a = int(255 * t * t * edge)
            img.putpixel((x, y), (255, 255, 255, a))
    save(img, "beam_core.png")


def beam_soft() -> None:
    img = new(256, 48)
    for x in range(256):
        edge = min(x / 16.0, (255 - x) / 24.0, 1.0)
        for y in range(48):
            ny = abs(y + 0.5 - 24) / 24.0
            t = max(0.0, 1.0 - ny)
            a = int(120 * (t ** 2.2) * edge)
            img.putpixel((x, y), (210, 230, 255, a))
    save(img.filter(ImageFilter.GaussianBlur(radius=1.2)), "beam_soft.png")


def muzzle() -> None:
    img = new(96, 96)
    add_blob(img, 48, 48, 46, 46, (180, 220, 255), 70)
    add_blob(img, 48, 48, 28, 28, (230, 245, 255), 160)
    add_blob(img, 48, 48, 12, 12, (255, 255, 255), 255)
    # directional spikes along +X so rotation reads as a gun flash
    add_blob(img, 70, 48, 22, 6, (255, 255, 255), 200)
    add_blob(img, 48, 30, 6, 16, (230, 245, 255), 110)
    add_blob(img, 48, 66, 6, 16, (230, 245, 255), 110)
    save(img.filter(ImageFilter.GaussianBlur(radius=0.7)), "muzzle.png")


def impact() -> None:
    img = new(128, 128)
    add_blob(img, 64, 64, 60, 60, (180, 220, 255), 55)
    add_blob(img, 64, 64, 34, 34, (230, 245, 255), 150)
    add_blob(img, 64, 64, 12, 12, (255, 255, 255), 255)
    # radial spikes
    for i in range(8):
        a = i * math.pi / 4
        add_blob(img, 64 + math.cos(a) * 28, 64 + math.sin(a) * 28, 16, 5.5, (255, 255, 255), 140)
    save(img.filter(ImageFilter.GaussianBlur(radius=0.6)), "impact.png")


def ring() -> None:
    img = new(128, 128)
    px = img.load()
    cx = cy = 63.5
    for y in range(128):
        for x in range(128):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            band = abs(d - 46)
            if band > 10:
                continue
            t = 1.0 - band / 10.0
            a = int(210 * t * t)
            px[x, y] = (230, 245, 255, a)
    save(img.filter(ImageFilter.GaussianBlur(radius=1.0)), "ring.png")


def trail() -> None:
    img = new(48, 48)
    add_blob(img, 24, 24, 22, 22, (200, 230, 255), 90)
    add_blob(img, 24, 24, 10, 10, (255, 255, 255), 200)
    save(img.filter(ImageFilter.GaussianBlur(radius=0.8)), "trail.png")


def spark() -> None:
    img = new(24, 24)
    add_blob(img, 12, 12, 3.2, 10, (255, 255, 255), 255)
    add_blob(img, 12, 12, 10, 3.2, (255, 255, 255), 255)
    add_blob(img, 12, 12, 3, 3, (255, 255, 255), 255)
    save(img, "spark.png")


def charge() -> None:
    img = new(80, 80)
    add_blob(img, 40, 40, 36, 36, (180, 220, 255), 50)
    add_blob(img, 40, 40, 18, 18, (230, 245, 255), 140)
    add_blob(img, 40, 40, 7, 7, (255, 255, 255), 255)
    save(img.filter(ImageFilter.GaussianBlur(radius=0.5)), "charge.png")


def cap() -> None:
    # beam end-cap
    img = new(64, 64)
    add_blob(img, 32, 32, 28, 16, (210, 235, 255), 120)
    add_blob(img, 32, 32, 12, 12, (255, 255, 255), 255)
    save(img, "cap.png")


if __name__ == "__main__":
    bolt()
    needle()
    slug()
    beam_core()
    beam_soft()
    muzzle()
    impact()
    ring()
    trail()
    spark()
    charge()
    cap()
    print("done", OUT)
