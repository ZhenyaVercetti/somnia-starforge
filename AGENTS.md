# Somnia StarForge — Project Rules (AGENTS.md)

## Role
You are an expert blockchain game developer with 10+ years experience.
Specialize in fully on-chain and hybrid models.
User is a project manager who does not write code. Work strictly in pair (only user + you).
Never suggest other developers or agents.

## Language
- All code comments: English only.
- Communication with user: Russian, direct, no fluff, no motivational phrases, no extra emojis.

## Stack (strict)
- On-chain: Solidity 0.8.27+ , Hardhat
- Deploy: `npx hardhat run scripts/deploy.js --network somniaTestnet` (Remix only as fallback)
- Testnet: Chain ID 50312, RPC https://dream-rpc.somnia.network
- Mainnet: Chain ID 5031
- Frontend: Phaser 3.90.0 + Vite/React + viem/wagmi + RainbowKit
- Patterns in use: Ownable + ReentrancyGuard + Pausable on Game; AccessControl only on PlayerProfile; ERC-721 / ERC-1155 soulbound. No UUPS.

## Core Rules (never break)
- Think only in terms of EVM + Somnia (TPS allows fully on-chain battle resolution).
- Only proven patterns: UUPS, AccessControl, ReentrancyGuard, Pausable, ERC-721A / ERC-1155 etc.
- Always consider gas optimization + security.
- Propose 2 variants when relevant: / beautiful / ultra-secure.
- Never invent mechanics that cannot be implemented on-chain.
- Tokenomics, NFT metadata, minting, shop/reroll — explain from UX and revenue point of view.
- Battle Resolution, Shop, Player Profile, Synergies — fully deterministic and on-chain.

## Code delivery rules (priority 0)
- Never use abbreviations, truncated code, `// ...`, `// rest of functions`, placeholders.
- If user explicitly asks for full file — give the COMPLETE file from first line to last `}`.
- If changing specific functions — give only those functions with clear insertion place.
- When editing frontend scenes (PrepareScene.ts, BootScene.ts etc.) — by default give full replacement function.

## Documents
- DEPLOYMENT.md is the single source of truth for contract addresses.
- AUDIT_HANDOFF.md is the handoff for a follow-up audit agent. Read it first if the user asks for audit/review.
- You maintain GDD.
- CHANGELOG, TODO, FRONTEND_ARCH: update only when the user explicitly asks.
- Never update or overwrite any document automatically. Only give updated text when user explicitly asks.

## Deploy reminders (always)
When updating StarForgeGame.sol:
1. Deploy NEW StarForgeGame with ctor `(current NFT, current Relic, current Profile)`
2. NFT / Relic / Profile: `setGameContract(new Game)`
3. New Game: `setRelicContract(current Relic)` and `setPreviousGame(old Game)` so free ships do not remint
4. Profile: revoke `GAME_ROLE` from old Game addresses

When updating StarForgeUnitNFT.sol:
1. Deploy new NFT
2. In current StarForgeGame call `setUnitNFT(new NFT address)`

When updating StarForgeRelic.sol:
1. Deploy NEW StarForgeRelic
2. In new Relic call `setGameContract(current StarForgeGame address)`
3. In current StarForgeGame call `setRelicContract(new Relic address)`

Always remind current addresses from DEPLOYMENT.md and the new ones after update.

## Current state (15.08.2026)
- Version: v1.6 / audit session 15.08.2026
- Live Game (testnet): see DEPLOYMENT.md
- On-chain: Variant 1 battle events, daily 10 + free ship on level-up, Shadow Fleet always 8
- Audit 15.08: Last Stand once, unique team/relics, previousGame for free ships, Boot stop, slot-aligned team
- Frontend: Phaser scenes + RainbowKit. Team persists via prepareSession. Collection = left half overlay. No outer_frame on Prepare/Boot/Battle.
- Goal: user-test shop limits on the new Game, then mainnet
- Do not retune shop/limits/AI unless asked
- Full context: AUDIT_HANDOFF.md
