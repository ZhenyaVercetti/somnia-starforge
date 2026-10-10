import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import type { BattleInitData } from '../utils/battleTypes';
import { gameAudio } from '../lib/gameAudio';
import { ChainField } from './ChainField';
import type { PlayClock } from './playback';

const bar: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 2,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  height: 44,
  padding: '0 16px',
  color: '#f3ecff',
  background: 'linear-gradient(#07010fe6, #07010f00)',
  fontSize: 18,
  letterSpacing: '0.08em'
};

const button: CSSProperties = {
  marginLeft: 8,
  padding: '2px 10px',
  color: '#f3ecff',
  background: 'transparent',
  border: '1px solid #d7c4ff55',
  borderRadius: 4,
  font: 'inherit',
  letterSpacing: '0.08em',
  cursor: 'pointer'
};

export function BattleView({ data, onClose }: { data: BattleInitData; onClose: () => void }) {
  const events = data.events ?? [];
  const won = data.playerWon === true;
  const clockRef = useRef<PlayClock>({
    phase: events.length > 0 ? 'intro' : 'done',
    index: 0,
    t: 0,
    speed: 1
  });
  const ended = useRef(false);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [muted, setMuted] = useState(gameAudio.isMuted());
  const [round, setRound] = useState(Number(events[0]?.round ?? 0));
  const [done, setDone] = useState(events.length === 0);
  const [beat, setBeat] = useState(0);
  const [missing, setMissing] = useState(false);

  function finish() {
    if (ended.current) return;
    ended.current = true;
    clockRef.current = { phase: 'done', index: events.length, t: 0, speed: clockRef.current.speed };
    setDone(true);
    if (won) gameAudio.victory();
    else gameAudio.defeat();
  }

  useEffect(() => {
    if (events.length === 0) finish();
  }, [events.length, won]);

  function onBeat(clock: PlayClock) {
    const event = events[clock.index];
    if (event && clock.phase !== 'done') setRound(Number(event.round) || 0);
    if (clock.phase === 'hit' && event) {
      if (event.specialEffect === 'DODGE') gameAudio.dodge();
      else gameAudio.hit(event.specialEffect === 'CRIT');
      if (event.specialEffect === 'Last Stand') gameAudio.lastStand();
      if (Number(event.remainingHp) <= 0 && event.specialEffect !== 'DODGE') gameAudio.explode();
    }
    if (clock.phase === 'done') finish();
    setBeat((value) => value + 1);
  }

  function setPlayback(next: 1 | 2) {
    clockRef.current = { ...clockRef.current, speed: next };
    setSpeed(next);
  }

  const active: CSSProperties = { ...button, borderColor: '#f4e4ff', color: '#fff' };

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#07010f', overflow: 'hidden' }}>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ fov: 38, position: [0, 6.9, 12.6], near: 0.1, far: 240 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <ChainField data={data} clockRef={clockRef} beat={beat} onBeat={onBeat} onFail={() => setMissing(true)} />
      </Canvas>
      <div id="chain-labels" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }} />
      <header style={bar}>
        <span>Round {round}</span>
        <span>
          <button type="button" style={speed === 1 ? active : button} onClick={() => setPlayback(1)}>1x</button>
          <button type="button" style={speed === 2 ? active : button} onClick={() => setPlayback(2)}>2x</button>
          <button type="button" style={button} onClick={finish}>Skip</button>
          <button type="button" style={button} onClick={() => setMuted(gameAudio.toggleMute())}>{muted ? 'Muted' : 'Mute'}</button>
        </span>
      </header>
      {missing && (
        <div style={{ position: 'absolute', top: 48, left: 16, zIndex: 2, color: '#ffb4b4', fontSize: 14 }}>
          Ship model failed to load.
        </div>
      )}
      {done && (
        <button type="button" onClick={onClose} style={cardStyle}>
          <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 42, letterSpacing: '0.14em' }}>{won ? 'VICTORY' : 'DEFEAT'}</div>
          <div style={{ fontSize: 20, letterSpacing: '0.06em' }}>Return to the fleet</div>
        </button>
      )}
    </div>
  );
}

const cardStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  margin: 'auto',
  zIndex: 3,
  width: 440,
  height: 190,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 14,
  color: '#f6f0ff',
  background: '#12081fd6',
  border: '1px solid #d7c4ff66',
  cursor: 'pointer',
  fontFamily: 'Rajdhani, sans-serif'
};
