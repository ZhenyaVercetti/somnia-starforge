# DEPLOYMENT.md
**Актуально на 20 мая 2026 — единственный источник правды по адресам**

## Актуальные адреса (testnet)

- **StarForgeUnitNFT**: `0x9c8784d47dA7fc4772EE617dC3A49c506A6481A1`
- **StarForgeRelic**: `0x619e19df1975A8D289545834aAff3FEEf1b84909`
- **StarForgePlayerProfile**: `0x48820B6263920fBD843F203E982cCa908Bd12dB3`
- **StarForgeGame** (новый): `0xB0768AE07a84F8172424ED331c80525D1B4564de` ← **актуальный**

## Порядок деплоя и связывания контрактов

**При деплое нового StarForgeGame:**

1. Деплоим **НОВЫЙ** `StarForgeGame` с параметрами:
   - `_unitNFT` = `0x9c8784d47dA7fc4772EE617dC3A49c506A6481A1`
   - `_relic` = `0x619e19df1975A8D289545834aAff3FEEf1b84909`
   - `_playerProfile` = `0x48820B6263920fBD843F203E982cCa908Bd12dB3`

2. После деплоя выполняем:

```solidity
// 1. NFT → новый Game
StarForgeUnitNFT.setGameContract(0xB0768AE07a84F8172424ED331c80525D1B4564de)

// 2. Relic → новый Game
StarForgeRelic.setGameContract(0xB0768AE07a84F8172424ED331c80525D1B4564de)

// 3. PlayerProfile → новый Game
StarForgePlayerProfile.setGameContract(0xB0768AE07a84F8172424ED331c80525D1B4564de)