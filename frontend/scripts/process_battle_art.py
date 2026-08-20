from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageEnhance, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SESSION = Path(
    r"C:\Users\ввввв\.grok\sessions\C%3A%5CProjects%5Csomnia-starforge\01a01e63-1a38-7053-a99d-c4625a4b5422\images"
)
DRONES = ROOT / "public" / "assets" / "units" / "drones"
WEAPONS = ROOT / "public" / "assets" / "units" / "weapons"
FX = ROOT / "public" / "assets" / "fx"
PORTRAITS = ROOT / "public" / "assets" / "units" / "portraits"
COMBAT = ROOT / "public" / "assets" / "units" / "combat"
DESTROYED = ROOT / "public" / "assets" / "units" / "destroyed"


def key_sprite(src: Path, dst: Path, size: int = 512, floor: int = 18, soft: int = 26) -> None:
    im = Image.open(src).convert("RGBA")
    im = im.resize((size, size), Image.Resampling.LANCZOS)
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, _a = px[x, y]
            peak = max(r, g, b)
            mean = (r + g + b) / 3
            if peak < floor:
                alpha = 0
            elif peak < floor + soft and mean < floor + soft:
                alpha = int(255 * (peak - floor) / soft)
            else:
                alpha = 255
            px[x, y] = (r, g, b, alpha)
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, "PNG")


def key_fx(src: Path, dst: Path, size: tuple[int, int]) -> None:
    im = Image.open(src).convert("RGBA")
    im = im.resize(size, Image.Resampling.LANCZOS)
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, _a = px[x, y]
            lum = int(0.28 * r + 0.5 * g + 0.22 * b)
            alpha = min(255, int(lum * 1.45))
            px[x, y] = (r, g, b, alpha)
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, "PNG")


def wreck(src: Path, dst: Path, size: int = 360) -> None:
    im = Image.open(src).convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)
    rgb = ImageOps.grayscale(im).convert("RGB")
    rgb = ImageEnhance.Brightness(rgb).enhance(0.62)
    rgb = ImageEnhance.Contrast(rgb).enhance(1.08)
    out = Image.merge("RGBA", (*rgb.split(), im.split()[3]))
    dst.parent.mkdir(parents=True, exist_ok=True)
    out.save(dst, "PNG")


def composite_swarm(drone_paths: list[Path], dst: Path, size: int = 360) -> None:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    layout = [
        (0.50, 0.40, 0.44),
        (0.26, 0.26, 0.34),
        (0.74, 0.32, 0.33),
        (0.34, 0.64, 0.36),
        (0.68, 0.60, 0.31),
        (0.52, 0.16, 0.28),
        (0.18, 0.48, 0.30),
    ]
    for i, (nx, ny, sc) in enumerate(layout):
        src = Image.open(drone_paths[i % len(drone_paths)]).convert("RGBA")
        dw = max(8, int(size * sc))
        src = src.resize((dw, dw), Image.Resampling.LANCZOS)
        x = int(nx * size - dw / 2)
        y = int(ny * size - dw / 2)
        canvas.alpha_composite(src, (x, y))
    dst.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(dst, "PNG")


def main() -> None:
    DRONES.mkdir(parents=True, exist_ok=True)
    WEAPONS.mkdir(parents=True, exist_ok=True)

    drones = {
        "emperial_0": SESSION / "1.jpg",
        "emperial_1": SESSION / "7.jpg",
        "emperial_2": SESSION / "25.jpg",
        "emperial_3": SESSION / "6.jpg",
        "voidborn_0": SESSION / "3.jpg",
        "voidborn_1": SESSION / "2.jpg",
        "voidborn_2": SESSION / "5.jpg",
        "voidborn_3": SESSION / "8.jpg",
        "mechanoid_0": SESSION / "10.jpg",
        "mechanoid_1": SESSION / "11.jpg",
        "mechanoid_2": SESSION / "27.jpg",
        "mechanoid_3": SESSION / "9.jpg",
    }
    for name, src in drones.items():
        out = DRONES / f"{name}.png"
        key_sprite(src, out, 512)
        wreck(out, DRONES / f"{name}_destroyed.png", 512)
        print("drone", name, out.stat().st_size)

    weapons = {
        "emperial_fighter": SESSION / "19.jpg",
        "emperial_cruiser": SESSION / "16.jpg",
        "emperial_dreadnought": SESSION / "18.jpg",
        "voidborn_fighter": SESSION / "17.jpg",
        "voidborn_cruiser": SESSION / "13.jpg",
        "voidborn_dreadnought": SESSION / "15.jpg",
        "mechanoid_fighter": SESSION / "20.jpg",
        "mechanoid_cruiser": SESSION / "14.jpg",
        "mechanoid_dreadnought": SESSION / "28.jpg",
    }
    for name, src in weapons.items():
        out = WEAPONS / f"{name}.png"
        key_sprite(src, out, 512, floor=16, soft=24)
        print("weapon", name, out.stat().st_size)

    fx = {
        "shot_bolt": (SESSION / "22.jpg", (1024, 512)),
        "shot_needle": (SESSION / "23.jpg", (1024, 512)),
        "shot_slug": (SESSION / "24.jpg", (1024, 512)),
        "shot_muzzle": (SESSION / "21.jpg", (512, 512)),
        "shot_impact": (SESSION / "26.jpg", (512, 512)),
    }
    for name, (src, size) in fx.items():
        out = FX / f"{name}.png"
        key_fx(src, out, size)
        print("fx", name, out.stat().st_size)

    for faction in ("emperial", "voidborn", "mechanoid"):
        paths = [DRONES / f"{faction}_{i}.png" for i in range(4)]
        portrait = PORTRAITS / f"{faction}_droneswarm.png"
        combat = COMBAT / f"{faction}_droneswarm.png"
        composite_swarm(paths, portrait, 360)
        composite_swarm(paths, combat, 512)
        wreck(portrait, DESTROYED / f"{faction}_droneswarm_destroyed.png", 360)
        wreck(combat, COMBAT / f"{faction}_droneswarm_destroyed.png", 512)
        print("swarm", faction)

    for raw in DRONES.glob("_raw_*.jpg"):
        raw.unlink()
        print("removed", raw.name)


if __name__ == "__main__":
    main()
