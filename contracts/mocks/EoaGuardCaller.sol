// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

interface IStarForgeGameEntry {
    function buyUnit() external payable;
    function startMatch(uint256[] calldata team, uint256[] calldata equipped) external;
}

contract EoaGuardCaller {
    IStarForgeGameEntry public game;

    constructor(address game_) {
        game = IStarForgeGameEntry(game_);
    }

    function buy() external payable {
        game.buyUnit{value: msg.value}();
    }

    function fight(uint256[] calldata team) external {
        uint256[] memory equipped = new uint256[](0);
        game.startMatch(team, equipped);
    }

    receive() external payable {}
}
