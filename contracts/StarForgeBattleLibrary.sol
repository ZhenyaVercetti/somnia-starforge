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
        bool hasLastStand;
    }

    struct BattleEvent {
        uint8 round;
        bool isPlayerSide;
        uint8 attackerIndex;
        uint8 targetIndex;
        uint16 damage;
        uint16 remainingHp;
        string specialEffect;
    }

        function _applyRelics(
        CombatUnit[] memory team,
        address /*player*/,                    // закомментировано, чтобы убрать warning
        StarForgeRelic relicContract,
        uint256[] memory playerRelics
    ) internal view {
        for (uint256 i = 0; i < playerRelics.length; i++) {
            StarForgeRelic.RelicData memory r = relicContract.getRelic(playerRelics[i]);
            for (uint256 j = 0; j < team.length; j++) {
                if (r.relicType == StarForgeRelic.RelicType.ATTACK_BOOST) team[j].attack += r.value;
                else if (r.relicType == StarForgeRelic.RelicType.DEFENSE_BOOST) team[j].defense += r.value;
                else if (r.relicType == StarForgeRelic.RelicType.SPEED_BOOST) team[j].speed += r.value;
                else if (r.relicType == StarForgeRelic.RelicType.HP_BOOST) {
                    team[j].hp += uint16(r.value) * 3;
                    team[j].maxHp += uint16(r.value) * 3;
                }
                else if (r.relicType == StarForgeRelic.RelicType.CRIT_CHANCE) team[j].critChance += r.value;
                else if (r.relicType == StarForgeRelic.RelicType.LAST_STAND) team[j].hasLastStand = true;
            }
        }
    }

    function _getPlayerTeamStats(
        uint256[] memory teamIds,
        StarForgeUnitNFT unitNFT
    ) internal view returns (CombatUnit[] memory) {
        CombatUnit[] memory team = new CombatUnit[](teamIds.length);
        for (uint256 i = 0; i < teamIds.length; i++) {
            StarForgeUnitNFT.Unit memory u = unitNFT.getUnit(teamIds[i]);
            uint16 hp = uint16(u.defense) * 3 + 20;
            team[i] = CombatUnit({
                attack: u.attack,
                defense: u.defense,
                speed: u.speed,
                hp: hp,
                maxHp: hp,
                critChance: 0,
                hasLastStand: false
            });
        }
        return team;
    }

    function _doAttack(
        CombatUnit[] memory attackers,
        CombatUnit[] memory defenders,
        bool isPlayerSide,
        uint8 round,
        uint256 seed,
        BattleEvent[] memory events,
        uint256 eventIdx
    ) internal pure returns (bool) {
        uint256 attackerIdx = 0;
        uint8 bestSpeed = 0;
        for (uint256 i = 0; i < attackers.length; i++) {
            if (attackers[i].hp > 0 && attackers[i].speed > bestSpeed) {
                bestSpeed = attackers[i].speed;
                attackerIdx = i;
            }
        }
        if (bestSpeed == 0) return false;

        uint256 targetIdx = 0;
        uint256 aliveCount = 0;
        for (uint256 i = 0; i < defenders.length; i++) if (defenders[i].hp > 0) aliveCount++;
        if (aliveCount == 0) return false;

        if (aliveCount > 1) {
            targetIdx = (seed >> (round * 5 + eventIdx)) % aliveCount;
            uint256 counter = 0;
            for (uint256 i = 0; i < defenders.length; i++) {
                if (defenders[i].hp > 0) {
                    if (counter == targetIdx) {
                        targetIdx = i;
                        break;
                    }
                    counter++;
                }
            }
        }

        uint16 dmg = uint16(attackers[attackerIdx].attack) - uint16(attackers[attackerIdx].defense / 2);
        dmg += uint16((seed >> (round + eventIdx * 3)) % 4);

        if (attackers[attackerIdx].critChance > 0 && (seed % 100 < attackers[attackerIdx].critChance * 5)) {
            dmg = dmg * 3 / 2;
        }

        if (dmg > defenders[targetIdx].hp) dmg = defenders[targetIdx].hp;
        defenders[targetIdx].hp -= dmg;

        string memory effect = dmg >= 15 ? "Quantum Flux" : "";

        events[eventIdx] = BattleEvent({
            round: round,
            isPlayerSide: isPlayerSide,
            attackerIndex: uint8(attackerIdx),
            targetIndex: uint8(targetIdx),
            damage: dmg,
            remainingHp: defenders[targetIdx].hp,
            specialEffect: effect
        });

        return true;
    }

    function _simulateBattle(
        uint256[] memory playerTeamIds,
        ShopItem[] memory aiTeam,
        uint256 seed,
        address player,
        StarForgeUnitNFT unitNFT,
        StarForgeRelic relicContract,
        uint256[] memory playerRelics
    ) internal view returns (bool playerWon, BattleEvent[] memory events) {
        CombatUnit[] memory playerTeam = _getPlayerTeamStats(playerTeamIds, unitNFT);
        _applyRelics(playerTeam, player, relicContract, playerRelics);

        CombatUnit[] memory aiTeamStats = new CombatUnit[](aiTeam.length);
        for (uint256 i = 0; i < aiTeam.length; i++) {
            uint16 hp = uint16(aiTeam[i].defense) * 3 + 20;
            aiTeamStats[i] = CombatUnit({
                attack: aiTeam[i].attack,
                defense: aiTeam[i].defense,
                speed: aiTeam[i].speed,
                hp: hp,
                maxHp: hp,
                critChance: 0,
                hasLastStand: false
            });
        }

        BattleEvent[] memory battleEvents = new BattleEvent[](48);
        uint256 eventCount = 0;
        uint8 round = 1;

        while (round <= 12) {
            bool playerAlive = false;
            for (uint256 i = 0; i < playerTeam.length; i++) if (playerTeam[i].hp > 0) { playerAlive = true; break; }
            bool aiAlive = false;
            for (uint256 i = 0; i < aiTeamStats.length; i++) if (aiTeamStats[i].hp > 0) { aiAlive = true; break; }
            if (!playerAlive || !aiAlive) break;

            bool playerSideFirst = (seed & (1 << (round % 8))) != 0;

            if (_doAttack(playerTeam, aiTeamStats, playerSideFirst, round, seed, battleEvents, eventCount)) eventCount++;
            if (_doAttack(aiTeamStats, playerTeam, !playerSideFirst, round, seed, battleEvents, eventCount)) eventCount++;

            round++;
        }

        bool won = true;
        for (uint256 i = 0; i < aiTeamStats.length; i++) {
            if (aiTeamStats[i].hp > 0) { won = false; break; }
        }

        BattleEvent[] memory finalEvents = new BattleEvent[](eventCount);
        for (uint256 i = 0; i < eventCount; i++) {
            finalEvents[i] = battleEvents[i];
        }

        return (won, finalEvents);
    }
}