# Feed 1 — client v2. Feed this file alone.

Do not open feeds 2 or 3. Do not edit contracts. Acceptance is visual and replay only.

# GROK BUILD 4.7 — StarForge client v2

Build a new player client for StarForge. Do not upgrade the current game. Leave it untouched as legacy and ship the new client on its own branch.

## Branch and layout

- Create branch `client-v2` from the current default branch.
- Do not edit, move, reformat, or delete `frontend/`. That folder is the legacy Phaser 3.90.0 client and stays as-is.
- Do not edit `contracts/`, deploy scripts, `DEPLOYMENT.md`, or ABI sources. Blockchain is frozen.
- New app lives only in `frontend-v2/`.
- Legacy stays runnable with `cd frontend && npm run dev`. New client runs with `cd frontend-v2 && npm run dev`.

## Engine

Drop Phaser in the new client. Do not import it.

- App shell, navigation, shop, collection, profile, result: React 19 + Vite + TypeScript.
- Wallet: wagmi + viem + RainbowKit. Copy chain config from the legacy client. Do not invent a chain.
- Battle, ship previews in the shop, and the collection hero view: one React Three Fiber canvas (`@react-three/fiber`, `@react-three/drei`, `postprocessing`).
- No second game engine. No Unity, Godot, Babylon, or Pixi.
- One WebGL canvas. UI is HTML/CSS over it, not a second renderer.

Chain constants, copy exactly:

- chain id `50312`
- rpc `https://dream-rpc.somnia.network`
- game `0x064fE7661b1eb52b727e562E652764b94c008383`
- unit nft `0x9c8784d47dA7fc4772EE617dC3A49c506A6481A1`
- relic `0x619e19df1975A8D289545834aAff3FEEf1b84909`
- profile `0x2C8976ECc9e9bDf939745ee61b1aD858607563d9`

Copy `gameAbi`, `nftAbi`, `relicAbi`, `profileAbi` from `frontend/src/lib/abis.ts` verbatim into `frontend-v2/src/chain/abis.ts`. Do not add, rename, or reorder functions.

## Chain adapter — do not redesign

All reads and writes go through `frontend-v2/src/chain/gameApi.ts`. Components never call `writeContract` directly.

Allowed writes, same names and args as legacy:

- `buyUnit()` payable, value = `buyUnitPrice()`
- `buyFromShop(slot)` payable, value = current shop price used by legacy (`buyRelicShopPrice` only if that slot is a relic; otherwise the unit buy price the legacy client sends)
- `rerollShop()` payable, value = `rerollPrice()`
- `generateTenShips()` payable, value = `buyUnitPrice() * 10`
- `claimLevelUpShips()`
- `equipRelics(uint256[3])`
- `startMatch(uint256[] team, uint256[] equipped)` nonpayable. If estimated gas is below 12_000_000, send 12_000_000. Team is the 8 selected token ids, compacted the same way as legacy. Empty slot is not a token id.

Allowed reads:

- `getPlayerUnits`, `getPlayerRelics`, `getPlayerShop`, `getCurrentAI`, `getEquippedRelics`, `getRemainingBuys`, `canReroll`, `pendingLevelUpShips`, `getLastBattleSummary`
- nft `getUnit(tokenId)`
- relic `getRelic(id)`
- profile `getProfile(player)`

After `startMatch`, parse the receipt the same way as legacy:

- `BattleResolved` gives `battleId`, `playerWon`, `playerMaxHp`, `aiMaxHp`
- `BattleEventEmitted` logs in that block, filtered by `battleId`, become the event list
- special effect byte: `1` CRIT, `2` DODGE, `3` Last Stand, else none
- map log field `damage` to `damageDealt`

Replay input type stays:

```ts
type BattleEvent = {
  round: number;
  isPlayerSide: boolean;
  attackerIndex: number;
  targetIndex: number;
  damageDealt: number;
  remainingHp: number;
  specialEffect?: 'CRIT' | 'DODGE' | 'Last Stand';
  attackerRarity?: number;
  attackerClass?: number;
  targetRarity?: number;
  targetClass?: number;
};

type BattlePayload = {
  events: BattleEvent[];
  playerWon: boolean;
  playerMaxHp: number[];
  aiMaxHp: number[];
  playerUnitsData: { faction: number; unitClass: number; rarity: number }[];
  aiUnitsData: { faction: number; unitClass: number; rarity: number }[];
  savedTeam: number[];
};
```

Catalog ids are frozen. Do not renumber.

- Faction 0 Empire, 1 Voidborn, 2 Mechanoids
- Class 0 Fighter, 1 Cruiser, 2 Dreadnought, 3 Drone Swarm
- Up to 8 units a side. Do not draw empty slots.

`damageDealt` and `remainingHp` are truth. The client does not resimulate combat.

## Art direction — Echo of Dreams

Surreal cosmic auto-battler, not military sci-fi, not Star Wars, not grey capital ships. Liquid starlight, iridescent hulls, dream-fracture geometry, soft bloom, hard specular rims. Palette: void indigo `#07010f`, dream magenta `#ff4fd8`, echo cyan `#5ee7ff`, forge gold `#ffe566`, bone white. Alive background: layered nebula, parallax dust, a fractured moon. No static JPG skybox. No legacy PNG as a hull.

Generate new textures under `frontend-v2/public/assets/v2/`. If a texture fails, use a procedural material. Never import `frontend/public/assets`.

Faction read at battle distance:

- Empire: cathedral-lance, gold filigree, cold blue engines, long nose, symmetric.
- Voidborn: negative-space hull, violet cut-out edges, asymmetric thorns.
- Mechanoids: no cockpit, amber hex lattice, exposed forge ribs.

Class read without a label:

- Fighter: small dart, one nose gun, fast engine streak. Shot: bolt.
- Cruiser: mid hull, spinal emitter, two nacelles. Shot: held beam.
- Dreadnought: huge, slow, spinal cannon. Shot: heavy slug.
- Drone Swarm: no capital hull. 5–6 small drones around an echo core. Shot: staggered needles.

Rarity is light: Common dim rim, Rare cyan edge, Legendary gold dream-ring. There is no Epic rarity.

## Battle stage

`frontend-v2/src/battle/` is the only battle code.

Ships are real meshes in a factory: lathe, extrude, instanced struts, glass, emissive maps. No `PlaneGeometry` hull. No portrait card. Each ship has a muzzle aimed at the enemy, engine flares, a shield mesh at opacity 0, and a wreck state that fractures geometry instead of swapping a grey texture. Player faces +X. Enemy faces −X. Rotate the mesh, do not mirror a texture.

Camera: opening dolly, bias toward attacker and target on each shot, punch-in and nebula ripple on kill, crane over survivors on victory. HUD never covers the lines.

Formation: two arcs, player left, void right, slot 0 toward center, larger classes deeper in Z. Idle hover, engine pulse, drone orbit. Telegraph before the shot.

Hits: flash, knockback, projected HP. Crit: gold fracture and a larger number. Dodge: dash plus afterimage, text DODGE, no HP change. Last Stand: relic pulse, hull stays at reported HP. Kill: emissive shards, shockwave, debris, HP bar removed.

Playback: 1x, 2x, skip. Skip compresses beats and still opens the result. Result: VICTORY or DEFEAT, return to the forge with the same team.

Route `/battle?preview=1` plays a canned 8v8 payload with all 3 factions, all 4 classes, one crit, one dodge, one last stand, and at least one kill. No wallet required.

## 3D animation

Every motion is a tween on the existing event. Do not add extra attacks. Time scale of 1x / 2x / skip multiplies all battle tweens, particles, and audio playback rate. Skip never drops the result card.

Idle, always on while alive:

- Hull bob ±0.06 and roll ±0.03, period 2.4–3.6s, desynced per slot.
- Engine emissive pulse locked to the faction color. Intensity rises when that ship is the attacker.
- Drone Swarm: each drone on its own orbit around the echo core, speed 0.6–1.1 rad/s, home offset restored after a volley.
- Rare+ ships get a slow rim sweep. Legendary gets a thin rotating dream-ring.

Attack beat, in order:

1. Telegraph 80–140ms: muzzle charges, attacker banks 6–10 degrees toward the target, engines flare.
2. Delivery: Fighter lunges 0.35 and returns. Cruiser holds station, spinal emitter opens. Dreadnought recoils 0.12 on fire. Swarm drones dart 0.2 toward the target, stagger 40ms, then fall back to orbit.
3. Recover 160ms: hull settles, bank clears, engines drop to idle.

Camera rig in `frontend-v2/src/battle/camera.ts`:

- Intro 1.6s: high rear dolly down to a 3/4 view of both arcs.
- Per shot: damp toward the midpoint of attacker and target, fov 42 → 38, then ease back. Do not cut.
- Kill: 180ms punch-in, 4° roll, nebula shock, then recover.
- Victory or defeat: 2.2s crane over the winning line. Losing wrecks stay in frame.
- Phone: same rig, tighter fov, HUD in the top and bottom safe zones.

Forge and collection meshes are not static. Shop card hover eases the ship to yaw 0.4 and scale 1.06. Selected fleet slot gets a slow yaw loop. Relic socket pulses once on equip. Altar camera drifts 2° over 20s.

## Effects

One post stack on the battle canvas: bloom (threshold 0.85, strength 0.45), subtle vignette, film grain 0.04. Chromatic aberration only on crit and kill, 120ms, then off. No permanent glitch.

Shots, mesh or additive sprites, never a flat UI png:

- Bolt: stretched emissive streak, faction core, white tip, 150ms travel, spark burst on impact.
- Beam: charge orb, then a held cylinder with a hard core and a soft halo for 180ms, impact ring at the target muzzle line.
- Slug: short thick projectile, muzzle bloom, travel 210ms, impact kicks the target 0.18 on the shot axis.
- Needles: 5 streaks from drone muzzles, 8° spread, stagger 26ms, small sparks.

Hit layer:

- Normal: emissive flash 70ms, 3–5 sparks, HP bar ticks.
- Crit: gold fracture lines on the hull for 220ms, larger spark count, floating `CRIT -n`.
- Dodge: lateral dash 0.28, two afterimage shells at falling opacity, text `DODGE`, no HP change, no impact sparks.
- Last Stand: shield mesh opacity 0 → 0.55 → 0.15, relic-colored pulse, hull stays at reported HP.
- Kill: break 6–10 hull shards with emissive edges, shockwave ring, debris drift 1.2s, engines off, HP bar removed. Wreck stays on the field, dim, no longer idle-animates.

Background is a scene, not a plate: two nebula shells, dust points, a fractured moon on a slow spin, a light shock ripple on kill. Cap particles at 400 alive. Pool and reuse them.

## Sound

New audio bus in `frontend-v2/src/audio/sound.ts`. Web Audio only. Do not use Phaser. Unlock on the first pointer. Mute persists in `localStorage` key `starforge-audio-mute`. A mute control sits on forge and battle.

Copy these one-shots from `frontend/public/assets/sfx/` into `frontend-v2/public/audio/` and play them. Do not resynthesize over them:

- `click.ogg` UI press
- `confirm.ogg` buy, equip, claim
- `error.ogg` revert
- `select.ogg` start match
- `laser_0.ogg` `laser_1.ogg` `laser_2.ogg` bolt and needle, rotate
- `laser_big.ogg` crit and beam fire
- `explode_0.ogg` `explode_1.ogg` kill, rotate
- `shield.ogg` Last Stand
- `victory.ogg` victory

Synthesize the missing bed in Web Audio, short buffers, no external service:

- Ambient dream drone under forge and battle: low pad, two detuned sines, slow filter LFO, −24 dB under SFX. Stop on mute.
- Engine loop per alive capital ship, gain by distance to camera, silent when culled. Swarm gets one shared buzz, not six loops.
- Dodge whoosh, 180ms filtered noise. Legacy has no dodge file.
- Dreadnought muzzle thud, 90ms, layered under `laser_big` on slug fire.
- Defeat sting: pitched-down `explode_1`, not the victory file.

Mix: UI −14 dB, weapons −8 dB, explode −6 dB, ambient −24 dB. Minimum gap 80ms between the same weapon voice so a swarm volley does not stack into a clip. 2x playback uses `playbackRate` 1.4, not a second trigger. Skip ducks ambient and plays only kill and result stings.

## Screens

- `/` connect. Full-bleed dream vista, StarForge wordmark, one connect control. RainbowKit.
- `/forge` the altar. Owned hulls as live mesh thumbnails. Shop row of 3. Relic sockets, max 3. Gold is the wallet native balance. Level, xp, wins, losses, AI tier from `getProfile`. Buys remaining, reroll state, level-up claim. Buttons: Reroll, Buy ship, Generate 10, Claim level-up, Equip relics, Start battle. Start stays disabled until 8 real token ids are selected. Errors show the chain revert, not a generic toast only.
- `/collection` gallery of owned ships and relics, same reads, rarity rim, mesh preview.
- `/battle` the replay.

Shared visual system: Rajdhani, gold labels, cyan values, glass panels in CSS. Desktop 1920×1080 and a 390×844 phone layout. HUD must not cover ships.

## Done when

- Branch `client-v2` exists. `frontend/` diff is empty.
- No file under `frontend-v2/` imports Phaser or legacy assets.
- Preview battle shows real meshes, four weapons, crit, dodge, last stand, kill, camera punches, and the matching stings. Ambient is audible until mute.
- A connected wallet can buy, reroll, equip, and `startMatch` against the frozen contracts, then watch that receipt's events.
- `npm run build` succeeds in `frontend-v2/`.

Do not propose a lighter version. Build the full client.
