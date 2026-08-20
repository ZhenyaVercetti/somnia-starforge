from pathlib import Path

from PIL import Image
import numpy as np

IMG = Path(r"C:\Users\ввввв\.grok\sessions\C%3A%5CProjects%5Csomnia-starforge\01a01c2a-08a7-7002-b0d1-79668df7bd9a\images")
FX = Path(r"C:\Projects\somnia-starforge\frontend\public\assets\fx")
BG = Path(r"C:\Projects\somnia-starforge\frontend\public\assets\background")
COMBAT = Path(r"C:\Projects\somnia-starforge\frontend\public\assets\units\combat")
FX.mkdir(parents=True, exist_ok=True)
BG.mkdir(parents=True, exist_ok=True)
COMBAT.mkdir(parents=True, exist_ok=True)

FX_MAP = {
    "1.jpg": "vfx_bolt.png",
    "2.jpg": "vfx_muzzle.png",
    "3.jpg": "vfx_needle.png",
    "4.jpg": "vfx_impact.png",
    "5.jpg": "vfx_ring.png",
    "7.jpg": "vfx_slug.png",
    "8.jpg": "vfx_shield.png",
    "9.jpg": "vfx_explode_01.png",
    "26.jpg": "vfx_explode_02.png",
    "27.jpg": "vfx_explode_03.png",
}

WRECK_MAP = {
    "21.jpg": "emperial_fighter_destroyed.png",
    "16.jpg": "emperial_cruiser_destroyed.png",
    "19.jpg": "emperial_dreadnought_destroyed.png",
    "17.jpg": "emperial_droneswarm_destroyed.png",
    "18.jpg": "voidborn_fighter_destroyed.png",
    "14.jpg": "voidborn_cruiser_destroyed.png",
    "15.jpg": "voidborn_dreadnought_destroyed.png",
    "20.jpg": "voidborn_droneswarm_destroyed.png",
    "24.jpg": "mechanoid_fighter_destroyed.png",
    "25.jpg": "mechanoid_cruiser_destroyed.png",
    "22.jpg": "mechanoid_dreadnought_destroyed.png",
    "23.jpg": "mechanoid_droneswarm_destroyed.png",
}

GENERIC_MAP = {
    "11.jpg": "generic_fighter.png",
    "12.jpg": "generic_cruiser.png",
    "13.jpg": "generic_dreadnought.png",
    "10.jpg": "generic_droneswarm.png",
}


def key_magenta(im: Image.Image, crop: bool = True) -> Image.Image:
    arr = np.array(im.convert("RGBA"))
    r = arr[:, :, 0].astype(np.int16)
    g = arr[:, :, 1].astype(np.int16)
    b = arr[:, :, 2].astype(np.int16)
    dist = (r - 255) ** 2 + (g - 0) ** 2 + (b - 255) ** 2
    mask = dist < 16000
    near = (dist < 24000) & (r > 150) & (b > 130) & (g < 170)
    arr[mask, 3] = 0
    fade = np.clip(((dist - 9000) * 255) / 15000, 0, 255).astype(np.uint8)
    arr[near & ~mask, 3] = np.minimum(arr[near & ~mask, 3], fade[near & ~mask])
    arr[arr[:, :, 3] == 0, 0:3] = 0
    out = Image.fromarray(arr, "RGBA")
    if not crop:
        return out
    bbox = out.getbbox()
    if not bbox:
        return out
    pad = 12
    left, top, right, bottom = bbox
    return out.crop((
        max(0, left - pad),
        max(0, top - pad),
        min(out.width, right + pad),
        min(out.height, bottom + pad)
    ))


def copy_png(src_name: str, dest: Path) -> None:
    src = IMG / src_name
    if not src.exists():
        print(f"missing {src}")
        return
    Image.open(src).convert("RGB").save(dest)
    print(f"wrote {dest.name}")


def main() -> None:
    copy_png("6.jpg", BG / "battle_void.jpg")
    for src_name, dest_name in FX_MAP.items():
        copy_png(src_name, FX / dest_name)
    for src_name, dest_name in WRECK_MAP.items():
        src = IMG / src_name
        if not src.exists():
            print(f"missing wreck {src}")
            continue
        keyed = key_magenta(Image.open(src))
        keyed.save(COMBAT / dest_name)
        print(f"wreck {dest_name} {keyed.size}")
    for src_name, dest_name in GENERIC_MAP.items():
        src = IMG / src_name
        if not src.exists():
            print(f"missing generic {src}")
            continue
        keyed = key_magenta(Image.open(src))
        keyed.save(COMBAT / dest_name)
        print(f"generic {dest_name} {keyed.size}")


if __name__ == "__main__":
    main()
