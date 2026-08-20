from pathlib import Path

from PIL import Image
import numpy as np

IMG = Path(r"C:\Users\ввввв\.grok\sessions\C%3A%5CProjects%5Csomnia-starforge\01a01c2a-08a7-7002-b0d1-79668df7bd9a\images")
COMBAT = Path(r"C:\Projects\somnia-starforge\frontend\public\assets\units\combat")
BG = Path(r"C:\Projects\somnia-starforge\frontend\public\assets\background")
COMBAT.mkdir(parents=True, exist_ok=True)

LIVE = {
    "29.jpg": "emperial_fighter.png",
    "33.jpg": "emperial_cruiser.png",
    "32.jpg": "emperial_dreadnought.png",
    "34.jpg": "emperial_droneswarm.png",
    "30.jpg": "voidborn_fighter.png",
    "31.jpg": "voidborn_cruiser.png",
    "35.jpg": "voidborn_dreadnought.png",
    "36.jpg": "voidborn_droneswarm.png",
    "39.jpg": "mechanoid_fighter.png",
    "37.jpg": "mechanoid_cruiser.png",
    "40.jpg": "mechanoid_dreadnought.png",
    "38.jpg": "mechanoid_droneswarm.png",
}


def key_magenta(im: Image.Image) -> Image.Image:
    arr = np.array(im.convert("RGBA"))
    r = arr[:, :, 0].astype(np.int16)
    g = arr[:, :, 1].astype(np.int16)
    b = arr[:, :, 2].astype(np.int16)
    dist = (r - 255) ** 2 + (g - 0) ** 2 + (b - 255) ** 2
    mask = dist < 14000
    near = (dist < 26000) & (r > 150) & (b > 120) & (g < 170)
    arr[mask, 3] = 0
    fade = np.clip(((dist - 8000) * 255) / 18000, 0, 255).astype(np.uint8)
    arr[near & ~mask, 3] = np.minimum(arr[near & ~mask, 3], fade[near & ~mask])
    arr[arr[:, :, 3] == 0, 0:3] = 0
    out = Image.fromarray(arr, "RGBA")
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


def main() -> None:
    sky = IMG / "28.jpg"
    if sky.exists():
        Image.open(sky).convert("RGB").save(BG / "battle_void.jpg", quality=92)
        print("sky battle_void.jpg")
    for src_name, dest_name in LIVE.items():
        src = IMG / src_name
        if not src.exists():
            print("missing", src_name)
            continue
        keyed = key_magenta(Image.open(src))
        keyed.save(COMBAT / dest_name)
        print(dest_name, keyed.size)


if __name__ == "__main__":
    main()
