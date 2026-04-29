// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./StarForgeUnitNFT.sol";
import "./StarForgeRelic.sol";

library StarForgeBattleLibrary {

    struct ShopItem {
        bool isRelic;
        uint256 id;
        StarForgeUnitNFT.Faction faction;
        StarForgeUnitNFT.Rarity rarity;
        StarForgeUnitNFT.UnitClass unitClass;
        uint8 attack;
        uint8 defense;
        uint8 speed;
        uint8 relicType;
        uint8 relicValue;
    }

    struct CombatUnit {
        uint8 attack;
        uint8 defense;
        uint8 speed;
        uint16 hp;
        uint16 maxHp;
        uint8 critChance;
        uint8 dodgeChance;
        bool hasLastStand;
        uint16 initiative;
        StarForgeUnitNFT.Faction faction;
        StarForgeUnitNFT.Rarity rarity;
        StarForgeUnitNFT.UnitClass unitClass;
    }

    struct BattleEvent {
        uint8 round;
        bool isPlayerSide;
        uint8 attackerIndex;
        uint8 targetIndex;
        uint16 damage;
        uint16 damageDealt;
        uint16 initialHp;
        uint16 remainingHp;
        string specialEffect;
        uint8 attackerRarity;
        uint8 attackerClass;
        uint8 targetRarity;
        uint8 targetClass;
    }

    struct BattleResult {
        bool playerWon;
        BattleEvent[] events;
        uint16[] playerMaxHp;
        uint16[] aiMaxHp;
    }

    uint8 constant MAX_ROUNDS = 18;
    uint256 constant MAX_EVENTS = 120;

    function _getBaseHP(StarForgeUnitNFT.Rarity rarity) internal pure returns (uint16) {
        if (rarity == StarForgeUnitNFT.Rarity.Common) return 65;
        if (rarity == StarForgeUnitNFT.Rarity.Rare) return 82;
        return 105;
    }

    function _calculateHP(uint16 baseHP, uint8 defense) internal pure returns (uint16) {
        return baseHP + uint16(defense) * 4;
    }

    function _calculateDamage(
        uint8 atk,
        uint8 def,
        uint8 critChance,
        uint8 dodgeChance,
        uint256 seed
    ) internal pure returns (uint16 damageDealt, string memory effect) {
        uint256 dodgeSeed = seed % 100;
        uint256 critSeed = (seed >> 24) % 100;

        if (dodgeChance > 0 && dodgeSeed < uint256(dodgeChance) * 25 / 10) {
            return (0, "DODGE");
        }

        uint16 baseDmg = uint16(atk) * (110 + uint16(seed % 35)) / (uint16(def) + 18);
        if (baseDmg < 2) baseDmg = 2 + (atk / 3);

        uint16 variance = uint16((seed >> 8) % 37);
        uint16 dmg = baseDmg * (82 + variance) / 100;

        if (critChance > 0 && critSeed < uint16(critChance) * 28 / 10) {
            dmg = dmg * 13 / 10;   // +30% вместо +50%
            effect = "CRIT";
        }

        return (dmg, effect);
    }

    function _simulateBattle(
        uint256[] memory playerTeamIds,
        ShopItem[] memory aiTeam,
        uint256 seed,
        address /*player*/,
        StarForgeUnitNFT unitNFT,
        StarForgeRelic relicContract,
        uint256[] memory playerRelics,
        uint16 playerLevel
    ) internal view returns (BattleResult memory) {
        CombatUnit[] memory playerTeam = _getPlayerTeam(playerTeamIds, unitNFT, playerLevel, relicContract, playerRelics);
        CombatUnit[] memory aiTeamStats = _getAITeam(aiTeam);

        _applyFactionSynergy(playerTeam);
        _applyFactionSynergy(aiTeamStats);

        uint16[] memory playerMaxHp = new uint16[](playerTeam.length);
        uint16[] memory aiMaxHp = new uint16[](aiTeamStats.length);
        for (uint256 i = 0; i < playerTeam.length; i++) {
            playerMaxHp[i] = playerTeam[i].maxHp;
        }
        for (uint256 i = 0; i < aiTeamStats.length; i++) {
            aiMaxHp[i] = aiTeamStats[i].maxHp;
        }

        BattleEvent[] memory events = new BattleEvent[](MAX_EVENTS);
        uint256 eventCount = 0;
        uint8 round = 1;

        while (round <= MAX_ROUNDS) {
            if (!_isTeamAlive(playerTeam) || !_isTeamAlive(aiTeamStats)) break;

            _addInitiative(playerTeam);
            _addInitiative(aiTeamStats);

            uint8 numAttackers = 1 + uint8((seed >> (round * 3)) % 2);

            for (uint8 i = 0; i < numAttackers; i++) {
                if (eventCount >= MAX_EVENTS - 1) break;
                if (!_isTeamAlive(playerTeam) || !_isTeamAlive(aiTeamStats)) break;

                (bool isPlayerTurn, uint8 attackerIdx) = _findHighestInitiative(playerTeam, aiTeamStats, seed, round);

                if (isPlayerTurn) {
                    if (_doAttack(playerTeam, aiTeamStats, true, attackerIdx, round, seed, events, eventCount)) {
                        eventCount++;
                    }
                } else {
                    if (_doAttack(aiTeamStats, playerTeam, false, attackerIdx, round, seed, events, eventCount)) {
                        eventCount++;
                    }
                }
            }
            round++;
        }

        bool playerWon = !_isTeamAlive(aiTeamStats);

        BattleEvent[] memory finalEvents = new BattleEvent[](eventCount);
        for (uint256 i = 0; i < eventCount; i++) {
            finalEvents[i] = events[i];
        }

        BattleResult memory result;
        result.playerWon = playerWon;
        result.events = finalEvents;
        result.playerMaxHp = playerMaxHp;
        result.aiMaxHp = aiMaxHp;
        return result;
    }

    function _applyFactionSynergy(CombatUnit[] memory team) internal pure {
        uint8[3] memory factionCount;
        for (uint256 i = 0; i < team.length; i++) {
            if (team[i].hp > 0) factionCount[uint8(team[i].faction)]++;
        }
        for (uint256 i = 0; i < team.length; i++) {
            if (factionCount[uint8(team[i].faction)] >= 3) {
                team[i].attack += 2;
            }
        }
    }

    function _getPlayerTeam(
        uint256[] memory teamIds,
        StarForgeUnitNFT unitNFT,
        uint16 playerLevel,
        StarForgeRelic relicContract,
        uint256[] memory equippedRelics
    ) internal view returns (CombatUnit[] memory) {
        CombatUnit[] memory team = new CombatUnit[](teamIds.length);
        for (uint256 i = 0; i < teamIds.length; i++) {
            StarForgeUnitNFT.Unit memory u = unitNFT.getUnit(teamIds[i]);
            uint16 baseHP = _getBaseHP(u.rarity);
            uint16 hp = _calculateHP(baseHP, u.defense);

            team[i] = CombatUnit({
                attack: u.attack,
                defense: u.defense,
                speed: u.speed,
                hp: hp,
                maxHp: hp,
                critChance: _getCritChance(u.rarity),
                dodgeChance: _getDodgeChance(u.rarity, u.speed),
                hasLastStand: false,
                initiative: 0,
                faction: u.faction,
                rarity: u.rarity,
                unitClass: u.unitClass
            });
        }
        _applyLevelBonus(team, playerLevel);
        _applyRelics(team, relicContract, equippedRelics);
        return team;
    }

    function _getAITeam(ShopItem[] memory aiTeam) internal pure returns (CombatUnit[] memory) {
        CombatUnit[] memory team = new CombatUnit[](aiTeam.length);
        for (uint256 i = 0; i < aiTeam.length; i++) {
            ShopItem memory u = aiTeam[i];
            uint16 baseHP = _getBaseHP(u.rarity);
            uint16 hp = _calculateHP(baseHP, u.defense);

            team[i] = CombatUnit({
                attack: u.attack,
                defense: u.defense,
                speed: u.speed,
                hp: hp,
                maxHp: hp,
                critChance: _getCritChance(u.rarity),
                dodgeChance: _getDodgeChance(u.rarity, u.speed),
                hasLastStand: false,
                initiative: 0,
                faction: u.faction,
                rarity: u.rarity,
                unitClass: u.unitClass
            });
        }
        return team;
    }

    function _getCritChance(StarForgeUnitNFT.Rarity rarity) internal pure returns (uint8) {
        if (rarity == StarForgeUnitNFT.Rarity.Common) return 6;
        if (rarity == StarForgeUnitNFT.Rarity.Rare) return 12;
        return 20;
    }

    function _getDodgeChance(StarForgeUnitNFT.Rarity rarity, uint8 speed) internal pure returns (uint8) {
        uint8 base = speed / 22;
        if (rarity == StarForgeUnitNFT.Rarity.Rare) base += 2;
        if (rarity == StarForgeUnitNFT.Rarity.Legendary) base += 4;
        return base > 18 ? 18 : base;
    }

    function _applyLevelBonus(CombatUnit[] memory team, uint16 level) internal pure {
        if (level == 0) return;
        uint256 multiplier = 100 + uint256(level) * 3;
        for (uint256 i = 0; i < team.length; i++) {
            team[i].attack  = uint8(uint256(team[i].attack)  * multiplier / 100);
            team[i].defense = uint8(uint256(team[i].defense) * multiplier / 100);
            team[i].speed   = uint8(uint256(team[i].speed)   * multiplier / 100);
            team[i].hp      = uint16(uint256(team[i].hp)      * multiplier / 100);
            team[i].maxHp   = team[i].hp;
        }
    }

    function _applyRelics(
        CombatUnit[] memory team,
        StarForgeRelic relicContract,
        uint256[] memory relics
    ) internal view {
        for (uint256 i = 0; i < relics.length; i++) {
            if (relics[i] == 0) continue;
            StarForgeRelic.RelicData memory r = relicContract.getRelic(relics[i]);
            for (uint256 j = 0; j < team.length; j++) {
                if (r.relicType == StarForgeRelic.RelicType.ATTACK_BOOST) team[j].attack += r.value;
                else if (r.relicType == StarForgeRelic.RelicType.DEFENSE_BOOST) team[j].defense += r.value;
                else if (r.relicType == StarForgeRelic.RelicType.SPEED_BOOST) team[j].speed += r.value;
                else if (r.relicType == StarForgeRelic.RelicType.HP_BOOST) {
                    team[j].hp = team[j].hp * (100 + uint16(r.value) * 3) / 100;
                    team[j].maxHp = team[j].hp;
                }
                else if (r.relicType == StarForgeRelic.RelicType.CRIT_CHANCE) team[j].critChance += r.value;
                else if (r.relicType == StarForgeRelic.RelicType.LAST_STAND) team[j].hasLastStand = true;
            }
        }
    }

    function _addInitiative(CombatUnit[] memory team) internal pure {
        for (uint256 i = 0; i < team.length; i++) {
            if (team[i].hp > 0) {
                team[i].initiative += uint16(team[i].speed);
            }
        }
    }

    function _findHighestInitiative(
        CombatUnit[] memory playerTeam,
        CombatUnit[] memory aiTeam,
        uint256 /*seed*/,
        uint8 /*round*/
    ) internal pure returns (bool isPlayer, uint8 index) {
        uint16 maxInit = 0;
        bool foundPlayer = false;
        uint8 playerIdx = 0;
        uint8 aiIdx = 0;

        for (uint256 i = 0; i < playerTeam.length; i++) {
            if (playerTeam[i].hp > 0 && playerTeam[i].initiative > maxInit) {
                maxInit = playerTeam[i].initiative;
                foundPlayer = true;
                playerIdx = uint8(i);
            }
        }
        for (uint256 i = 0; i < aiTeam.length; i++) {
            if (aiTeam[i].hp > 0 && aiTeam[i].initiative > maxInit) {
                maxInit = aiTeam[i].initiative;
                foundPlayer = false;
                aiIdx = uint8(i);
            }
        }

        if (maxInit == 0) {
            _addInitiative(playerTeam);
            _addInitiative(aiTeam);
            return _findHighestInitiative(playerTeam, aiTeam, 0, 0);
        }

        isPlayer = foundPlayer;
        index = foundPlayer ? playerIdx : aiIdx;

        if (isPlayer) playerTeam[index].initiative = 0;
        else aiTeam[index].initiative = 0;

        return (isPlayer, index);
    }

    function _doAttack(
        CombatUnit[] memory attackers,
        CombatUnit[] memory defenders,
        bool isPlayerSide,
        uint8 attackerIdx,
        uint8 round,
        uint256 seed,
        BattleEvent[] memory events,
        uint256 eventIdx
    ) internal pure returns (bool) {
        if (attackers[attackerIdx].hp == 0) return false;

        uint256 alive = 0;
        for (uint256 i = 0; i < defenders.length; i++) {
            if (defenders[i].hp > 0) alive++;
        }
        if (alive == 0) return false;

        uint256 targetIdx = 0;
        if (alive == 1) {
            for (uint256 i = 0; i < defenders.length; i++) {
                if (defenders[i].hp > 0) { targetIdx = i; break; }
            }
        } else {
            targetIdx = (seed >> (round * 4 + eventIdx)) % alive;
            uint256 counter = 0;
            for (uint256 i = 0; i < defenders.length; i++) {
                if (defenders[i].hp > 0) {
                    if (counter == targetIdx) { targetIdx = i; break; }
                    counter++;
                }
            }
        }

        uint16 initialHp = defenders[targetIdx].hp;

        (uint16 damageDealt, string memory effect) = _calculateDamage(
            attackers[attackerIdx].attack,
            defenders[targetIdx].defense,
            attackers[attackerIdx].critChance,
            defenders[targetIdx].dodgeChance,
            seed >> (eventIdx * 3)
        );

        if (damageDealt > defenders[targetIdx].hp) damageDealt = defenders[targetIdx].hp;

        bool lastStandTriggered = false;
        if (defenders[targetIdx].hasLastStand && defenders[targetIdx].hp <= damageDealt) {
            damageDealt = defenders[targetIdx].hp - 1;
            defenders[targetIdx].hp = 1;
            lastStandTriggered = true;
            effect = "Last Stand";
        } else {
            defenders[targetIdx].hp -= damageDealt;
        }

        if (lastStandTriggered) effect = "Last Stand";

        events[eventIdx] = BattleEvent({
            round: round,
            isPlayerSide: isPlayerSide,
            attackerIndex: attackerIdx,
            targetIndex: uint8(targetIdx),
            damage: damageDealt,
            damageDealt: damageDealt,
            initialHp: initialHp,
            remainingHp: defenders[targetIdx].hp,
            specialEffect: effect,
            attackerRarity: uint8(attackers[attackerIdx].rarity),
            attackerClass: uint8(attackers[attackerIdx].unitClass),
            targetRarity: uint8(defenders[targetIdx].rarity),
            targetClass: uint8(defenders[targetIdx].unitClass)
        });

        return true;
    }

    function _isTeamAlive(CombatUnit[] memory team) internal pure returns (bool) {
        for (uint256 i = 0; i < team.length; i++) {
            if (team[i].hp > 0) return true;
        }
        return false;
    }
}