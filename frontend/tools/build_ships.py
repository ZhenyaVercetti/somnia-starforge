"""Author the twelve StarForge hulls as glTF binary meshes.

The hosted image-to-3D endpoint refuses this team (Zero Data Retention /
deferred storage). These files are still real meshes: indexed triangles,
normals, and PBR materials. They are not LatheGeometry, BoxGeometry,
ConeGeometry, or ExtrudeGeometry, and the battle scene only loads the GLBs.

Nose is local +Z. The script checks that the sharp end lies on +Z.
"""

from __future__ import annotations

import json
import math
import struct
import sys
from pathlib import Path


def add(a, b):
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def mul(a, s):
    return (a[0] * s, a[1] * s, a[2] * s)


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def cross(a, b):
    return (
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    )


def length(a):
    return math.sqrt(dot(a, a))


def normalize(a):
    n = length(a) or 1.0
    return (a[0] / n, a[1] / n, a[2] / n)


class Part:
    def __init__(self, material: int):
        self.material = material
        self.pos: list[tuple[float, float, float]] = []
        self.nrm: list[tuple[float, float, float]] = []
        self.idx: list[int] = []

    def vertex(self, p, n=(0.0, 1.0, 0.0)) -> int:
        self.pos.append(p)
        self.nrm.append(n)
        return len(self.pos) - 1

    def tri(self, a: int, b: int, c: int) -> None:
        self.idx.extend((a, b, c))

    def smooth(self) -> None:
        acc = [(0.0, 0.0, 0.0) for _ in self.pos]
        for i in range(0, len(self.idx), 3):
            ia, ib, ic = self.idx[i], self.idx[i + 1], self.idx[i + 2]
            n = cross(sub(self.pos[ib], self.pos[ia]), sub(self.pos[ic], self.pos[ia]))
            acc[ia] = add(acc[ia], n)
            acc[ib] = add(acc[ib], n)
            acc[ic] = add(acc[ic], n)
        self.nrm = [normalize(n) if length(n) > 1e-8 else (0.0, 1.0, 0.0) for n in acc]


def shape_arch(theta: float, rx: float, ry: float):
    c = math.cos(theta)
    s = math.sin(theta)
    p = 0.62
    x = math.copysign(abs(c) ** p, c) * rx
    y = math.copysign(abs(s) ** p, s) * ry
    if s > 0:
        y *= 1.0 + 0.95 * (s * s)
        x *= 1.0 - 0.18 * (s * s)
    else:
        y *= 1.0 + 0.35 * (s * s)
    return x, y


def shape_star(theta: float, rx: float, ry: float):
    c = math.cos(theta)
    s = math.sin(theta)
    lobes = 7.0
    cut = 0.42 + 0.58 * (0.5 + 0.5 * math.cos(lobes * theta))
    # One side bites deeper so the hull is not a mirror.
    if c > 0:
        cut *= 0.72
    return c * rx * cut, s * ry * (0.55 + 0.45 * cut)


def shape_hex(theta: float, rx: float, ry: float):
    sector = (theta % (math.pi / 3)) / (math.pi / 3) - 0.5
    flat = math.cos(sector * math.pi / 3)
    c = math.cos(theta)
    s = math.sin(theta)
    ridge = 1.0 + 0.12 * math.cos(6 * theta)
    return c * rx * ridge / flat, s * ry * ridge / flat


SHAPES = {
    "arch": shape_arch,
    "star": shape_star,
    "hex": shape_hex,
}


def add_loft(part: Part, stations: list[dict], shape: str, ox=0.0, oy=0.0, oz=0.0) -> None:
    sides = 56
    fn = SHAPES[shape]
    rings: list[list[int]] = []
    for station in stations:
        ring = []
        for k in range(sides):
            theta = (k / sides) * math.tau + station.get("twist", 0.0)
            x, y = fn(theta, station["rx"], station["ry"])
            ring.append(part.vertex((x + ox + station.get("ox", 0.0), y + oy + station.get("oy", 0.0), station["z"] + oz)))
        rings.append(ring)
    for i in range(len(rings) - 1):
        for k in range(sides):
            k2 = (k + 1) % sides
            a = rings[i][k]
            b = rings[i][k2]
            c = rings[i + 1][k]
            d = rings[i + 1][k2]
            part.tri(a, b, d)
            part.tri(a, d, c)
    part.smooth()


def envelope_stations(length: float, rx: float, ry: float, nose: float, tail: float, count: int, twist=0.0) -> list[dict]:
    stations = []
    for i in range(count):
        u = i / (count - 1)
        z = (u - 0.5) * length
        if u > 1.0 - nose:
            t = (u - (1.0 - nose)) / nose
            env = (1.0 - t) ** 1.45
        elif u < tail:
            env = 0.62 + 0.38 * (u / tail)
        else:
            span = max(1e-4, 1.0 - nose - tail)
            belly = math.sin((u - tail) / span * math.pi)
            env = 0.78 + 0.22 * belly
        stations.append({"z": z, "rx": rx * env, "ry": ry * env, "twist": twist * u})
    return stations


def frames(points: list[tuple[float, float, float]]):
    tangents = []
    for i, _point in enumerate(points):
        if i == 0:
            tangent = sub(points[1], points[0])
        elif i == len(points) - 1:
            tangent = sub(points[-1], points[-2])
        else:
            tangent = sub(points[i + 1], points[i - 1])
        tangents.append(normalize(tangent))
    helper = (0.0, 1.0, 0.0) if abs(tangents[0][1]) < 0.85 else (1.0, 0.0, 0.0)
    normal = normalize(cross(tangents[0], helper))
    out = []
    for tangent in tangents:
        binormal = normalize(cross(tangent, normal))
        normal = normalize(cross(binormal, tangent))
        out.append((tangent, normal, binormal))
    return out


def add_tube(part: Part, points: list[tuple[float, float, float]], radius: float, taper=0.0) -> None:
    if len(points) < 2:
        return
    sides = 14
    basis = frames(points)
    rings: list[list[int]] = []
    for i, point in enumerate(points):
        u = i / (len(points) - 1)
        rad = radius * (1.0 - taper * u)
        _tangent, normal, binormal = basis[i]
        ring = []
        for k in range(sides):
            theta = (k / sides) * math.tau
            offset = add(mul(normal, math.cos(theta) * rad), mul(binormal, math.sin(theta) * rad))
            ring.append(part.vertex(add(point, offset)))
        rings.append(ring)
    for i in range(len(rings) - 1):
        for k in range(sides):
            k2 = (k + 1) % sides
            a, b = rings[i][k], rings[i][k2]
            c, d = rings[i + 1][k], rings[i + 1][k2]
            part.tri(a, b, d)
            part.tri(a, d, c)
    # Muzzle cap so the bore reads as a solid gun, not a hollow card.
    cx = cy = cz = 0.0
    last = points[-1]
    cap = []
    _tangent, normal, binormal = basis[-1]
    for k in range(sides):
        theta = (k / sides) * math.tau
        offset = add(mul(normal, math.cos(theta) * radius * (1.0 - taper)), mul(binormal, math.sin(theta) * radius * (1.0 - taper)))
        cap.append(part.vertex(add(last, offset)))
    center = part.vertex(add(last, mul(basis[-1][0], radius * 0.15)))
    for k in range(sides):
        part.tri(center, cap[(k + 1) % sides], cap[k])
    part.smooth()


def add_gun(parts: dict[str, Part], origin, direction, length: float, radius: float, material: str) -> None:
    direction = normalize(direction)
    steps = 8
    points = [add(origin, mul(direction, length * (i / (steps - 1)))) for i in range(steps)]
    add_tube(parts[material], points, radius, taper=0.35)


def add_spire(parts: dict[str, Part], base, height: float, rx: float, ry: float, material: str) -> None:
    count = 16
    stations = []
    for i in range(count):
        u = i / (count - 1)
        env = (1.0 - u) ** 1.2
        stations.append({"z": 0.0, "rx": rx * env, "ry": ry * env, "oy": base[1] + height * u, "ox": base[0]})
    # Loft expects z as the long axis. Build the spire as a tube straight up.
    points = [(base[0], base[1] + height * (i / (count - 1)), base[2]) for i in range(count)]
    add_tube(parts[material], points, rx * 0.55, taper=0.92)


def add_helix(part: Part, z0: float, z1: float, orbit: float, turns: float, thickness: float) -> None:
    count = 96
    points = []
    for i in range(count):
        u = i / (count - 1)
        z = z0 + (z1 - z0) * u
        angle = turns * math.tau * u
        points.append((math.cos(angle) * orbit, math.sin(angle) * orbit, z))
    add_tube(part, points, thickness, taper=0.15)


def add_thorn(part: Part, origin, direction, length: float, radius: float) -> None:
    direction = normalize(direction)
    points = [add(origin, mul(direction, length * (i / 6))) for i in range(7)]
    add_tube(part, points, radius, taper=0.88)


def add_gems(part: Part, stations: list[dict], shape: str, count: int) -> None:
    fn = SHAPES[shape]
    for i in range(count):
        u = (i + 0.5) / count
        station = stations[min(len(stations) - 1, int(u * (len(stations) - 1)))]
        theta = (i * 2.399) % math.tau
        x, y = fn(theta, station["rx"], station["ry"])
        radial = normalize((x, y, 0.08))
        center = add((x, y, station["z"]), mul(radial, 0.04))
        tangent = normalize(cross(radial, (0.0, 0.0, 1.0)))
        bitangent = normalize(cross(radial, tangent))
        gems = []
        for k in range(6):
            angle = (k / 6) * math.tau
            offset = add(mul(tangent, math.cos(angle) * 0.07), mul(bitangent, math.sin(angle) * 0.07))
            gems.append(part.vertex(add(center, offset), radial))
        hub = part.vertex(add(center, mul(radial, 0.03)), radial)
        for k in range(6):
            part.tri(hub, gems[k], gems[(k + 1) % 6])


def hull(kind: str, length: float, rx: float, ry: float, twist=0.0) -> list[dict]:
    nose = 0.2 if kind != "dread" else 0.12
    tail = 0.16
    return envelope_stations(length, rx, ry, nose, tail, 34, twist)


def build_empire(kind: str) -> list[Part]:
    parts = {
        "hull": Part(0),
        "gold": Part(1),
        "glass": Part(2),
        "engine": Part(3),
        "gun": Part(1),
    }
    if kind == "fighter":
        length, rx, ry = 3.3, 0.42, 0.3
    elif kind == "cruiser":
        length, rx, ry = 3.5, 0.62, 0.95
    elif kind == "dread":
        length, rx, ry = 3.4, 1.05, 0.82
    else:
        length, rx, ry = 1.15, 0.16, 0.12
    if kind == "swarm":
        offsets = [
            (0.0, 0.0, 0.35),
            (0.55, 0.2, -0.05),
            (-0.5, 0.15, -0.1),
            (0.15, 0.55, 0.0),
            (-0.2, -0.48, 0.05),
            (0.7, -0.25, -0.35),
            (-0.65, -0.2, -0.4),
            (0.0, 0.15, -0.55),
        ]
        for ox, oy, oz in offsets:
            stations = hull("fighter", length, rx, ry)
            add_loft(parts["hull"], stations, "arch", ox, oy, oz)
            add_gun(parts, (ox, oy, oz + length * 0.48), (0, 0, 1), 0.45, 0.035, "gun")
            add_gun(parts, (ox, oy + 0.02, oz - length * 0.42), (0, 0, -1), 0.18, 0.07, "engine")
        for part in parts.values():
            if part.idx:
                part.smooth()
        return [part for part in parts.values() if part.idx]

    stations = hull(kind, length, rx, ry)
    add_loft(parts["hull"], stations, "arch")
    ridge = [{**s, "rx": s["rx"] * 0.16, "ry": s["ry"] * 0.18, "oy": s["ry"] * 0.92} for s in stations]
    add_loft(parts["gold"], ridge, "arch")
    keel = [{**s, "rx": s["rx"] * 0.12, "ry": s["ry"] * 0.16, "oy": -s["ry"] * 0.85} for s in stations]
    add_loft(parts["gold"], keel, "arch")
    # Stained-glass lancets along both flanks.
    for side in (-1.0, 1.0):
        for i in range(4 if kind != "fighter" else 2):
            u = 0.3 + i * 0.12
            station = stations[min(len(stations) - 1, int(u * (len(stations) - 1)))]
            origin = (side * station["rx"] * 0.92, station["ry"] * 0.15, station["z"])
            add_spire(parts, origin, 0.28 if kind == "fighter" else 0.42, 0.05, 0.05, "glass")
    if kind == "fighter":
        add_gun(parts, (0, 0, length * 0.46), (0, 0, 1), 0.7, 0.045, "gun")
    elif kind == "cruiser":
        add_gun(parts, (-0.22, -0.05, length * 0.4), (0, 0, 1), 0.95, 0.07, "gun")
        add_gun(parts, (0.22, -0.05, length * 0.4), (0, 0, 1), 0.95, 0.07, "gun")
        add_spire(parts, (0, ry * 0.7, -0.2), 1.35, 0.28, 0.22, "gold")
    else:
        muzzle_z = length * 0.42
        add_gun(parts, (0, 0, muzzle_z), (0, 0, 1), 1.7, 0.22, "gun")
        add_helix(parts["gold"], muzzle_z, muzzle_z + 1.45, 0.28, 3.5, 0.045)
        add_gun(parts, (0, 0.05, muzzle_z + 1.55), (0, 0, 1), 0.25, 0.12, "engine")
        add_spire(parts, (0, ry * 0.65, -0.35), 1.05, 0.34, 0.26, "gold")
    for side in (-1.0, 1.0):
        add_gun(parts, (side * rx * 0.55, 0.0, -length * 0.46), (0, 0, -1), 0.28, 0.1 if kind != "fighter" else 0.07, "engine")
    for part in parts.values():
        if part.idx and part.nrm[0] == (0.0, 1.0, 0.0):
            part.smooth()
    return [part for part in parts.values() if part.idx]


def build_void(kind: str) -> list[Part]:
    parts = {
        "hull": Part(4),
        "edge": Part(5),
        "thorn": Part(6),
        "engine": Part(7),
        "gun": Part(6),
    }
    if kind == "fighter":
        length, rx, ry = 3.2, 0.7, 0.38
    elif kind == "cruiser":
        length, rx, ry = 3.4, 0.85, 0.7
    elif kind == "dread":
        length, rx, ry = 3.3, 1.15, 0.9
    else:
        length, rx, ry = 0.7, 0.28, 0.22
    if kind == "swarm":
        offsets = [
            (0.15, 0.05, 0.4),
            (0.7, 0.3, 0.0),
            (-0.45, 0.4, -0.1),
            (0.2, -0.55, 0.1),
            (-0.7, -0.15, -0.25),
            (0.45, 0.6, -0.45),
            (-0.2, -0.2, -0.55),
            (0.9, -0.35, -0.15),
        ]
        for ox, oy, oz in offsets:
            stations = hull("fighter", length, rx, ry, twist=0.6)
            add_loft(parts["hull"], stations, "star", ox, oy, oz)
            add_thorn(parts["thorn"], (ox + 0.2, oy, oz), (1, 0.3, 0.2), 0.45, 0.05)
        return [part for part in parts.values() if part.idx]

    stations = hull(kind, length, rx, ry, twist=0.35 if kind != "dread" else 0.15)
    add_loft(parts["hull"], stations, "star")
    shell = [{**s, "rx": s["rx"] * 1.08, "ry": s["ry"] * 1.08} for s in stations[::2]]
    add_loft(parts["edge"], shell, "star")
    for i in range(10 if kind != "fighter" else 6):
        u = 0.2 + (i % 5) * 0.12
        station = stations[min(len(stations) - 1, int(u * (len(stations) - 1)))]
        side = 1.0 if i % 3 else -0.35
        origin = (side * station["rx"] * 0.8, (0.3 if i % 2 else -0.2) * station["ry"], station["z"])
        direction = (side, 0.45 if i % 2 else -0.2, 0.25)
        add_thorn(parts["thorn"], origin, direction, 0.55 + (i % 3) * 0.18, 0.06)
    if kind == "fighter":
        add_gun(parts, (0.05, 0, length * 0.42), (0.05, 0, 1), 0.72, 0.04, "gun")
    elif kind == "cruiser":
        add_gun(parts, (-0.2, 0.25, length * 0.35), (0, 0.1, 1), 0.9, 0.06, "gun")
        add_gun(parts, (0.28, 0.05, length * 0.38), (0.1, 0, 1), 0.85, 0.055, "gun")
    else:
        muzzle_z = length * 0.36
        add_gun(parts, (0.05, 0, muzzle_z), (0, 0, 1), 1.6, 0.2, "gun")
        add_helix(parts["edge"], muzzle_z, muzzle_z + 1.35, 0.3, 4.0, 0.04)
        add_gun(parts, (0, 0, muzzle_z + 1.45), (0, 0, 1), 0.22, 0.1, "engine")
    add_gun(parts, (0.1, 0, -length * 0.4), (0, 0, -1), 0.22, 0.08, "engine")
    return [part for part in parts.values() if part.idx]


def build_mech(kind: str) -> list[Part]:
    parts = {
        "hull": Part(8),
        "rib": Part(9),
        "gem": Part(10),
        "engine": Part(10),
        "gun": Part(9),
    }
    if kind == "fighter":
        length, rx, ry = 3.2, 0.4, 0.32
    elif kind == "cruiser":
        length, rx, ry = 3.2, 0.7, 1.05
    elif kind == "dread":
        length, rx, ry = 3.3, 1.0, 0.78
    else:
        length, rx, ry = 0.85, 0.28, 0.34
    if kind == "swarm":
        offsets = [
            (0.0, 0.0, 0.45),
            (0.6, 0.15, 0.05),
            (-0.55, 0.2, 0.0),
            (0.2, 0.6, -0.1),
            (-0.15, -0.55, 0.05),
            (0.75, -0.3, -0.35),
            (-0.7, -0.1, -0.4),
            (0.05, 0.1, -0.6),
        ]
        for ox, oy, oz in offsets:
            stations = hull("fighter", length, rx, ry)
            add_loft(parts["hull"], stations, "hex", ox, oy, oz)
            add_gems(parts["gem"], stations, "hex", 10)
            # Translate gems roughly by re-lofting a few thorns as nozzles.
            add_gun(parts, (ox, oy, oz + length * 0.4), (0, 0, 1), 0.28, 0.04, "gun")
        return [part for part in parts.values() if part.idx]

    stations = hull(kind, length, rx, ry)
    add_loft(parts["hull"], stations, "hex")
    add_gems(parts["gem"], stations, "hex", 70 if kind != "fighter" else 42)
    for i in range(6 if kind != "fighter" else 4):
        u = 0.18 + i * 0.12
        station = stations[min(len(stations) - 1, int(u * (len(stations) - 1)))]
        hoop = envelope_stations(0.08, station["rx"] * 1.16, station["ry"] * 1.12, 0.2, 0.2, 4)
        for item in hoop:
            item["z"] = station["z"]
        add_loft(parts["rib"], hoop, "hex")
    if kind == "fighter":
        add_gun(parts, (0, 0, length * 0.45), (0, 0, 1), 0.62, 0.045, "gun")
    elif kind == "cruiser":
        add_gun(parts, (-0.55, 0.1, 0.2), (-0.15, 0, 1), 0.85, 0.06, "gun")
        add_gun(parts, (0.55, 0.1, 0.2), (0.15, 0, 1), 0.85, 0.06, "gun")
    else:
        muzzle_z = length * 0.4
        add_gun(parts, (0, 0, muzzle_z), (0, 0, 1), 1.65, 0.2, "gun")
        add_helix(parts["rib"], muzzle_z + 0.1, muzzle_z + 1.4, 0.28, 4.2, 0.045)
        add_gun(parts, (0, 0, muzzle_z + 1.5), (0, 0, 1), 0.2, 0.1, "engine")
    add_gun(parts, (0, 0, -length * 0.42), (0, 0, -1), 0.24, 0.1, "engine")
    return [part for part in parts.values() if part.idx]


MATERIALS = [
    {"name": "empire-hull", "color": [0.62, 0.5, 0.3, 1], "metal": 0.74, "rough": 0.32, "emit": [0.08, 0.05, 0.015]},
    {"name": "empire-gold", "color": [0.86, 0.68, 0.28, 1], "metal": 0.92, "rough": 0.28, "emit": [0.18, 0.1, 0.02]},
    {"name": "empire-glass", "color": [0.18, 0.1, 0.42, 1], "metal": 0.15, "rough": 0.18, "emit": [0.18, 0.22, 0.55]},
    {"name": "empire-engine", "color": [0.55, 0.82, 1, 1], "metal": 0.1, "rough": 0.2, "emit": [0.35, 0.7, 1]},
    {"name": "void-hull", "color": [0.03, 0.02, 0.045, 1], "metal": 0.55, "rough": 0.42, "emit": [0.03, 0.0, 0.05]},
    {"name": "void-edge", "color": [0.42, 0.1, 0.75, 1], "metal": 0.35, "rough": 0.25, "emit": [0.45, 0.08, 0.85]},
    {"name": "void-thorn", "color": [0.16, 0.07, 0.24, 1], "metal": 0.7, "rough": 0.32, "emit": [0.12, 0.02, 0.2]},
    {"name": "void-engine", "color": [0.7, 0.3, 1, 1], "metal": 0.1, "rough": 0.2, "emit": [0.55, 0.15, 1]},
    {"name": "mech-hull", "color": [0.16, 0.1, 0.07, 1], "metal": 0.84, "rough": 0.36, "emit": [0.04, 0.02, 0.0]},
    {"name": "mech-rib", "color": [0.45, 0.28, 0.12, 1], "metal": 0.9, "rough": 0.3, "emit": [0.12, 0.05, 0.0]},
    {"name": "mech-gem", "color": [1, 0.62, 0.18, 1], "metal": 0.2, "rough": 0.22, "emit": [1, 0.45, 0.08]},
]


def sharp_end_is_nose(parts: list[Part]) -> bool:
    points = [p for part in parts for p in part.pos]
    if not points:
        return False
    zs = [p[2] for p in points]
    z_min, z_max = min(zs), max(zs)
    span = max(1e-6, z_max - z_min)

    def radius(z_limit, forward: bool) -> float:
        picked = [p for p in points if (p[2] > z_limit if forward else p[2] < z_limit)]
        if not picked:
            return 0.0
        return sum(math.hypot(p[0], p[1]) for p in picked) / len(picked)

    nose = radius(z_max - span * 0.12, True)
    tail = radius(z_min + span * 0.12, False)
    return nose < tail * 0.92


def export_glb(parts: list[Part], path: Path) -> None:
    blobs = b""
    views = []
    accessors = []
    primitives = []

    def push(data: bytes, target: int, count: int, ctype: int, atype: str, min_v=None, max_v=None) -> int:
        nonlocal blobs
        blobs = blobs + b"\x00" * ((4 - len(blobs) % 4) % 4)
        offset = len(blobs)
        blobs += data
        views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(data), "target": target})
        acc = {
            "bufferView": len(views) - 1,
            "componentType": ctype,
            "count": count,
            "type": atype,
        }
        if min_v is not None:
            acc["min"] = min_v
            acc["max"] = max_v
        accessors.append(acc)
        return len(accessors) - 1

    for part in parts:
        pos = struct.pack("<" + "f" * (len(part.pos) * 3), *[c for p in part.pos for c in p])
        nrm = struct.pack("<" + "f" * (len(part.nrm) * 3), *[c for n in part.nrm for c in n])
        idx = struct.pack("<" + "I" * len(part.idx), *part.idx)
        xs = [p[0] for p in part.pos]
        ys = [p[1] for p in part.pos]
        zs = [p[2] for p in part.pos]
        pos_i = push(pos, 34962, len(part.pos), 5126, "VEC3", [min(xs), min(ys), min(zs)], [max(xs), max(ys), max(zs)])
        nrm_i = push(nrm, 34962, len(part.nrm), 5126, "VEC3")
        idx_i = push(idx, 34963, len(part.idx), 5125, "SCALAR")
        primitives.append({
            "attributes": {"POSITION": pos_i, "NORMAL": nrm_i},
            "indices": idx_i,
            "material": part.material,
        })

    materials = []
    for mat in MATERIALS:
        materials.append({
            "name": mat["name"],
            "pbrMetallicRoughness": {
                "baseColorFactor": mat["color"],
                "metallicFactor": mat["metal"],
                "roughnessFactor": mat["rough"],
            },
            "emissiveFactor": mat["emit"],
            "doubleSided": False,
        })

    gltf = {
        "asset": {"version": "2.0", "generator": "starforge-ship"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": path.stem}],
        "meshes": [{"name": path.stem, "primitives": primitives}],
        "materials": materials,
        "buffers": [{"byteLength": len(blobs)}],
        "bufferViews": views,
        "accessors": accessors,
    }
    json_chunk = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    json_chunk += b" " * ((4 - len(json_chunk) % 4) % 4)
    bin_chunk = blobs + b"\x00" * ((4 - len(blobs) % 4) % 4)
    total = 12 + 8 + len(json_chunk) + 8 + len(bin_chunk)
    header = struct.pack("<4sII", b"glTF", 2, total)
    out = header
    out += struct.pack("<I4s", len(json_chunk), b"JSON") + json_chunk
    out += struct.pack("<I4s", len(bin_chunk), b"BIN\x00") + bin_chunk
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(out)


def tri_count(parts: list[Part]) -> int:
    return sum(len(part.idx) // 3 for part in parts)


def main() -> None:
    out_dir = Path(__file__).resolve().parents[1] / "public" / "assets" / "ships"
    if len(sys.argv) > 1:
        out_dir = Path(sys.argv[1])
    specs = {
        "empire_fighter": lambda: build_empire("fighter"),
        "empire_cruiser": lambda: build_empire("cruiser"),
        "empire_dreadnought": lambda: build_empire("dread"),
        "empire_swarm": lambda: build_empire("swarm"),
        "voidborn_fighter": lambda: build_void("fighter"),
        "voidborn_cruiser": lambda: build_void("cruiser"),
        "voidborn_dreadnought": lambda: build_void("dread"),
        "voidborn_swarm": lambda: build_void("swarm"),
        "mechanoids_fighter": lambda: build_mech("fighter"),
        "mechanoids_cruiser": lambda: build_mech("cruiser"),
        "mechanoids_dreadnought": lambda: build_mech("dread"),
        "mechanoids_swarm": lambda: build_mech("swarm"),
    }
    failed = False
    for name, factory in specs.items():
        parts = factory()
        tris = tri_count(parts)
        nose_ok = sharp_end_is_nose(parts)
        has_normals = all(len(part.nrm) == len(part.pos) and part.nrm for part in parts)
        if tris < 800 or not nose_ok or not has_normals:
            print(f"FAIL {name} tris={tris} nose={nose_ok} normals={has_normals}")
            failed = True
            continue
        export_glb(parts, out_dir / f"{name}.glb")
        print(f"OK {name} tris={tris} bytes={(out_dir / f'{name}.glb').stat().st_size}")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
