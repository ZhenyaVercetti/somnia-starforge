// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./StarForgeUnitNFT.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract StarForgeGame is Ownable {
    StarForgeUnitNFT public unitNFT;

    struct PlayerProfile {
        uint256 level;
        uint256 xp;
        uint256[] ownedUnits;
        uint256[] currentTeam;
    }

    mapping(address => PlayerProfile) public profiles;

    event MatchPlayed(address player, uint256 score, uint256[] rewards);

    constructor(address _unitNFT) Ownable(msg.sender) {
        unitNFT = StarForgeUnitNFT(_unitNFT);
    }

    function startMatch(uint256[] calldata team) external {
        uint256 score = 0;
        for (uint i = 0; i < team.length; i++) {
            StarForgeUnitNFT.Unit memory u = unitNFT.getUnitData(team[i]);
            score += u.attack + u.defense + u.speed;
        }

        uint256 newUnitId = unitNFT.mintUnit(msg.sender, "Echo Drone Alpha", "Mechanoids", 1, 5, 3, 7);

        profiles[msg.sender].currentTeam = team;
        profiles[msg.sender].xp += 100;
        if (profiles[msg.sender].xp >= 1000) {
            profiles[msg.sender].level++;
            profiles[msg.sender].xp = 0;
        }

        emit MatchPlayed(msg.sender, score, new uint256[](1));
    }
}
