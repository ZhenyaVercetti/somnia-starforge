from collections import deque
from pathlib import Path

from PIL import Image

DST = Path(r"C:\Projects\somnia-starforge\frontend\public\assets\units\combat")


def is_magenta(r: int, g: int, b: int, a: int) -> bool:
    if a < 8:
        return True
    dr = r - 255
    dg = g - 0
    db = b - 255
    if dr * dr + dg * dg + db * db < 14000:
        return True
    if r > 170 and b > 150 and g < 150 and abs(r - b) < 110:
        return True
    return False


def key_image(path: Path) -> Image.Image:
    im = Image.open(path).convert("RGBA")
    px = im.load()
    w, h = im.size
    marked = [[False] * w for _ in range(h)]
    q = deque()
    for x in range(w):
        q.append((x, 0))
        q.append((x, h - 1))
    for y in range(h):
        q.append((0, y))
        q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or marked[y][x]:
            continue
        r, g, b, a = px[x, y]
        if not is_magenta(r, g, b, a):
            continue
        marked[y][x] = True
        px[x, y] = (0, 0, 0, 0)
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                px[x, y] = (0, 0, 0, 0)
                continue
            dr = r - 255
            dg = g - 0
            db = b - 255
            d2 = dr * dr + dg * dg + db * db
            if d2 < 22000 and r > 150 and b > 130 and g < 170:
                fade = max(0, min(255, int(255 * (d2 - 9000) / 13000)))
                px[x, y] = (r, g, b, fade)

    bbox = im.getbbox()
    if not bbox:
        return im
    pad = 16
    left, top, right, bottom = bbox
    return im.crop((
        max(0, left - pad),
        max(0, top - pad),
        min(w, right + pad),
        min(h, bottom + pad)
    ))


def main() -> None:
    for path in sorted(DST.glob("*.png")):
        if path.name.endswith("_destroyed.png"):
            continue
        cleaned = key_image(path)
        cleaned.save(path)
        print(f"keyed {path.name} {cleaned.size}")


if __name__ == "__main__":
    main()
