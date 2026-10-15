# StarForge — Project Rules (AGENTS.md)

## Role
Expert blockchain game developer. User is the project manager and does not write code. Work only as this pair.

## Language
Code comments: English. Talk to the user in Russian, direct, no fluff. New and rewritten project docs: Russian. This file stays English.

## Stack
- Solidity 0.8.27+, Hardhat. Deploy with `npx hardhat run scripts/deploy.js --network somniaTestnet`.
- Testnet chain id 50312. Mainnet chain id 5031.
- Client testnet RPC: `https://api.infra.testnet.somnia.network/`. Chain id stays 50312. Hardhat `somniaTestnet` still defaults to `https://dream-rpc.somnia.network` unless `SOMNIA_TESTNET_RPC` is set. Do not fill the Hardhat mainnet RPC. That is a phase 5 task in `ROADMAP.md`. The placeholder stays `REPLACE_WITH_SOMNIA_MAINNET_RPC`.
- One client: `frontend/`. Phaser 3.90.0 for Boot, Prepare, Collection, and the wallet shell. Battle is React + React Three Fiber in `frontend/src/battle/`. There is no `frontend-v2` and no `client-v2` branch. Do not create them.
- Game: Ownable + ReentrancyGuard + Pausable. Profile: AccessControl. Ships ERC-721 soulbound. Relics ERC-1155 soulbound. No UUPS.

## Rules
- Battle resolution stays in `startMatch`. Do not simulate the fight in the client.
- One battle path. `startMatch` and `?previewBattle=1` both open `frontend/src/battle/`. Do not bring back a Phaser battle scene.
- Do not add combat effects, pilots, an internal coin, raids, or VRF in battle.
- If image-to-3D is unavailable, stop. Do not substitute procedural hulls, Three.js primitives, or portrait billboards. Do not restore a hull generator. Do not delete the twelve GLBs or the twelve portraits until real replacements exist.
- Addresses only from `DEPLOYMENT.md`.
- Current design is `docs/GDD.md`. Order is `ROADMAP.md`. Current sprint is `TODO.md`. Do not feed files from `docs/archive/` as a task.
- Do not pass Foundry to `setGameContract`.
- Game bytecode is near 24 KB. New battle logic stays small or moves to the library.
- Do not redeploy NFT or Profile without a migration plan.

## Deploy
New Game:
1. Deploy with current NFT, Relic, Profile, and current Game as `previousGame`.
2. Bind Relic, Profile, then NFT `setGameContract` to the new Game. Revoke `GAME_ROLE` on old Games.
3. Write the new address in `DEPLOYMENT.md`.

New NFT: deploy, then `setUnitNFT` on the current Game.
New Relic: deploy, `setGameContract` to the current Game, then `setRelicContract` on the Game.

## Current state (2026-10-15)
- Live testnet Game is still the v1.6 contract. See `DEPLOYMENT.md`.
- The R3F battle from `0649cb7` is on main inside `frontend/`. The visual and the twelve GLBs are not accepted.
- Blocker for hulls: `grok-imagine-3d` HTTP 400 on team `e6b727ae-7a90-4c3f-bf60-9ab135a157be`, ticket T-G99754. See `STATUS.md`.
- Next accepted work is battle acceptance on a live `startMatch` with image-to-3D hulls, then Foundry, then Echo metadata, then optional gas pack, then mainnet.
