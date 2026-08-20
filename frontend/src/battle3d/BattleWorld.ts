import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { classVisual, factionVisual, portraitLoadJobs } from '../utils/battleCatalog';
import { buildShip, wreckShip, ShipArt, type BuiltShip } from './hulls';
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

const INNER_X = 6.2;
const OUTER_X = 8.7;
const ROW_Z = [-4.05, -1.35, 1.35, 4.05];

export function slotWorld(isPlayer: boolean, index: number): { pos: THREE.Vector3 } {
  const col = ((index % 2) + 2) % 2;
  const row = Math.floor(index / 2);
  const inner = col === 1;
  const xAbs = inner ? INNER_X : OUTER_X;
  const x = isPlayer ? -xAbs : xAbs;
  const z = ROW_Z[row] ?? (row - 1.5) * 2.9;
  const y = inner ? 0.95 : 1.45;
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
  private camBase = new THREE.Vector3(0, 3.15, 17.4);
  private look = new THREE.Vector3(0, 1.15, 0);
  private shake = 0;
  private live = false;
  private shotLight: THREE.PointLight;
  private resizeHandler: () => void;
  private projector = new THREE.Vector3();
  private art = new ShipArt();

  constructor() {
    this.host = getBattleCanvas();
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.host,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setClearColor(0x05010c, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.1, 180);
    this.camera.position.copy(this.camBase);
    this.camera.lookAt(this.look);

    const renderPass = new RenderPass(this.scene, this.camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1920, 1080), 0.32, 0.3, 0.58);
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
      'assets/fx/vfx_bolt.png',
      'assets/fx/vfx_slug.png',
      'assets/fx/vfx_impact.png',
      'assets/fx/vfx_ring.png'
    ];
    await Promise.all([
      ...portraitLoadJobs().map((job) => this.art.load(job.path)),
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
    const pose = slotWorld(isPlayer, slot);
    const built = buildShip(faction, unitClass, isPlayer, this.art);
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
      restYaw: built.restYaw
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
    this.projector.copy(unit.built.root.position);
    this.projector.y += 1.55;
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
    const lunge = origin.clone().add(toward.multiplyScalar(0.55));
    const bank = attacker.isPlayer ? -0.18 : 0.18;
    const startYaw = attacker.built.root.rotation.y;

    this.tween(0.16, (k) => {
      attacker.built.root.position.lerpVectors(origin, lunge, k);
      attacker.built.root.rotation.z = bank * k;
      attacker.built.root.rotation.y = startYaw + (attacker.isPlayer ? 0.08 : -0.08) * k;
    }, () => {
      this.fire(attacker, target, vis.shot, paint.glow, !!opts.crit, () => {
        opts.onHit?.();
        this.tween(0.22, (k) => {
          attacker.built.root.position.lerpVectors(lunge, origin, k);
          attacker.built.root.rotation.z = bank * (1 - k);
          attacker.built.root.rotation.y = startYaw + (attacker.isPlayer ? 0.08 : -0.08) * (1 - k);
        }, () => {
          attacker.built.root.position.copy(origin);
          attacker.built.root.rotation.z = 0;
          attacker.built.root.rotation.y = attacker.restYaw;
          attacker.busy = false;
        }, easeInOutSine);
      });
    }, easeOutCubic);
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
    const knock = home.clone().add(dir.multiplyScalar(heavy ? 0.55 : 0.32));
    this.flashHit(target.built.root.position, crit ? 0xffe566 : factionVisual(target.faction).glow, heavy);
    this.shake = Math.max(this.shake, heavy || crit ? 0.22 : 0.1);
    this.tween(0.16, (k) => {
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
    this.shake = Math.max(this.shake, 0.38);
    const start = target.built.root.rotation.z;
    this.tween(0.8, (k) => {
      target.built.root.rotation.z = start + 0.18 * k;
      target.built.root.position.y = target.home.y - 0.12 * k;
    });
  }

  dimForResult(): void {
    this.bloom.strength = 0.38;
    this.tween(0.6, (k) => {
      this.renderer.toneMappingExposure = 1.12 - k * 0.35;
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
      if (unit.alive) {
        unit.built.drones.forEach((drone, i) => {
          const home = unit.built.droneHome[i];
          if (!home) {
            return;
          }
          drone.position.x = home.x + Math.sin(t * 2.1 + s + i) * 0.07;
          drone.position.y = home.y + Math.cos(t * 1.7 + s * 1.4 + i) * 0.06;
          drone.position.z = home.z + Math.sin(t * 1.9 + i * 0.7) * 0.05;
          drone.rotation.z = Math.sin(t * 1.6 + i) * 0.14;
          drone.rotation.x = Math.cos(t * 1.2 + i) * 0.06;
        });
      }
      unit.built.engines.forEach((engine) => {
        const sprite = engine as THREE.Sprite;
        if (sprite.material) {
          sprite.material.opacity = 0.4 + Math.sin(t * 6.5 + s) * 0.28;
        }
      });
      if (unit.busy || !unit.alive) {
        return;
      }
      unit.built.root.position.x = unit.home.x + Math.sin(t * 0.65 + s) * 0.12 + Math.sin(t * 1.35 + s * 2) * 0.04;
      unit.built.root.position.y = unit.home.y + Math.sin(t * 1.05 + s) * 0.16 + Math.cos(t * 0.55 + s) * 0.05;
      unit.built.root.position.z = unit.home.z + Math.cos(t * 0.8 + s * 1.3) * 0.14;
      unit.built.root.rotation.y = unit.restYaw + Math.sin(t * 0.58 + s) * 0.07;
      unit.built.root.rotation.z = Math.sin(t * 0.92 + s) * 0.055;
      unit.built.root.rotation.x = Math.sin(t * 0.47 + s * 0.8) * 0.03;
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

    this.shake *= Math.pow(0.04, dt * 4);
    const cam = this.camBase.clone();
    cam.x += Math.sin(this.clock * 0.12) * 0.22;
    cam.y += Math.cos(this.clock * 0.09) * 0.1;
    cam.x += (Math.random() - 0.5) * this.shake;
    cam.y += (Math.random() - 0.5) * this.shake;
    this.camera.position.copy(cam);
    this.camera.lookAt(this.look);

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
    kind: string,
    glow: number,
    crit: boolean,
    onHit: () => void
  ): void {
    const from = attacker.built.root.position.clone();
    from.x += attacker.isPlayer ? 1.55 : -1.55;
    from.y += 1.05;
    const to = target.built.root.position.clone();
    to.y += 0.95;
    const color = crit ? 0xffe9a0 : glow;
    this.shotLight.color.setHex(color);
    this.shotLight.position.copy(from);
    this.shotLight.intensity = crit ? 8 : 5;

    if (kind === 'beam') {
      this.beam(from, to, color, onHit);
      return;
    }
    if (kind === 'slug') {
      this.bolt(from, to, color, 0.28, 0.32, true, onHit);
      return;
    }
    if (kind === 'needle') {
      const vis = classVisual(attacker.unitClass);
      for (let i = 0; i < vis.count; i++) {
        const perp = new THREE.Vector3(0, 1, 0).cross(to.clone().sub(from).normalize()).normalize();
        const off = (i - (vis.count - 1) / 2) * 0.22;
        const a = from.clone().add(perp.clone().multiplyScalar(off));
        const b = to.clone().add(perp.clone().multiplyScalar(off));
        this.after(i * vis.stagger / 1000, () => {
          this.bolt(a, b, color, 0.07, vis.travel / 1000, false, i === 0 ? onHit : undefined);
        });
      }
      return;
    }
    this.bolt(from, to, color, 0.11, 0.16, false, onHit);
  }

  private bolt(
    from: THREE.Vector3,
    to: THREE.Vector3,
    color: number,
    radius: number,
    duration: number,
    heavy: boolean,
    onHit?: () => void
  ): void {
    const dir = to.clone().sub(from);
    const len = dir.length();
    const geom = new THREE.CapsuleGeometry(radius, Math.max(0.4, len * 0.22), 4, 8);
    geom.rotateZ(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(from);
    mesh.lookAt(to);
    mesh.rotateY(Math.PI / 2);
    this.scene.add(mesh);
    this.fx.push(mesh);
    this.tween(duration, (k) => {
      mesh.position.lerpVectors(from, to, k);
      this.shotLight.position.copy(mesh.position);
    }, () => {
      onHit?.();
      this.flashHit(to, color, heavy);
      this.scene.remove(mesh);
      geom.dispose();
      mat.dispose();
    }, heavy ? easeOutCubic : easeOutCubic);
  }

  private beam(from: THREE.Vector3, to: THREE.Vector3, color: number, onHit: () => void): void {
    const dist = from.distanceTo(to);
    const geom = new THREE.CylinderGeometry(0.06, 0.06, dist, 10);
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
    mesh.lookAt(to);
    mesh.rotateY(Math.PI / 2);
    this.scene.add(mesh);
    this.fx.push(mesh);
    this.tween(0.06, (k) => {
      mat.opacity = k;
      mesh.scale.set(1, 1 + k * 0.4, 1 + k * 0.4);
    }, () => {
      onHit();
      this.flashHit(to, color, false);
      this.tween(0.28, (k) => {
        mat.opacity = 1 - k;
      }, () => {
        this.scene.remove(mesh);
        geom.dispose();
        mat.dispose();
      });
    });
  }

  private flashHit(pos: THREE.Vector3, color: number, heavy: boolean): void {
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
    this.shotLight.position.copy(pos);
    this.shotLight.intensity = heavy ? 10 : 6;
    this.tween(0.22, (k) => {
      mesh.scale.setScalar(1 + k * (heavy ? 2.4 : 1.6));
      mat.opacity = 0.95 * (1 - k);
    }, () => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      mat.dispose();
    });

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
      ring.scale.setScalar(1 + k * 6);
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - k);
    }, () => {
      this.scene.remove(ring);
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
    });
  }

  private explode(pos: THREE.Vector3, color: number): void {
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
    const hemi = new THREE.HemisphereLight(0xc8d8ff, 0x120818, 0.9);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff4e8, 2.2);
    key.position.set(8, 14, 18);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x88a6ff, 1.4);
    rim.position.set(-12, 6, -10);
    this.scene.add(rim);
  }

  private buildSpace(): void {
    this.scene.background = new THREE.Color(0x070414);
    const stars = this.art.get('assets/background/stars.png');
    if (stars) {
      stars.colorSpace = THREE.SRGBColorSpace;
      this.scene.background = stars;
    }
    const nebula = this.art.get('assets/background/nebula_close.png');
    if (nebula) {
      nebula.colorSpace = THREE.SRGBColorSpace;
      const veil = new THREE.Mesh(
        new THREE.PlaneGeometry(48, 28),
        new THREE.MeshBasicMaterial({
          map: nebula,
          transparent: true,
          opacity: 0.22,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide
        })
      );
      veil.position.set(-4, 4.2, -20);
      (veil.material as THREE.MeshBasicMaterial).opacity = 0.16;
      this.scene.add(veil);
    }

    const starGeo = new THREE.BufferGeometry();
    const count = 1600;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 22 + Math.random() * 40;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      const c = 0.75 + Math.random() * 0.25;
      colors[i * 3] = c;
      colors[i * 3 + 1] = c;
      colors[i * 3 + 2] = c;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.scene.add(new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ size: 0.11, vertexColors: true, transparent: true, opacity: 0.85 })
    ));
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
