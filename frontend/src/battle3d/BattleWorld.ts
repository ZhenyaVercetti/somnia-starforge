import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {
  battleFxLoadJobs,
  battleFxPath,
  classVisual,
  droneLoadJobs,
  factionVisual,
  portraitLoadJobs,
  type ClassVisual
} from '../utils/battleCatalog';
import { buildShip, wreckShip, ShipArt, flareTexture, type BuiltShip } from './hulls';
import { getBattleCanvas, hideBattleCanvas, syncBattleCanvas } from './canvasHost';

export type WorldUnit = {
  id: string;
  isPlayer: boolean;
  slot: number;
  faction: number;
  unitClass: number;
  built: BuiltShip;
  home: THREE.Vector3;
  alive: boolean;
  busy: boolean;
  seed: number;
  restYaw: number;
  restPitch: number;
};

type Tween = {
  elapsed: number;
  duration: number;
  update: (k: number) => void;
  complete?: () => void;
  ease: (t: number) => number;
};

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

const ROW_Z = [-6.55, -2.18, 2.18, 6.55];
const INNER_X = 4.35;
const OUTER_X = 9.05;
const X_AXIS = new THREE.Vector3(1, 0, 0);

export function slotWorld(isPlayer: boolean, index: number, unitClass = 0): { pos: THREE.Vector3 } {
  const vis = classVisual(unitClass);
  const col = ((index % 2) + 2) % 2;
  const row = Math.floor(index / 2);
  const inner = col === 1;
  const xAbs = (inner ? INNER_X : OUTER_X) + vis.rear - vis.forward;
  const y = (inner ? 1.05 : 1.48) + vis.lift;
  const z = (ROW_Z[row] ?? (row - 1.5) * 4.35) + (inner ? 0.12 : -0.12);
  const x = isPlayer ? -xAbs : xAbs;
  return { pos: new THREE.Vector3(x, y, z) };
}

export class BattleWorld {
  private host: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private gameCanvas: HTMLCanvasElement | null = null;
  private units = new Map<string, WorldUnit>();
  private tweens: Tween[] = [];
  private fx: THREE.Object3D[] = [];
  private timeScale = 1;
  private clock = 0;
  private camBase = new THREE.Vector3(0, 5.15, 21.6);
  private look = new THREE.Vector3(0, 1.28, 0);
  private shake = 0;
  private live = false;
  private resultFocus = false;
  private shotLight: THREE.PointLight;
  private resizeHandler: () => void;
  private projector = new THREE.Vector3();
  private art = new ShipArt();
  private spaceLayers: Array<{ obj: THREE.Object3D; origin: THREE.Vector3; px: number; py: number }> = [];
  private dustNear: THREE.Points | null = null;
  private dustFar: THREE.Points | null = null;
  private starNear: THREE.Points | null = null;

  constructor() {
    this.host = getBattleCanvas();
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.host,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setClearColor(0x04010a, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 280);
    this.camera.position.copy(this.camBase);
    this.camera.lookAt(this.look);

    const renderPass = new RenderPass(this.scene, this.camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1920, 1080), 0.34, 0.42, 0.52);
    const output = new OutputPass();
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(output);

    this.shotLight = new THREE.PointLight(0x9fd6ff, 0, 28, 2);
    this.scene.add(this.shotLight);
    this.buildLights();

    this.resizeHandler = () => this.syncSize();
    window.addEventListener('resize', this.resizeHandler);
  }

  async mount(gameCanvas: HTMLCanvasElement): Promise<void> {
    this.gameCanvas = gameCanvas;
    this.live = true;
    this.syncSize();
    const extra = [
      'assets/background/stars.png',
      'assets/background/nebula_close.png',
      'assets/background/nebula_mid.png'
    ];
    await Promise.all([
      ...portraitLoadJobs().map((job) => this.art.load(job.path)),
      ...droneLoadJobs().map((job) => this.art.load(job.path)),
      ...battleFxLoadJobs().map((job) => this.art.load(job.path)),
      ...extra.map((path) => this.art.load(path))
    ]);
    this.buildSpace();
  }

  setTimeScale(scale: number): void {
    this.timeScale = scale;
  }

  spawn(
    isPlayer: boolean,
    slot: number,
    faction: number,
    unitClass: number
  ): WorldUnit {
    const id = `${isPlayer ? 'p' : 'a'}-${slot}`;
    const pose = slotWorld(isPlayer, slot, unitClass);
    const built = buildShip(faction, unitClass, isPlayer, this.art);
    const restPitch = ((slot % 4) - 1.5) * 0.018;
    built.restYaw += ((slot % 2) === 0 ? -0.03 : 0.03);
    built.root.rotation.y = built.restYaw;
    built.root.rotation.x = restPitch;
    built.root.position.copy(pose.pos);
    this.scene.add(built.root);
    const unit: WorldUnit = {
      id,
      isPlayer,
      slot,
      faction,
      unitClass,
      built,
      home: pose.pos.clone(),
      alive: true,
      busy: false,
      seed: Math.random() * 10,
      restYaw: built.restYaw,
      restPitch
    };
    this.units.set(id, unit);
    return unit;
  }

  get(id: string): WorldUnit | undefined {
    return this.units.get(id);
  }

  project(id: string): { x: number; y: number } | null {
    const unit = this.units.get(id);
    if (!unit) {
      return null;
    }
    const vis = classVisual(unit.unitClass);
    this.projector.copy(unit.built.root.position);
    this.projector.y += vis.hpLift;
    this.projector.project(this.camera);
    return {
      x: (this.projector.x * 0.5 + 0.5) * 1920,
      y: (-this.projector.y * 0.5 + 0.5) * 1080
    };
  }

  playAttack(
    attackerId: string,
    targetId: string,
    opts: { crit?: boolean; onHit?: () => void }
  ): void {
    const attacker = this.units.get(attackerId);
    const target = this.units.get(targetId);
    if (!attacker || !target) {
      opts.onHit?.();
      return;
    }
    const vis = classVisual(attacker.unitClass);
    const paint = factionVisual(attacker.faction);
    attacker.busy = true;
    const origin = attacker.home.clone();
    const toward = target.home.clone().sub(origin).normalize();
    const lunge = origin.clone().add(toward.multiplyScalar(vis.slug === 'dreadnought' ? 0.18 : 0.28));
    const bank = attacker.isPlayer ? -0.07 : 0.07;

    this.tween(0.28, (k) => {
      attacker.built.root.position.lerpVectors(origin, lunge, k);
      attacker.built.root.rotation.z = bank * k;
    }, () => {
      this.fire(attacker, target, vis, paint.glow, !!opts.crit, () => {
        opts.onHit?.();
        this.tween(0.34, (k) => {
          attacker.built.root.position.lerpVectors(lunge, origin, k);
          attacker.built.root.rotation.z = bank * (1 - k);
        }, () => {
          attacker.built.root.position.copy(origin);
          attacker.built.root.rotation.z = 0;
          attacker.built.root.rotation.y = attacker.restYaw;
          attacker.built.root.rotation.x = attacker.restPitch;
          attacker.busy = false;
        }, easeInOutSine);
      });
    }, easeInOutSine);
  }

  playImpact(targetId: string, fromId: string, heavy: boolean, crit: boolean): void {
    const target = this.units.get(targetId);
    const from = this.units.get(fromId);
    if (!target) {
      return;
    }
    const home = target.home.clone();
    const dir = from
      ? target.home.clone().sub(from.home).normalize()
      : new THREE.Vector3(target.isPlayer ? -1 : 1, 0, 0);
    const knock = home.clone().add(dir.multiplyScalar(heavy ? 0.28 : 0.14));
    this.flashHit(target.built.root.position, crit ? 0xffe566 : factionVisual(target.faction).glow, heavy);
    this.shake = Math.max(this.shake, heavy || crit ? 0.1 : 0.04);
    this.tween(0.24, (k) => {
      const u = k < 0.45 ? k / 0.45 : 1 - (k - 0.45) / 0.55;
      target.built.root.position.lerpVectors(home, knock, u);
    }, () => target.built.root.position.copy(home), easeInOutSine);
  }

  playDodge(targetId: string, fromId: string): void {
    const target = this.units.get(targetId);
    const from = this.units.get(fromId);
    if (!target) {
      return;
    }
    const home = target.home.clone();
    const away = from
      ? new THREE.Vector3().crossVectors(
        target.home.clone().sub(from.home).normalize(),
        new THREE.Vector3(0, 1, 0)
      ).normalize()
      : new THREE.Vector3(0, 0, 1);
    const slip = home.clone().add(away.multiplyScalar(target.isPlayer ? 0.9 : -0.9));
    slip.y += 0.2;
    this.tween(0.2, (k) => {
      const u = k < 0.5 ? k / 0.5 : 1 - (k - 0.5) / 0.5;
      target.built.root.position.lerpVectors(home, slip, u);
    }, () => target.built.root.position.copy(home), easeInOutSine);
  }

  playLastStand(targetId: string): void {
    const target = this.units.get(targetId);
    if (!target) {
      return;
    }
    const shield = target.built.shield;
    shield.visible = true;
    const mat = shield.material as THREE.MeshBasicMaterial;
    mat.color.setHex(0xff6b7a);
    mat.opacity = 0.7;
    shield.scale.setScalar(0.7);
    this.tween(0.55, (k) => {
      shield.scale.setScalar(0.7 + k * 0.7);
      mat.opacity = 0.7 * (1 - k);
    }, () => {
      shield.visible = false;
      mat.opacity = 0;
    });
  }

  kill(targetId: string): void {
    const target = this.units.get(targetId);
    if (!target || !target.alive) {
      return;
    }
    target.alive = false;
    target.busy = false;
    this.explode(target.built.root.position.clone(), factionVisual(target.faction).glow);
    wreckShip(target.built);
    this.shake = Math.max(this.shake, 0.16);
    const start = target.built.root.rotation.z;
    this.tween(0.8, (k) => {
      target.built.root.rotation.z = start + 0.18 * k;
      target.built.root.position.y = target.home.y - 0.12 * k;
    });
  }

  dimForResult(): void {
    this.bloom.strength = 0.26;
    this.tween(0.8, (k) => {
      this.renderer.toneMappingExposure = 1.08 - k * 0.22;
    }, undefined, easeInOutSine);
  }

  focusWinner(playerWon: boolean): void {
    this.resultFocus = true;
    const side = playerWon ? -1 : 1;
    const startCam = this.camBase.clone();
    const startLook = this.look.clone();
    const targetCam = new THREE.Vector3(side * 3.6, 3.9, 14.6);
    const targetLook = new THREE.Vector3(side * 6.1, 1.25, 0);
    this.tween(1.6, (k) => {
      this.camBase.lerpVectors(startCam, targetCam, k);
      this.look.lerpVectors(startLook, targetLook, k);
    }, undefined, easeInOutSine);
    this.units.forEach((unit) => {
      if (unit.isPlayer === playerWon) {
        return;
      }
      unit.built.hullMeshes.forEach((mesh) => {
        const mat = mesh.material as THREE.MeshBasicMaterial;
        mat.color.multiplyScalar(0.38);
      });
      unit.built.engines.forEach((engine) => {
        engine.visible = false;
      });
    });
  }

  tick(dtMs: number): void {
    if (!this.live) {
      return;
    }
    const dt = Math.min(0.05, dtMs / 1000) * this.timeScale;
    this.clock += dt;
    this.syncSize();

    this.units.forEach((unit) => {
      const t = this.clock;
      const s = unit.seed;
      const vis = classVisual(unit.unitClass);
      if (unit.alive) {
        unit.built.drones.forEach((drone, i) => {
          const home = unit.built.droneHome[i];
          if (!home) {
            return;
          }
          drone.position.x = home.x + Math.sin(t * 0.55 + s + i * 0.7) * 0.045;
          drone.position.y = home.y + Math.cos(t * 0.42 + s * 1.1 + i) * 0.035;
          drone.position.z = home.z + Math.sin(t * 0.38 + i * 0.5) * 0.03;
          drone.rotation.z = Math.sin(t * 0.48 + i) * 0.05;
          drone.rotation.x = Math.cos(t * 0.36 + i) * 0.02;
        });
      }
      unit.built.engines.forEach((engine, i) => {
        const sprite = engine as THREE.Sprite;
        if (sprite.material) {
          const soft = !!sprite.userData.soft;
          sprite.material.opacity = soft
            ? 0.12 + Math.sin(t * 0.6 + s) * 0.03
            : 0.48 + Math.sin(t * 2.1 + s + i) * 0.1;
        }
      });
      if (unit.busy || !unit.alive) {
        return;
      }
      const amp = vis.slug === 'dreadnought' ? 0.028 : vis.slug === 'cruiser' ? 0.038 : vis.slug === 'droneswarm' ? 0.05 : 0.042;
      unit.built.root.position.x = unit.home.x + Math.sin(t * 0.28 + s) * amp;
      unit.built.root.position.y = unit.home.y + Math.sin(t * 0.34 + s * 0.7) * amp * 0.7;
      unit.built.root.position.z = unit.home.z + Math.cos(t * 0.24 + s * 0.9) * amp * 0.55;
      unit.built.root.rotation.y = unit.restYaw + Math.sin(t * 0.22 + s) * 0.012;
      unit.built.root.rotation.z = Math.sin(t * 0.26 + s) * 0.01;
      unit.built.root.rotation.x = unit.restPitch + Math.sin(t * 0.2 + s * 0.6) * 0.008;
    });

    const incoming = this.tweens;
    this.tweens = [];
    incoming.forEach((tw) => {
      tw.elapsed += dt;
      const k = Math.min(1, tw.elapsed / tw.duration);
      tw.update(tw.ease(k));
      if (k >= 1) {
        tw.complete?.();
      } else {
        this.tweens.push(tw);
      }
    });

    this.shake *= Math.pow(0.08, dt * 3);
    const cam = this.camBase.clone();
    if (this.resultFocus) {
      cam.x += Math.sin(this.clock * 0.18) * 0.22;
      cam.y += Math.cos(this.clock * 0.14) * 0.08;
    } else {
      cam.x += Math.sin(this.clock * 0.045) * 0.32;
      cam.y += Math.cos(this.clock * 0.033) * 0.16;
    }
    cam.x += this.shake * 0.4;
    cam.y += this.shake * 0.25;
    this.camera.position.copy(cam);
    this.camera.lookAt(this.look);
    this.tickSpace(cam);

    this.shotLight.intensity *= Math.pow(0.001, dt);
    this.composer.render();
  }

  dispose(): void {
    this.live = false;
    window.removeEventListener('resize', this.resizeHandler);
    this.tweens = [];
    this.units.forEach((unit) => {
      this.scene.remove(unit.built.root);
    });
    this.units.clear();
    this.fx.forEach((obj) => this.scene.remove(obj));
    this.fx = [];
    this.composer.dispose();
    this.renderer.dispose();
    hideBattleCanvas(this.host);
  }

  private fire(
    attacker: WorldUnit,
    target: WorldUnit,
    vis: ClassVisual,
    glow: number,
    crit: boolean,
    onHit: () => void
  ): void {
    const to = new THREE.Vector3();
    target.built.root.getWorldPosition(to);
    to.y += 0.55;
    const color = crit ? 0xffe9a0 : glow;
    const from = new THREE.Vector3();
    attacker.built.muzzle.getWorldPosition(from);
    this.shotLight.color.setHex(color);
    this.shotLight.position.copy(from);
    this.shotLight.intensity = crit ? 4.2 : 2.6;
    this.muzzleFlash(from, color, vis.slug === 'dreadnought' ? 0.85 : 0.55);

    if (vis.shot === 'beam') {
      this.beam(from, to, color, onHit);
      return;
    }
    if (vis.shot === 'slug') {
      this.dart(from, to, color, 0.09, 0.72, vis.travel / 1000, true, onHit);
      return;
    }
    if (vis.shot === 'needle') {
      const muzzles = attacker.built.droneMuzzles.length > 0
        ? attacker.built.droneMuzzles
        : [attacker.built.muzzle];
      const shots = Math.min(vis.count, muzzles.length);
      for (let i = 0; i < shots; i++) {
        const muzzle = muzzles[i];
        this.after(i * vis.stagger / 1000, () => {
          const a = new THREE.Vector3();
          muzzle.getWorldPosition(a);
          const b = to.clone();
          b.y += (i - (shots - 1) / 2) * 0.1;
          b.z += (i - (shots - 1) / 2) * 0.12;
          this.muzzleFlash(a, color, 0.32);
          this.dart(a, b, color, 0.018, 0.32, vis.travel / 1000, false, i === 0 ? onHit : undefined);
        });
      }
      return;
    }
    this.dart(from, to, color, 0.038, 0.48, vis.travel / 1000, false, onHit);
  }

  private dart(
    from: THREE.Vector3,
    to: THREE.Vector3,
    color: number,
    radius: number,
    length: number,
    duration: number,
    heavy: boolean,
    onHit?: () => void
  ): void {
    const geom = new THREE.CapsuleGeometry(radius, length, 3, 6);
    geom.rotateZ(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(from);
    this.aimAlong(mesh, from, to);
    this.scene.add(mesh);
    this.fx.push(mesh);
    this.tween(duration, (k) => {
      mesh.position.lerpVectors(from, to, k);
      this.aimAlong(mesh, from, to);
      this.shotLight.position.copy(mesh.position);
    }, () => {
      onHit?.();
      this.flashHit(to, color, heavy);
      this.scene.remove(mesh);
      geom.dispose();
      mat.dispose();
    }, easeOutCubic);
  }

  private aimAlong(mesh: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3): void {
    const dir = to.clone().sub(from);
    if (dir.lengthSq() < 0.0001) {
      return;
    }
    dir.normalize();
    mesh.quaternion.setFromUnitVectors(X_AXIS, dir);
  }

  private muzzleFlash(pos: THREE.Vector3, color: number, scale: number): void {
    const tex = this.art.get(battleFxPath('shot_muzzle'));
    const mat = new THREE.SpriteMaterial({
      map: tex,
      color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(pos);
    sprite.scale.set(0.22 * scale, 0.22 * scale, 1);
    this.scene.add(sprite);
    this.fx.push(sprite);
    this.tween(0.12, (k) => {
      sprite.scale.setScalar(0.22 * scale * (1 + k * 1.1));
      mat.opacity = 0.85 * (1 - k);
    }, () => {
      this.scene.remove(sprite);
      mat.dispose();
    });
  }

  private beam(from: THREE.Vector3, to: THREE.Vector3, color: number, onHit: () => void): void {
    const dist = from.distanceTo(to);
    const geom = new THREE.CylinderGeometry(0.016, 0.022, dist, 8);
    geom.rotateZ(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    this.aimAlong(mesh, from, to);
    this.scene.add(mesh);
    this.fx.push(mesh);

    const glowGeom = new THREE.CylinderGeometry(0.045, 0.06, dist, 8);
    glowGeom.rotateZ(-Math.PI / 2);
    const glowMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const glow = new THREE.Mesh(glowGeom, glowMat);
    glow.position.copy(mesh.position);
    glow.quaternion.copy(mesh.quaternion);
    this.scene.add(glow);

    this.tween(0.07, (k) => {
      mat.opacity = k;
      glowMat.opacity = k * 0.35;
      mesh.scale.set(1, 1 + k * 0.35, 1 + k * 0.35);
    }, () => {
      onHit();
      this.flashHit(to, color, false);
      this.tween(0.3, (k) => {
        mat.opacity = 1 - k;
        glowMat.opacity = 0.35 * (1 - k);
      }, () => {
        this.scene.remove(mesh);
        this.scene.remove(glow);
        geom.dispose();
        mat.dispose();
        glowGeom.dispose();
        glowMat.dispose();
      });
    });
  }

  private flashHit(pos: THREE.Vector3, color: number, heavy: boolean): void {
    const tex = this.art.get(battleFxPath('shot_impact'));
    if (tex) {
      const mat = new THREE.SpriteMaterial({
        map: tex,
        color,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const sprite = new THREE.Sprite(mat);
      sprite.position.copy(pos);
      const start = heavy ? 0.42 : 0.24;
      sprite.scale.setScalar(start);
      this.scene.add(sprite);
      this.fx.push(sprite);
      this.shotLight.position.copy(pos);
      this.shotLight.intensity = heavy ? 5 : 3;
      this.tween(heavy ? 0.22 : 0.16, (k) => {
        sprite.scale.setScalar(start * (1 + k * (heavy ? 1.35 : 0.9)));
        mat.opacity = 1 - k;
      }, () => {
        this.scene.remove(sprite);
        mat.dispose();
      });
    } else {
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(heavy ? 0.55 : 0.32, 14, 12), mat);
      mesh.position.copy(pos);
      this.scene.add(mesh);
      this.fx.push(mesh);
      this.tween(0.22, (k) => {
        mesh.scale.setScalar(1 + k * (heavy ? 2.4 : 1.6));
        mat.opacity = 0.95 * (1 - k);
      }, () => {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        mat.dispose();
      });
    }

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.15, 0.03, 8, 24),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    ring.position.copy(pos);
    ring.lookAt(this.camera.position);
    this.scene.add(ring);
    this.tween(0.28, (k) => {
      ring.scale.setScalar(1 + k * 2.8);
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - k);
    }, () => {
      this.scene.remove(ring);
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
    });
  }

  private explode(pos: THREE.Vector3, color: number): void {
    this.flashHit(pos, color, true);
    for (let i = 0; i < 3; i++) {
      const delay = i * 0.04;
      this.after(delay, () => {
        const mat = new THREE.MeshBasicMaterial({
          color: i === 0 ? 0xfff4d0 : color,
          transparent: true,
          opacity: 1,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.4 + i * 0.15, 16, 14), mat);
        mesh.position.copy(pos);
        this.scene.add(mesh);
        this.tween(0.35 + i * 0.08, (k) => {
          mesh.scale.setScalar(1 + k * (2.8 + i));
          mat.opacity = 1 - k;
        }, () => {
          this.scene.remove(mesh);
          mesh.geometry.dispose();
          mat.dispose();
        });
      });
    }
  }

  private buildLights(): void {
    const hemi = new THREE.HemisphereLight(0x8aa4d8, 0x120814, 0.55);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffe6c8, 1.35);
    key.position.set(16, 12, 10);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x7a5cff, 1.05);
    rim.position.set(-14, 3, -8);
    this.scene.add(rim);
    const fill = new THREE.DirectionalLight(0x3a6a88, 0.35);
    fill.position.set(0, -8, 12);
    this.scene.add(fill);
  }

  private buildSpace(): void {
    this.scene.background = new THREE.Color(0x03010a);
    this.scene.fog = new THREE.FogExp2(0x070312, 0.012);
    this.spaceLayers = [];

    const starsTex = this.art.get('assets/background/stars.png');
    if (starsTex) {
      starsTex.colorSpace = THREE.SRGBColorSpace;
      const sky = new THREE.Mesh(
        new THREE.SphereGeometry(130, 32, 24),
        new THREE.MeshBasicMaterial({
          map: starsTex,
          side: THREE.BackSide,
          depthWrite: false,
          fog: false
        })
      );
      this.placeLayer(sky, new THREE.Vector3(0, 0, 0), 0.03, 0.02);
    }

    this.addNebula('assets/background/nebula_mid.png', 110, 62, new THREE.Vector3(10, 8, -62), 0.22, 0.1, 0.07);
    this.addNebula('assets/background/nebula_mid.png', 70, 40, new THREE.Vector3(-18, -6, -38), 0.14, 0.2, 0.14);
    this.addNebula('assets/background/nebula_close.png', 42, 26, new THREE.Vector3(-22, 9, -24), 0.08, 0.32, 0.22);
    this.addNebula('assets/background/nebula_close.png', 34, 20, new THREE.Vector3(20, -4, -18), 0.06, 0.38, 0.26);

    const sun = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: flareTexture(),
        color: 0xffd8a8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0.85,
        fog: false
      })
    );
    sun.scale.set(11, 11, 1);
    this.placeLayer(sun, new THREE.Vector3(34, 16, -48), 0.08, 0.05);

    this.scene.add(this.scatterPoints(2400, 48, 125, 0.16, 0.62, true));
    this.starNear = this.scatterBox(90, -14, 14, -3, 7, 5, 16, 0.055, 0.7);
    this.dustFar = this.scatterBox(520, -22, 22, -8, 12, -18, 8, 0.09, 0.16);
    this.dustNear = this.scatterBox(220, -10, 10, -2, 6, 6, 17, 0.05, 0.22);
    this.scene.add(this.starNear);
    this.scene.add(this.dustFar);
    this.scene.add(this.dustNear);
  }

  private addNebula(
    path: string,
    width: number,
    height: number,
    origin: THREE.Vector3,
    opacity: number,
    px: number,
    py: number
  ): void {
    const map = this.art.get(path);
    if (!map) {
      return;
    }
    map.colorSpace = THREE.SRGBColorSpace;
    const veil = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({
        map,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false
      })
    );
    this.placeLayer(veil, origin, px, py);
  }

  private placeLayer(obj: THREE.Object3D, origin: THREE.Vector3, px: number, py: number): void {
    obj.position.copy(origin);
    this.scene.add(obj);
    this.spaceLayers.push({ obj, origin: origin.clone(), px, py });
  }

  private scatterPoints(
    count: number,
    inner: number,
    outer: number,
    size: number,
    opacity: number,
    far: boolean
  ): THREE.Points {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = inner + Math.random() * (outer - inner);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      const warm = Math.random();
      const c = 0.62 + Math.random() * 0.38;
      colors[i * 3] = warm > 0.82 ? c : warm > 0.55 ? c * 0.75 : c * 0.85;
      colors[i * 3 + 1] = warm > 0.82 ? c * 0.82 : c;
      colors[i * 3 + 2] = warm > 0.55 ? c : c * 1.05;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size,
        vertexColors: true,
        transparent: true,
        opacity,
        depthWrite: false,
        sizeAttenuation: true,
        fog: !far
      })
    );
  }

  private scatterBox(
    count: number,
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    z0: number,
    z1: number,
    size: number,
    opacity: number
  ): THREE.Points {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = x0 + Math.random() * (x1 - x0);
      positions[i * 3 + 1] = y0 + Math.random() * (y1 - y0);
      positions[i * 3 + 2] = z0 + Math.random() * (z1 - z0);
      const c = 0.45 + Math.random() * 0.55;
      colors[i * 3] = c * 0.85;
      colors[i * 3 + 1] = c * 0.9;
      colors[i * 3 + 2] = c;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size,
        vertexColors: true,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
      })
    );
  }

  private tickSpace(cam: THREE.Vector3): void {
    const t = this.clock;
    this.spaceLayers.forEach((layer) => {
      layer.obj.position.x = layer.origin.x + cam.x * layer.px;
      layer.obj.position.y = layer.origin.y + cam.y * layer.py;
    });
    if (this.dustNear) {
      this.dustNear.rotation.y = t * 0.01;
      this.dustNear.position.z = Math.sin(t * 0.07) * 0.4;
      const mat = this.dustNear.material as THREE.PointsMaterial;
      mat.opacity = 0.16 + Math.sin(t * 0.35) * 0.04;
    }
    if (this.dustFar) {
      this.dustFar.rotation.y = t * 0.004;
    }
    if (this.starNear) {
      const mat = this.starNear.material as THREE.PointsMaterial;
      mat.opacity = 0.55 + Math.sin(t * 0.9) * 0.12;
    }
  }

  private tween(
    duration: number,
    update: (k: number) => void,
    complete?: () => void,
    ease: (t: number) => number = easeOutCubic
  ): void {
    this.tweens.push({ elapsed: 0, duration: Math.max(0.01, duration), update, complete, ease });
  }

  private after(sec: number, fn: () => void): void {
    this.tween(sec, () => undefined, fn);
  }

  private syncSize(): void {
    if (!this.gameCanvas) {
      return;
    }
    const size = syncBattleCanvas(this.host, this.gameCanvas);
    const pixel = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(pixel);
    this.renderer.setSize(size.width, size.height, false);
    this.composer.setSize(size.width, size.height);
    this.camera.aspect = size.width / Math.max(1, size.height);
    this.camera.updateProjectionMatrix();
    this.bloom.setSize(size.width, size.height);
  }
}
