import * as THREE from 'three';

const FACTIONS = ['empire', 'voidborn', 'mechanoids'] as const;
const CLASSES = ['fighter', 'cruiser', 'dreadnought', 'swarm'] as const;

/** Nose sits at local +Z. tools/build_ships.py rejects a hull whose sharp end is not +Z. */
const AUTHORED_FRONT = new THREE.Vector3(0, 0, 1);
const PARENT_FORWARD = new THREE.Vector3(0, 0, -1);

export const ENGINE_COLOR = ['#7ec8ff', '#d28bff', '#ffb03a'] as const;

export function shipFile(faction: number, unitClass: number): string {
  const factionName = FACTIONS[faction] ?? FACTIONS[0];
  const className = CLASSES[unitClass] ?? CLASSES[0];
  return `${factionName}_${className}.glb`;
}

export function shipUrl(faction: number, unitClass: number): string {
  return `/assets/ships/${shipFile(faction, unitClass)}`;
}

export function prepareClone(source: THREE.Object3D, ghost: boolean): THREE.Object3D {
  const clone = source.clone(true);
  clone.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const sourceMats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const cloned = sourceMats.map((material) => {
      const next = material.clone();
      const standard = next as THREE.MeshStandardMaterial;
      if (typeof standard.envMapIntensity === 'number') standard.envMapIntensity = 1.2;
      if (ghost) {
        next.transparent = true;
        next.opacity = 0;
        next.depthWrite = false;
      }
      return next;
    });
    mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
  });
  return clone;
}

function localBox(root: THREE.Object3D): THREE.Box3 {
  root.updateWorldMatrix(true, true);
  const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const box = new THREE.Box3();
  const scratch = new THREE.Matrix4();
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const bounds = mesh.geometry.boundingBox;
    if (!bounds) return;
    const transformed = bounds.clone();
    scratch.multiplyMatrices(inverse, mesh.matrixWorld);
    transformed.applyMatrix4(scratch);
    box.union(transformed);
  });
  return box;
}

export function fitAuthoredHull(root: THREE.Object3D, mount: THREE.Object3D, target: number): void {
  root.position.set(0, 0, 0);
  root.rotation.set(0, 0, 0);
  root.scale.set(1, 1, 1);
  mount.quaternion.identity();
  root.updateWorldMatrix(true, true);
  const box = localBox(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const span = Math.max(size.x, size.z, 1e-4);
  let scale = target / span;
  if (size.y * scale > target * 2.15) {
    scale = (target * 2.15) / Math.max(size.y, 1e-4);
  }
  root.scale.setScalar(scale);
  root.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
  mount.quaternion.setFromUnitVectors(AUTHORED_FRONT, PARENT_FORWARD);
}

export function setOpacity(root: THREE.Object3D, opacity: number): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of mats) {
      material.opacity = opacity;
      material.transparent = opacity < 0.99;
    }
  });
}

const FLASH_GOLD = new THREE.Color('#ffd56a');
const FLASH_HIT = new THREE.Color('#fff1df');

export function setFlash(root: THREE.Object3D, amount: number, gold: boolean): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of mats) {
      const standard = material as THREE.MeshStandardMaterial;
      if (!standard.emissive) continue;
      const data = standard.userData as { baseEmissive?: THREE.Color; baseIntensity?: number };
      if (!data.baseEmissive) {
        data.baseEmissive = standard.emissive.clone();
        data.baseIntensity = standard.emissiveIntensity ?? 1;
      }
      if (amount <= 0.02) {
        standard.emissive.copy(data.baseEmissive);
        standard.emissiveIntensity = data.baseIntensity ?? 1;
      } else {
        const tint = gold ? FLASH_GOLD : FLASH_HIT;
        standard.emissive.copy(data.baseEmissive).lerp(tint, Math.min(1, amount) * 0.42);
        standard.emissiveIntensity = (data.baseIntensity ?? 1) + amount * 0.22;
      }
    }
  });
}

export function disposeMaterials(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of mats) material.dispose();
  });
}
