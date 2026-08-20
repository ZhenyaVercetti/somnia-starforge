# Somnia StarForge

On-chain auto-battler on Somnia. Version **v1.6.5** (live Game 17.08.2026) + 3D battle layer (20.08, visual not accepted).

## Live testnet

Chain ID **50312** · RPC `https://dream-rpc.somnia.network`

Addresses: **`DEPLOYMENT.md`** (single source of truth). Frontend mirror: `frontend/src/lib/contractAddresses.ts`.

## Scenes

Boot → Prepare (hub) → Battle. Collection launches as a left-half overlay on Prepare. Wallet: RainbowKit.

Battle field is Three.js (`#battle3d`); Phaser draws HUD only. Preview without a wallet: `?previewBattle=1`.

## Run

```
cd frontend
npm run dev
```

Contracts:

```
npx hardhat test
npx hardhat run scripts/deploy.js --network somniaTestnet
```

## Documents

| File | Role |
|---|---|
| `DEPLOYMENT.md` | Contract addresses |
| `AUDIT_HANDOFF.md` | Audit / session snapshot |
| `AGENTS.md` | Agent rules + deploy ritual |
| `FRONTEND_ARCH.md` | Frontend layout |
| `Somnia_StarForge_GDD_v1.6.md` | Design |
| `TODO.md` | Open work |
| `CHANGELOG.md` | History |
