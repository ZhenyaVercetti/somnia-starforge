export function getBattleCanvas(): HTMLCanvasElement {
  let host = document.getElementById('battle3d') as HTMLCanvasElement | null;
  if (!host) {
    host = document.createElement('canvas');
    host.id = 'battle3d';
    const game = document.getElementById('game');
    if (game?.parentElement) {
      game.parentElement.insertBefore(host, game);
    } else {
      document.body.appendChild(host);
    }
  }
  host.style.position = 'fixed';
  host.style.pointerEvents = 'none';
  host.style.zIndex = '0';
  host.style.isolation = 'isolate';
  host.style.display = 'none';
  return host;
}

export function syncBattleCanvas(host: HTMLCanvasElement, gameCanvas: HTMLCanvasElement): {
  width: number;
  height: number;
} {
  const rect = gameCanvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  host.style.display = 'block';
  host.style.left = `${rect.left}px`;
  host.style.top = `${rect.top}px`;
  host.style.width = `${width}px`;
  host.style.height = `${height}px`;
  gameCanvas.style.background = 'transparent';
  const parent = gameCanvas.parentElement as HTMLElement | null;
  if (parent) {
    parent.style.background = 'transparent';
  }
  return { width, height };
}

export function hideBattleCanvas(host: HTMLCanvasElement): void {
  host.style.display = 'none';
}
