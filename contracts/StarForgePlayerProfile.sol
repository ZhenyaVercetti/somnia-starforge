// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract StarForgePlayerProfile is Ownable, AccessControl {
    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");

    struct PlayerProfile {
        uint16 level;
        uint32 xp;
        uint256 wins;
        uint256 losses;
        uint16 currentAITier;
    }

    mapping(address => PlayerProfile) public profiles;

    // Хранение юнитов и реликвий (не сбрасывается при обновлении Game)
    mapping(address => uint256[]) public playerUnits;
    mapping(address => uint256[]) public playerRelics;

    // Дневные лимиты (обновляются в 00:00 UTC)
    mapping(address => uint256) public dailyBuysUsed;      // сколько юнитов купил сегодня
    mapping(address => uint256) public dailyRerollsUsed;   // сколько reroll сделал сегодня
    mapping(address => uint256) public lastResetTimestamp; // когда последний раз сбрасывали лимиты

    event ProfileCreated(address indexed player);
    event ProfileUpdated(address indexed player, uint16 level, uint32 xp, uint256 wins, uint256 losses);
    event UnitAdded(address indexed player, uint256 tokenId);
    event RelicAdded(address indexed player, uint256 relicId);

    constructor() Ownable() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function setGameContract(address gameContract) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(GAME_ROLE, gameContract);
    }

    // ==================== PROFILE ====================

    function createProfile(address player) external onlyRole(GAME_ROLE) {
        if (profiles[player].level == 0) {
            profiles[player] = PlayerProfile({
                level: 1,
                xp: 0,
                wins: 0,
                losses: 0,
                currentAITier: 1
            });
            emit ProfileCreated(player);
        }
    }

    function getProfile(address player) external view returns (PlayerProfile memory) {
        return profiles[player];
    }

    function updateAfterBattle(address player, bool won) external onlyRole(GAME_ROLE) {
        PlayerProfile storage profile = profiles[player];
        if (profile.level == 0) return;

        if (won) {
            profile.wins += 1;
            profile.xp += 25;
        } else {
            profile.losses += 1;
            profile.xp += 10;
        }

        // Level up
        uint32 xpNeeded = uint32(profile.level) * 55 + 90;
        while (profile.xp >= xpNeeded) {
            profile.level += 1;
            profile.xp -= xpNeeded;
            xpNeeded = uint32(profile.level) * 55 + 90;
        }

        emit ProfileUpdated(player, profile.level, profile.xp, profile.wins, profile.losses);
    }

    // ==================== UNITS & RELICS ====================

    function addUnit(address player, uint256 tokenId) external onlyRole(GAME_ROLE) {
        playerUnits[player].push(tokenId);
        emit UnitAdded(player, tokenId);
    }

    function addRelic(address player, uint256 relicId) external onlyRole(GAME_ROLE) {
        playerRelics[player].push(relicId);
        emit RelicAdded(player, relicId);
    }

    function getPlayerUnits(address player) external view returns (uint256[] memory) {
        return playerUnits[player];
    }

    function getPlayerRelics(address player) external view returns (uint256[] memory) {
        return playerRelics[player];
    }

    // ==================== DAILY LIMITS ====================

    function _resetDailyLimitsIfNeeded(address player) internal {
        uint256 currentDay = block.timestamp / 86400; // 00:00 UTC
        uint256 lastDay = lastResetTimestamp[player] / 86400;

        if (currentDay > lastDay) {
            dailyBuysUsed[player] = 0;
            dailyRerollsUsed[player] = 0;
            lastResetTimestamp[player] = block.timestamp;
        }
    }

    function getRemainingBuys(address player) external view returns (uint256) {
        uint256 currentDay = block.timestamp / 86400;
        uint256 lastDay = lastResetTimestamp[player] / 86400;

        if (currentDay > lastDay) {
            // Лимит сброшен
            uint16 level = profiles[player].level;
            if (level == 0) level = 1;
            return 10 + uint256(level - 1); // базовые 10 + 1 за каждый уровень
        } else {
            uint16 level = profiles[player].level;
            if (level == 0) level = 1;
            uint256 maxBuys = 10 + uint256(level - 1);
            if (dailyBuysUsed[player] >= maxBuys) return 0;
            return maxBuys - dailyBuysUsed[player];
        }
    }

    function canReroll(address player) external view returns (bool) {
        uint256 currentDay = block.timestamp / 86400;
        uint256 lastDay = lastResetTimestamp[player] / 86400;

        if (currentDay > lastDay) {
            return true; // лимит сброшен
        } else {
            return dailyRerollsUsed[player] < 2;
        }
    }

    function useBuy(address player) external onlyRole(GAME_ROLE) {
        _resetDailyLimitsIfNeeded(player);
        dailyBuysUsed[player] += 1;
    }

    function useReroll(address player) external onlyRole(GAME_ROLE) {
        _resetDailyLimitsIfNeeded(player);
        dailyRerollsUsed[player] += 1;
    }

    // ==================== ADMIN ====================

    function grantGameRole(address gameContract) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(GAME_ROLE, gameContract);
    }
}