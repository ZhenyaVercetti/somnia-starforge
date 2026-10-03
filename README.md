# StarForge

On-chain auto-battler. Current design is **GDD v1.7** (2026-10-03). Live contracts are still the v1.6 testnet set.

Forge is the core. Battle proves the hull and stays inside `startMatch`. Mainnet is not the next step.

## Live testnet

Chain ID **50312**. Addresses: **`DEPLOYMENT.md`** only. Frontend mirror: `frontend/src/lib/contractAddresses.ts`.

Official network RPC is `https://api.infra.testnet.somnia.network/`. The legacy client still calls `https://dream-rpc.somnia.network` until client v2.

## Clients

Legacy Phaser 3.90 + Three.js stays in `frontend/`. Visual battle was not accepted. Do not extend it.

```
cd frontend
npm run dev
```

New client is not in `main` yet. Spec: `docs/build/01_CLIENT_V2.md`, branch `client-v2`, folder `frontend-v2/`.

## Documents

| File | Role |
|---|---|
| `DEPLOYMENT.md` | Contract addresses |
| `StarForge_GDD_v1.7.md` | Current design |
| `BUILD_SEQUENCE.md` | What to build, in order |
| `docs/build/` | Feed files for Build |
| `AGENTS.md` | Agent rules |
| `TODO.md` | Open work |
| `FRONTEND_ARCH.md` | Legacy client plus v2 plan |
| `Somnia_StarForge_GDD_v1.6.md` | Retired |
| `changelog.md` | History through 20.08.2026 |
