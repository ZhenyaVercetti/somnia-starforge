// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./StarForgeUnitNFT.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract StarForgeGame is Ownable {
    StarForgeUnitNFT public unitNFT;

    uint256 public constant SHOP_COST = 0.001 ether; // STT, дешево
    uint256 public constant REROLL_COST = 0.0005 ether;

    struct PlayerProfile {
        uint256 level;
        uint256 xp;
        uint256[] ownedUnits;
        uint256[] currentTeam; // max 8
    }

    mapping(address => PlayerProfile) public profiles;

    event MatchPlayed(address player, uint256 score, uint256[] rewards);
    event UnitBought(address player, uint256 tokenId);

    constructor(address _unitNFT) Ownable(msg.sender) {
        unitNFT = StarForgeUnitNFT(_unitNFT);
    }

    // === SHOP ===
    function buyUnit(string memory name, string memory faction, uint8 rarity, uint8 atk, uint8 def, uint8 spd) external payable {
        require(msg.value == SHOP_COST, "Wrong price");
        uint256 newId = unitNFT.mintUnit(msg.sender, name, faction, rarity, atk, def, spd);
        profiles[msg.sender].ownedUnits.push(newId);
        emit UnitBought(msg.sender, newId);
    }

    function rerollShop() external payable {
        require(msg.value == REROLL_COST, "Wrong price");
        // Здесь фронт просто вызывает buyUnit заново — reroll = новый вызов
    }

    // === BATTLE RESOLVER (детерминистичный, on-chain) ===
    function startMatch(uint256[] calldata team) external {
        require(team.length <= 8, "Max 8 units");

        uint256 score = _simulateBattle(team);

        // Mint награды (1-2 юнита)
        uint256 reward1 = unitNFT.mintUnit(msg.sender, "Battle Echo", "Mechanoids", 1, 4, 4, 5);
        uint256 reward2 = unitNFT.mintUnit(msg.sender, "Void Shard", "Voidborn", 2, 7, 3, 6);

        profiles[msg.sender].currentTeam = team;
        profiles[msg.sender].xp += 150;
        if (profiles[msg.sender].xp >= 1000) {
            profiles[msg.sender].level++;
            profiles[msg.sender].xp = 0;
        }

        uint256[] memory rewards = new uint256[](2);
        rewards[0] = reward1;
        rewards[1] = reward2;

        emit MatchPlayed(msg.sender, score, rewards);
    }

    function _simulateBattle(uint256[] calldata team) internal view returns (uint256) {
        uint256 totalScore = 0;

        // Простые synergies (3 фракции)
        uint8 empireCount = 0;
        uint8 voidbornCount = 0;
        uint8 mechanoidsCount = 0;

        for (uint i = 0; i < team.length; i++) {
            StarForgeUnitNFT.Unit memory u = unitNFT.getUnitData(team[i]);
            totalScore += u.attack + u.defense + u.speed;

            if (keccak256(bytes(u.faction)) == keccak256(bytes("Empire"))) empireCount++;
            else if (keccak256(bytes(u.faction)) == keccak256(bytes("Voidborn"))) voidbornCount++;
            else if (keccak256(bytes(u.faction)) == keccak256(bytes("Mechanoids"))) mechanoidsCount++;
        }

        // Synergies
        if (empireCount >= 3) totalScore += 30;      // +shield
        if (voidbornCount >= 3) totalScore += 45;    // +crit
        if (mechanoidsCount >= 3) totalScore += 25;  // +repair

        return totalScore;
    }
}
