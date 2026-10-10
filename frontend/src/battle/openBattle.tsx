import { createRoot, type Root } from 'react-dom/client';
import type { BattleInitData } from '../utils/battleTypes';
import { BattleView } from './BattleView';

type GameLike = {
  loop: { sleep: () => void; wake: () => void };
};

let active: Root | null = null;

export function openChainBattle(data: BattleInitData): void {
  if (active) return;
  const game = (window as Window & { game?: GameLike }).game;
  const host = document.getElementById('game');
  const legacy = document.getElementById('battle3d');
  if (host) host.style.visibility = 'hidden';
  if (legacy) legacy.style.display = 'none';
  game?.loop.sleep();

  const mount = document.createElement('div');
  mount.id = 'chain-battle';
  mount.style.cssText = 'position:fixed;inset:0;z-index:100000;';
  document.body.appendChild(mount);
  const root = createRoot(mount);
  active = root;

  const restore = () => {
    if (active !== root) return;
    root.unmount();
    mount.remove();
    active = null;
    if (host) host.style.visibility = '';
    game?.loop.wake();
  };

  root.render(<BattleView data={data} onClose={restore} />);
}
