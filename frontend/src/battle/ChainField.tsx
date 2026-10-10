import { Component, Suspense, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import * as THREE from 'three';
import type { BattleEvent, BattleInitData, UnitData } from '../utils/battleTypes';
import {
  advance,
  attackerClass,
  beamVisible,
  cameraPose,
  classLength,
  droneTravel,
  hpOf,
  sideForwardX,
  sideYaw,
  slotWorld,
  unitFaction,
  unitPose,
  type PlayClock
} from './playback';
import { ENGINE_COLOR, disposeMaterials, fitAuthoredHull, prepareClone, setFlash, setOpacity, shipUrl } from './shipMount';

const SHARD = new THREE.BufferGeometry();
SHARD.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.72, 0.08, 0.04, 0.06, 0.5, -0.08], 3));
SHARD.computeVertexNormals();

const SHARD_DIRS: Array<[number, number, number]> = [
  [0.7, 0.45, 0.2],
  [-0.55, 0.7, -0.15],
  [0.2, 0.35, 0.75],
  [-0.25, 0.85, 0.35],
  [0.8, -0.15, 0.4],
  [-0.65, 0.25, 0.55]
];

type ClockRef = { current: PlayClock };

class ModelBoundary extends Component<{ children: ReactNode; onFail: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    console.error(error);
    this.props.onFail();
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

function projectLabel(
  el: HTMLDivElement | null,
  point: THREE.Vector3,
  camera: THREE.Camera,
  width: number,
  height: number,
  show: boolean
) {
  if (!el) return;
  const projected = point.project(camera);
  const x = (projected.x * 0.5 + 0.5) * width;
  const y = (-projected.y * 0.5 + 0.5) * height;
  el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -150%)`;
  el.style.opacity = show && projected.z < 1 ? '1' : '0';
}

function Ship({
  isPlayer,
  index,
  unit,
  maxHp,
  events,
  player,
  ai,
  clockRef
}: {
  isPlayer: boolean;
  index: number;
  unit: UnitData;
  maxHp: number[];
  events: BattleEvent[];
  player: UnitData[];
  ai: UnitData[];
  clockRef: ClockRef;
}) {
  const faction = unitFaction(unit);
  const unitClass = Number(unit.unitClass ?? 0);
  const url = shipUrl(faction, unitClass);
  const gltf = useLoader(GLTFLoader, url);
  const main = useMemo(() => prepareClone(gltf.scene, false), [gltf]);
  const ghost = useMemo(() => prepareClone(gltf.scene, true), [gltf]);
  const outer = useRef<THREE.Group>(null);
  const bank = useRef<THREE.Group>(null);
  const mount = useRef<THREE.Group>(null);
  const ghostGroup = useRef<THREE.Group>(null);
  const ghostMount = useRef<THREE.Group>(null);
  const engine = useRef<THREE.PointLight>(null);
  const muzzle = useRef<THREE.PointLight>(null);
  const ring = useRef<THREE.Mesh>(null);
  const shards = useRef<THREE.Group>(null);
  const hpEl = useRef<HTMLDivElement | null>(null);
  const critEl = useRef<HTMLDivElement | null>(null);
  const point = useRef(new THREE.Vector3());
  const length = classLength(unitClass >= 0 && unitClass <= 3 ? unitClass : 0);

  useLayoutEffect(() => {
    if (mount.current) fitAuthoredHull(main, mount.current, length);
    if (ghostMount.current) fitAuthoredHull(ghost, ghostMount.current, length);
    const home = slotWorld(isPlayer, index);
    if (outer.current) {
      outer.current.position.set(home[0], home[1], home[2]);
      outer.current.rotation.y = sideYaw(isPlayer);
    }
    const host = document.getElementById('chain-labels');
    if (!host) return;
    const hp = document.createElement('div');
    hp.style.position = 'absolute';
    hp.style.left = '0';
    hp.style.top = '0';
    hp.style.color = '#f4ecff';
    hp.style.fontFamily = 'Rajdhani, sans-serif';
    hp.style.fontWeight = '700';
    hp.style.fontSize = '16px';
    hp.style.textShadow = '0 1px 4px #000';
    hp.style.pointerEvents = 'none';
    const crit = document.createElement('div');
    crit.style.position = 'absolute';
    crit.style.left = '0';
    crit.style.top = '0';
    crit.style.color = '#ffd56a';
    crit.style.fontFamily = 'Orbitron, sans-serif';
    crit.style.fontSize = '28px';
    crit.style.textShadow = '0 0 10px #5a3a00';
    crit.style.pointerEvents = 'none';
    host.append(hp, crit);
    hpEl.current = hp;
    critEl.current = crit;
    return () => {
      hp.remove();
      crit.remove();
      disposeMaterials(main);
      disposeMaterials(ghost);
    };
  }, [ghost, length, main]);

  useFrame(({ camera, size }) => {
    const pose = unitPose(isPlayer, index, clockRef.current, events, player, ai);
    if (outer.current && bank.current) {
      outer.current.position.set(pose.x, pose.y, pose.z);
      outer.current.rotation.y = sideYaw(isPlayer);
      outer.current.scale.setScalar(1 - pose.hidden * 0.4);
      bank.current.rotation.x = pose.pitch;
      bank.current.rotation.z = pose.bank;
    }
    if (ghostGroup.current) {
      ghostGroup.current.position.set(pose.homeX, pose.homeY, pose.homeZ);
      ghostGroup.current.rotation.y = sideYaw(isPlayer);
      ghostGroup.current.visible = pose.ghost > 0.03;
    }
    setOpacity(main, 1 - pose.hidden * 0.96);
    setOpacity(ghost, pose.ghost);
    setFlash(main, pose.flash, pose.crit);
    if (engine.current) engine.current.intensity = pose.flare;
    if (muzzle.current) muzzle.current.intensity = pose.muzzle;
    if (ring.current) {
      const material = ring.current.material as THREE.MeshBasicMaterial;
      ring.current.visible = pose.lastStand;
      ring.current.scale.setScalar(0.4 + (1 - pose.flash) * 3.1);
      material.opacity = pose.lastStand ? pose.flash : 0;
    }
    if (shards.current) {
      shards.current.visible = pose.crit;
      shards.current.children.forEach((child, shard) => {
        const dir = SHARD_DIRS[shard];
        const travel = 0.35 + (1 - pose.flash) * 2.4;
        child.position.set(dir[0] * travel, dir[1] * travel, dir[2] * travel);
      });
    }
    const hp = hpOf(events, maxHp, isPlayer, index, clockRef.current);
    if (hpEl.current && hpEl.current.textContent !== String(hp)) hpEl.current.textContent = String(hp);
    const event = events[clockRef.current.index];
    const critText = pose.crit && event ? `CRIT -${event.damageDealt}` : '';
    if (critEl.current && critEl.current.textContent !== critText) critEl.current.textContent = critText;
    point.current.set(pose.x, pose.y + 0.85, pose.z);
    projectLabel(hpEl.current, point.current, camera, size.width, size.height, pose.hidden < 0.85);
    point.current.set(pose.x, pose.y + 1.35, pose.z);
    projectLabel(critEl.current, point.current, camera, size.width, size.height, pose.crit);
  });

  const color = ENGINE_COLOR[faction] ?? ENGINE_COLOR[0];
  return (
    <>
      <group ref={outer}>
        <group ref={bank}>
          <group ref={mount}>
            <primitive object={main} />
          </group>
          <pointLight ref={engine} color={color} distance={5.5} decay={2} intensity={0.4} position={[0, 0.15, length * 0.42]} />
          <pointLight ref={muzzle} color={color} distance={6} decay={2} intensity={0} position={[0, 0.1, -length * 0.5]} />
          <mesh ref={ring} rotation-x={Math.PI / 2} visible={false}>
            <torusGeometry args={[length * 0.62, Math.max(0.04, length * 0.018), 10, 48]} />
            <meshBasicMaterial color="#f4e4ff" transparent opacity={0} depthWrite={false} />
          </mesh>
          <group ref={shards} visible={false}>
            {SHARD_DIRS.map((dir, shard) => (
              <mesh key={shard} geometry={SHARD} position={dir}>
                <meshBasicMaterial color="#ffd56a" side={THREE.DoubleSide} />
              </mesh>
            ))}
          </group>
        </group>
      </group>
      <group ref={ghostGroup} visible={false}>
        <group ref={ghostMount}>
          <primitive object={ghost} />
        </group>
      </group>
    </>
  );
}

function Beam({
  from,
  to,
  color,
  clockRef
}: {
  from: [number, number, number];
  to: [number, number, number];
  color: string;
  clockRef: ClockRef;
}) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    return geo;
  }, []);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
    [color]
  );
  const a = useRef(new THREE.Vector3());
  const b = useRef(new THREE.Vector3());
  const dir = useRef(new THREE.Vector3());
  const side = useRef(new THREE.Vector3());
  const cam = useRef(new THREE.Vector3());

  useFrame(({ camera }) => {
    const show = beamVisible(clockRef.current, 1);
    material.opacity = show ? 0.95 : 0;
    const attr = geometry.getAttribute('position') as THREE.BufferAttribute;
    a.current.set(from[0], from[1], from[2]);
    b.current.set(to[0], to[1], to[2]);
    dir.current.copy(b.current).sub(a.current);
    const span = dir.current.length() || 1;
    dir.current.multiplyScalar(1 / span);
    cam.current.copy(camera.position).sub(a.current).normalize();
    side.current.crossVectors(dir.current, cam.current).normalize().multiplyScalar(0.24);
    const write = (slot: number, base: THREE.Vector3, sign: number) => {
      attr.setXYZ(slot, base.x + side.current.x * sign, base.y + side.current.y * sign, base.z + side.current.z * sign);
    };
    write(0, a.current, 1);
    write(1, a.current, -1);
    write(2, b.current, -1);
    write(3, b.current, 1);
    attr.needsUpdate = true;
  });

  return <mesh geometry={geometry} material={material} />;
}

function Drone({
  url,
  from,
  to,
  delay,
  clockRef
}: {
  url: string;
  from: [number, number, number];
  to: [number, number, number];
  delay: number;
  clockRef: ClockRef;
}) {
  const gltf = useLoader(GLTFLoader, url);
  const clone = useMemo(() => prepareClone(gltf.scene, false), [gltf]);
  const mount = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const yaw = Math.atan2(-(to[0] - from[0]), -(to[2] - from[2]));

  useLayoutEffect(() => {
    if (spin.current) fitAuthoredHull(clone, spin.current, 0.85);
    return () => disposeMaterials(clone);
  }, [clone]);

  useFrame(() => {
    const travel = droneTravel(clockRef.current, delay);
    if (!mount.current) return;
    mount.current.visible = travel > 0 && travel < 1;
    mount.current.position.set(
      from[0] + (to[0] - from[0]) * Math.max(0, travel),
      0.4 + Math.sin(Math.max(0, travel) * Math.PI) * 0.5,
      from[2] + (to[2] - from[2]) * Math.max(0, travel)
    );
    mount.current.rotation.y = yaw;
  });

  return (
    <group ref={mount}>
      <group ref={spin}>
        <primitive object={clone} />
      </group>
    </group>
  );
}

function ShotLayer({
  clockRef,
  events,
  player,
  ai
}: {
  clockRef: ClockRef;
  events: BattleEvent[];
  player: UnitData[];
  ai: UnitData[];
}) {
  const clock = clockRef.current;
  const event = events[clock.index];
  if (!event || clock.phase !== 'shot') return null;
  const unitClass = attackerClass(event, player, ai);
  const from = slotWorld(event.isPlayerSide, event.attackerIndex);
  const to = slotWorld(!event.isPlayerSide, event.targetIndex);
  const fwd = sideForwardX(event.isPlayerSide);
  const reach = classLength(unitClass);
  const muzzle: [number, number, number] = [from[0] + fwd * reach * 0.48, 0.25, from[2]];
  const aim: [number, number, number] = [to[0] - fwd * reach * 0.15, 0.25, to[2]];
  const faction = unitFaction((event.isPlayerSide ? player : ai)[event.attackerIndex]);
  const color = ENGINE_COLOR[faction] ?? ENGINE_COLOR[0];
  if (unitClass === 1) return <Beam from={muzzle} to={aim} color={color} clockRef={clockRef} />;
  if (unitClass === 3) {
    return (
      <>
        {[0, 1, 2, 3].map((drone) => (
          <Drone key={drone} url={shipUrl(faction, 0)} from={muzzle} to={aim} delay={drone * 0.08} clockRef={clockRef} />
        ))}
      </>
    );
  }
  return null;
}

function Stars() {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 90;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 46;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 90;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);
  const ref = useRef<THREE.Points>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.008;
  });
  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial color="#d5e4ff" size={0.055} sizeAttenuation />
    </points>
  );
}

function Space() {
  const { gl, scene } = useThree();
  useLayoutEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    return () => {
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return (
    <>
      <color attach="background" args={['#07010f']} />
      <ambientLight intensity={0.42} />
      <directionalLight position={[10, 12, 14]} intensity={2.6} color={'#fff6e4'} />
      <directionalLight position={[-12, 5, -8]} intensity={0.85} color={'#8eb6ff'} />
      <hemisphereLight color={'#2a1848'} groundColor={'#1a100c'} intensity={0.55} />
    </>
  );
}

function CameraRig({
  clockRef,
  events,
  player,
  ai
}: {
  clockRef: ClockRef;
  events: BattleEvent[];
  player: UnitData[];
  ai: UnitData[];
}) {
  const want = useRef(new THREE.Vector3(0, 6.9, 12.6));
  const look = useRef(new THREE.Vector3(0, 1.15, -4.8));
  const snapped = useRef(false);
  useFrame(({ camera }, dt) => {
    const pose = cameraPose(clockRef.current, events, player, ai);
    want.current.set(pose.x, pose.y, pose.z);
    look.current.set(pose.lookX, pose.lookY, pose.lookZ);
    const k = snapped.current ? 1 - Math.exp(-3.4 * dt) : 1;
    snapped.current = true;
    camera.position.lerp(want.current, k);
    camera.lookAt(look.current);
  });
  return null;
}

export function ChainField({
  data,
  clockRef,
  beat,
  onBeat,
  onFail
}: {
  data: BattleInitData;
  clockRef: ClockRef;
  beat: number;
  onBeat: (clock: PlayClock) => void;
  onFail: () => void;
}) {
  const events = data.events ?? [];
  const player = data.playerUnitsData ?? [];
  const ai = data.aiUnitsData ?? [];
  const playerHp = data.playerMaxHp ?? [];
  const aiHp = data.aiMaxHp ?? [];

  useLayoutEffect(() => {
    const urls = new Set<string>();
    for (const unit of [...player, ...ai]) {
      urls.add(shipUrl(unitFaction(unit), Number(unit.unitClass ?? 0)));
    }
    for (const url of urls) useLoader.preload(GLTFLoader, url);
  }, [ai, player]);

  useFrame((_, dt) => {
    const prev = `${clockRef.current.phase}:${clockRef.current.index}`;
    clockRef.current = advance(clockRef.current, dt, events, (event) => attackerClass(event, player, ai));
    const next = `${clockRef.current.phase}:${clockRef.current.index}`;
    if (prev !== next) onBeat(clockRef.current);
  });

  return (
    <>
      <Space />
      <Stars />
      <CameraRig clockRef={clockRef} events={events} player={player} ai={ai} />
      {player.map((unit, index) => (
        <ModelBoundary key={`p${index}`} onFail={onFail}>
          <Suspense fallback={null}>
            <Ship isPlayer index={index} unit={unit} maxHp={playerHp} events={events} player={player} ai={ai} clockRef={clockRef} />
          </Suspense>
        </ModelBoundary>
      ))}
      {ai.map((unit, index) => (
        <ModelBoundary key={`a${index}`} onFail={onFail}>
          <Suspense fallback={null}>
            <Ship isPlayer={false} index={index} unit={unit} maxHp={aiHp} events={events} player={player} ai={ai} clockRef={clockRef} />
          </Suspense>
        </ModelBoundary>
      ))}
      <ModelBoundary onFail={onFail}>
        <Suspense fallback={null}>
          <ShotLayer key={beat} clockRef={clockRef} events={events} player={player} ai={ai} />
        </Suspense>
      </ModelBoundary>
    </>
  );
}

