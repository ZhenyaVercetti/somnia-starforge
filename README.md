# Somnia StarForge

On-chain auto-battler on Somnia. Version **v1.6** (audit 15.08.2026).

## Live testnet

Chain ID **50312** · RPC `https://dream-rpc.somnia.network`

Addresses: **`DEPLOYMENT.md`** (single source of truth). Frontend mirror: `frontend/src/lib/contractAddresses.ts`.

## Scenes

Boot → Prepare (hub) → Battle. Collection launches as a left-half overlay on Prepare. Wallet: RainbowKit.

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
