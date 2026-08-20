import * as THREE from 'three';
import {
  classVisual,
  droneTexturePath,
  droneWreckPath,
  factionVisual,
  portraitPath,
  portraitWreckPath
} from '../utils/battleCatalog';

export type BuiltShip = {
  root: THREE.Group;
  muzzle: THREE.Object3D;
  engines: THREE.Object3D[];
  hullMeshes: THREE.Mesh[];
  drones: THREE.Object3D[];
  droneHome: THREE.Vector3[];
  droneMuzzles: THREE.Object3D[];
  shield: THREE.Mesh;
  liveMap: THREE.Texture | null;
  wreckMap: THREE.Texture | null;
  weaponMesh: THREE.Mesh | null;
  restYaw: number;
};

export class ShipArt {
  private loader = new THREE.TextureLoader();
  private cache = new Map<string, THREE.Texture>();

  async load(path: string): Promise<THREE.Texture | null> {
    const known = this.cache.get(path);
    if (known) {
      return known;
    }
    const url = path.startsWith('/') ? path : `/${path}`;
    return new Promise((resolve) => {
      this.loader.load(
        url,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = 8;
          texture.needsUpdate = true;
          this.cache.set(path, texture);
          resolve(texture);
        },
        undefined,
        () => resolve(null)
      );
    });
  }

  get(path: string): THREE.Texture | null {
    return this.cache.get(path) ?? null;
  }
}

let flareTex: THREE.Texture | null = null;

export function flareTexture(): THREE.Texture {
  if (flareTex) {
    return flareTex;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.28, 'rgba(200,230,255,0.4)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  flareTex = new THREE.CanvasTexture(canvas);
  flareTex.needsUpdate = true;
  return flareTex;
}

function cardMaterial(map: THREE.Texture | null): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    alphaTest: 0.12,
    depthWrite: true,
    side: THREE.DoubleSide
  });
}

function facingMap(map: THREE.Texture | null, flipX: boolean): THREE.Texture | null {
  if (!map || !flipX) {
    return map;
  }
  const tex = map.clone();
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.x = -1;
  tex.offset.x = 1;
  tex.needsUpdate = true;
  return tex;
}

function makeCard(map: THREE.Texture | null, width: number, height: number, flipX: boolean): THREE.Mesh {
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), cardMaterial(facingMap(map, flipX)));
}

function makeFlare(color: number, size: number): THREE.Sprite {
  const flare = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: flareTexture(),
      color,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true
    })
  );
  flare.scale.set(size, size, 1);
  return flare;
}

function mapAspect(map: THREE.Texture | null): number {
  const image = map?.image as { width?: number; height?: number } | undefined;
  if (image?.width && image?.height) {
    return image.width / image.height;
  }
  return 1;
}

const SWARM_PACK: Array<[number, number, number, number]> = [
  [0.0, 0.06, 0.04, 1],
  [-0.52, 0.28, 0.22, 0.86],
  [0.5, 0.04, 0.24, 0.82],
  [-0.4, -0.2, -0.2, 0.88],
  [0.42, 0.3, -0.16, 0.78],
  [0.06, 0.44, 0.1, 0.74]
];

export function buildShip(
  faction: number,
  unitClass: number,
  isPlayer: boolean,
  art: ShipArt
): BuiltShip {
  const vis = classVisual(unitClass);
  const paint = factionVisual(faction);
  const isSwarm = vis.slug === 'droneswarm';
  // Portraits have the nose on the left of the texture. Player sits on -X and must
  // be mirrored so the bow points at the enemy; enemy art already points inward.
  const flipX = isPlayer;
  const liveMap = art.get(portraitPath(faction, unitClass));
  const wreckMap = facingMap(art.get(portraitWreckPath(faction, unitClass)), flipX);
  const height = vis.worldFit;
  const aspect = mapAspect(isSwarm ? art.get(droneTexturePath(faction, 0)) : liveMap);
  const width = height * aspect;
  const restYaw = isPlayer ? 0.05 : -0.05;
  const side = isPlayer ? 1 : -1;

  const root = new THREE.Group();
  const hullMeshes: THREE.Mesh[] = [];
  const engines: THREE.Object3D[] = [];
  const drones: THREE.Object3D[] = [];
  const droneHome: THREE.Vector3[] = [];
  const droneMuzzles: THREE.Object3D[] = [];
  let weaponMesh: THREE.Mesh | null = null;

  const muzzle = new THREE.Object3D();

  if (isSwarm) {
    SWARM_PACK.forEach((spec, index) => {
      const variant = index % 4;
      const droneMap = art.get(droneTexturePath(faction, variant)) || liveMap;
      const droneAspect = mapAspect(droneMap);
      const droneH = height * spec[3];
      const droneW = droneH * droneAspect;
      const droneFlip = !isPlayer;
      const drone = makeCard(droneMap, droneW, droneH, droneFlip);
      drone.position.set(spec[0], spec[1], spec[2]);
      drone.userData.wreckMap = facingMap(art.get(droneWreckPath(faction, variant)), droneFlip);
      root.add(drone);
      hullMeshes.push(drone);
      drones.push(drone);
      droneHome.push(new THREE.Vector3(spec[0], spec[1], spec[2]));

      const droneMuzzle = new THREE.Object3D();
      droneMuzzle.position.set(side * droneW * 0.38, droneH * 0.04, 0.08);
      drone.add(droneMuzzle);
      droneMuzzles.push(droneMuzzle);

      const flare = makeFlare(paint.glow, droneH * 0.28);
      flare.position.set(-side * droneW * 0.28, -droneH * 0.04, -0.08);
      drone.add(flare);
      engines.push(flare);
    });
    muzzle.position.set(side * 0.9, 0.16, 0.2);
    root.add(muzzle);
    const swarmAura = makeFlare(paint.glow, 1.35);
    swarmAura.material.opacity = 0.1;
    swarmAura.position.set(0, 0.1, -0.2);
    swarmAura.userData.soft = true;
    root.add(swarmAura);
    engines.push(swarmAura);
  } else {
    const card = makeCard(liveMap, width, height, flipX);
    root.add(card);
    hullMeshes.push(card);

    const flare = makeFlare(paint.glow, height * 0.2);
    flare.position.set(-side * width * 0.28, -height * 0.06, -0.12);
    root.add(flare);
    engines.push(flare);
    const aura = makeFlare(paint.glow, Math.max(width, height) * 0.42);
    aura.material.opacity = 0.09;
    aura.position.set(0, -height * 0.04, -0.16);
    aura.userData.soft = true;
    root.add(aura);
    engines.push(aura);
    muzzle.position.set(side * width * 0.34, height * 0.04, 0.18);
    root.add(muzzle);
  }

  const span = isSwarm ? 1.7 : Math.max(width, height);
  const shield = new THREE.Mesh(
    new THREE.SphereGeometry(span * (isSwarm ? 0.72 : 0.52), 24, 16),
    new THREE.MeshBasicMaterial({
      color: 0x66ddff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );
  shield.visible = false;
  root.add(shield);

  root.rotation.y = restYaw;
  root.userData.faction = faction;
  root.userData.unitClass = unitClass;
  root.userData.isPlayer = isPlayer;
  return {
    root,
    muzzle,
    engines,
    hullMeshes,
    drones,
    droneHome,
    droneMuzzles,
    shield,
    liveMap,
    wreckMap,
    weaponMesh,
    restYaw
  };
}

export function wreckShip(built: BuiltShip): void {
  built.hullMeshes.forEach((mesh) => {
    const mat = mesh.material as THREE.MeshBasicMaterial;
    const wreck = (mesh.userData.wreckMap as THREE.Texture | undefined) || built.wreckMap;
    if (wreck) {
      mat.map = wreck;
    }
    mat.color.setHex(0x9a9a9a);
    mat.needsUpdate = true;
  });
  built.engines.forEach((engine) => {
    engine.visible = false;
  });
  if (built.weaponMesh) {
    built.weaponMesh.visible = false;
  }
}
