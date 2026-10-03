# StarForge

On-chain auto-battler. Current design is [GDD v1.7](StarForge_GDD_v1.7.md) (2026-10-03). Live contracts are still the v1.6 testnet set.

Forge is the core. Battle proves the hull and stays inside `startMatch`. Mainnet is not the next step.

## Live testnet

Chain ID **50312**. Addresses only in [DEPLOYMENT.md](DEPLOYMENT.md). Frontend mirror: [frontend/src/lib/contractAddresses.ts](frontend/src/lib/contractAddresses.ts).

Official network RPC: [https://api.infra.testnet.somnia.network/](https://api.infra.testnet.somnia.network/). Explorer: [shannon-explorer.somnia.network](https://shannon-explorer.somnia.network/). The legacy client still calls [https://dream-rpc.somnia.network](https://dream-rpc.somnia.network) until client v2.

Mainnet is live as a network (chain id 5031, [explorer.somnia.network](https://explorer.somnia.network/)) and is not a StarForge deploy target yet. Checklist: [MAINNET_LAUNCH_CHECKLIST.md](MAINNET_LAUNCH_CHECKLIST.md).

## Clients

Legacy Phaser 3.90 + Three.js stays in [frontend/](frontend/). Visual battle was not accepted. Do not extend it. Layout: [FRONTEND_ARCH.md](FRONTEND_ARCH.md).

```
cd frontend
npm run dev
```

New client is not in `main` yet. Branch `client-v2`, folder `frontend-v2/`. Spec: [docs/build/01_CLIENT_V2.md](docs/build/01_CLIENT_V2.md).

## Build order

Feed one file at a time. Index: [BUILD_SEQUENCE.md](BUILD_SEQUENCE.md).

1. [Client v2](docs/build/01_CLIENT_V2.md)
2. [Foundry](docs/build/02_FORGE.md)
3. [NFT and Echo](docs/build/03_NFT.md)
4. [Battle gas, optional](docs/build/04_GAS.md)

## Documents

| File | Role |
|---|---|
| [DEPLOYMENT.md](DEPLOYMENT.md) | Contract addresses |
| [StarForge_GDD_v1.7.md](StarForge_GDD_v1.7.md) | Current design |
| [BUILD_SEQUENCE.md](BUILD_SEQUENCE.md) | What to build, in order |
| [docs/build/README.md](docs/build/README.md) | Feed files for Build |
| [AGENTS.md](AGENTS.md) | Agent rules |
| [TODO.md](TODO.md) | Open work |
| [FRONTEND_ARCH.md](FRONTEND_ARCH.md) | Legacy client plus v2 plan |
| [AUDIT_HANDOFF.md](AUDIT_HANDOFF.md) | August snapshot, not the current task |
| [Somnia_StarForge_GDD_v1.6.md](Somnia_StarForge_GDD_v1.6.md) | Retired |
| [changelog.md](changelog.md) | History through 20.08.2026 |
