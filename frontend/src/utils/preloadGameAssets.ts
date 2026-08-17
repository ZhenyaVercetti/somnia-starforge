import type Phaser from 'phaser';

const FACTIONS = ['emperial', 'voidborn', 'mechanoid'] as const;
const CLASSES = ['fighter', 'cruiser', 'dreadnought', 'droneswarm'] as const;

export function preloadShipPortraits(scene: Phaser.Scene): void {
  for (const faction of FACTIONS) {
    for (const unitClass of CLASSES) {
      scene.load.image(
        `${faction}_${unitClass}`,
        `assets/units/portraits/${faction}_${unitClass}.png`
      );
    }
  }
}

export function preloadDestroyedShips(scene: Phaser.Scene): void {
  for (const faction of FACTIONS) {
    for (const unitClass of CLASSES) {
      scene.load.image(
        `${faction}_${unitClass}_destroyed`,
        `assets/units/destroyed/${faction}_${unitClass}_destroyed.png`
      );
    }
  }
}

export function preloadRelicsAndFrames(scene: Phaser.Scene): void {
  scene.load.image('quantum_strike', 'assets/relics/quantum_strike.png');
  scene.load.image('void_shield', 'assets/relics/void_shield.png');
  scene.load.image('nebula_dash', 'assets/relics/nebula_dash.png');
  scene.load.image('echo_core', 'assets/relics/echo_core.png');
  scene.load.image('flux_overload', 'assets/relics/flux_overload.png');
  scene.load.image('last_stand', 'assets/relics/last_stand.png');
  scene.load.image('legendary_frame', 'assets/frames/legendary.png');
  scene.load.image('rare_frame', 'assets/frames/rare.png');
  scene.load.image('common_frame', 'assets/frames/common.png');
}
