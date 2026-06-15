// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/AgentWallet.sol";

contract DeployAgentWallet is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address guardian = vm.envAddress("GUARDIAN_ADDRESS");

        vm.startBroadcast(deployerKey);
        AgentWallet wallet = new AgentWallet(guardian);
        vm.stopBroadcast();

        console.log("AgentWallet deployed at:", address(wallet));
        console.log("Guardian:", guardian);
    }
}
