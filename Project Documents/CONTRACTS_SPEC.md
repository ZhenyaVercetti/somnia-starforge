# CONTRACTS_SPEC.md

**Версия:** 1.3.4 (27 апреля 2026)

**Актуальные адреса (testnet):**
- StarForgeUnitNFT: 0x9D00dB7fb6faF315C9c63971ae34380d5b831a56
- StarForgeGame: 0x1cfB6c6fe1775cD9a324684f6C426f206368Eb59
- StarForgeRelic: 0x83930224Ced8cEB6350fC9F41202B8fAA0033173

**Статус:**
- StarForgeBattleLibrary.sol — вынесена логика боя
- StarForgeGame.sol — использует библиотеку, имеет getLastBattleResult
- rerollShop / buyFromShop / startMatch — работают стабильно
- Артефакты полностью применяются в бою
- Double-click по юнитам оставлен как есть

Готовы к v1.4.