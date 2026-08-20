import * as THREE from 'three';
import {
  classVisual,
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
  shield: THREE.Mesh;
  liveMap: THREE.Texture | null;
  wreckMap: THREE.Texture | null;
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

function flareTexture(): THREE.Texture {
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

function makeCard(map: THREE.Texture | null, width: number, height: number, flipX: boolean): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    alphaTest: 0.18,
    depthWrite: true,
    side: THREE.DoubleSide
  });
  const card = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  if (flipX) {
    card.scale.x = -1;
  }
  return card;
}

export function buildShip(
  faction: number,
  unitClass: number,
  isPlayer: boolean,
  art: ShipArt
): BuiltShip {
  const vis = classVisual(unitClass);
  const paint = factionVisual(faction);
  const isSwarm = vis.slug === 'droneswarm';
  const liveMap = art.get(portraitPath(faction, isSwarm ? 0 : unitClass));
  const wreckMap = art.get(portraitWreckPath(faction, isSwarm ? 0 : unitClass));
  const height = vis.fit / (isSwarm ? 108 : 66);
  const image = liveMap?.image as { width?: number; height?: number } | undefined;
  const aspect = image?.width && image?.height ? image.width / image.height : 1;
  const width = height * aspect;
  const restYaw = isPlayer ? 0.22 : -0.22;

  const root = new THREE.Group();
  const hullMeshes: THREE.Mesh[] = [];
  const engines: THREE.Object3D[] = [];
  const drones: THREE.Object3D[] = [];
  const droneHome: THREE.Vector3[] = [];

  if (isSwarm) {
    const pack: Array<[number, number, number, number]> = [
      [0.05, 0.18, 0.05, 1],
      [-0.62, 0.42, 0.38, 0.82],
      [0.58, 0.08, 0.42, 0.78],
      [-0.48, -0.12, -0.4, 0.86],
      [0.52, 0.48, -0.28, 0.74],
      [0.02, 0.62, 0.18, 0.7],
      [-0.18, -0.38, 0.22, 0.8]
    ];
    pack.forEach((spec) => {
      const drone = makeCard(liveMap, width, height, !isPlayer);
      drone.position.set(spec[0], spec[1], spec[2]);
      drone.scale.multiplyScalar(spec[3]);
      root.add(drone);
      hullMeshes.push(drone);
      drones.push(drone);
      droneHome.push(new THREE.Vector3(spec[0], spec[1], spec[2]));
    });
  } else {
    const card = makeCard(liveMap, width, height, !isPlayer);
    root.add(card);
    hullMeshes.push(card);
  }

  const flare = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: flareTexture(),
      color: paint.glow,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true
    })
  );
  flare.position.set(isPlayer ? -width * 0.22 : width * 0.22, -height * 0.06, -0.12);
  flare.scale.set(height * 0.22, height * 0.22, 1);
  root.add(flare);
  engines.push(flare);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(isPlayer ? width * 0.3 : -width * 0.3, height * 0.06, 0.18);
  root.add(muzzle);

  const shield = new THREE.Mesh(
    new THREE.SphereGeometry(Math.max(width, height) * (isSwarm ? 0.85 : 0.55), 24, 16),
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
    shield,
    liveMap,
    wreckMap,
    restYaw
  };
}

export function wreckShip(built: BuiltShip): void {
  built.hullMeshes.forEach((mesh) => {
    const mat = mesh.material as THREE.MeshBasicMaterial;
    if (built.wreckMap) {
      mat.map = built.wreckMap;
    }
    mat.color.setHex(0x9a9a9a);
    mat.needsUpdate = true;
  });
  built.engines.forEach((engine) => {
    engine.visible = false;
  });
}
