# StarForge — Project Rules (AGENTS.md)

## Role
Expert blockchain game developer. User is the project manager and does not write code. Work only as this pair.

## Language
Code comments: English. Talk to the user in Russian, direct, no fluff.

## Stack
- Solidity 0.8.27+, Hardhat. Deploy with `npx hardhat run scripts/deploy.js --network somniaTestnet`.
- Testnet chain id 50312. Mainnet chain id 5031.
- Official RPC: `https://api.infra.testnet.somnia.network/` and `https://api.infra.mainnet.somnia.network/`. Legacy client still uses `https://dream-rpc.somnia.network`.
- Legacy frontend: `frontend/`, Phaser 3.90.0 + Three.js. Do not extend the battle.
- New frontend: `frontend-v2/`, React + React Three Fiber. No Phaser.
- Game: Ownable + ReentrancyGuard + Pausable. Profile: AccessControl. Ships ERC-721 soulbound. Relics ERC-1155 soulbound. No UUPS.

## Rules
- Battle resolution stays in `startMatch`. Do not simulate the fight in the client.
- Do not add combat effects, pilots, an internal coin, raids, or VRF in battle.
- Addresses only from `DEPLOYMENT.md`.
- Current design is `StarForge_GDD_v1.7.md`. Build order is `BUILD_SEQUENCE.md`. Feed one file from `docs/build/`.
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

## Current state (2026-10-03)
- Live testnet Game is still the v1.6 contract. See `DEPLOYMENT.md`.
- Next work is client v2, then Foundry, then Echo metadata, then optional gas pack.
- Legacy battle visual is not accepted and is not the task.
