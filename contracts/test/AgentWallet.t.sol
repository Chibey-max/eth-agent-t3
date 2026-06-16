// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/AgentWallet.sol";

contract Receiver {
    uint256 public received;
    function ping() external payable { received += msg.value; }
    receive() external payable { received += msg.value; }
}

contract AgentWalletTest is Test {
    AgentWallet wallet;
    Receiver target;

    address guardian = makeAddr("guardian");
    address agent = makeAddr("agent");
    bytes32 didHash = keccak256("did:t3n:agent");

    function setUp() public {
        wallet = new AgentWallet(guardian);
        target = new Receiver();
        vm.deal(address(wallet), 100 ether);
    }

    function test_registerAndRevoke() public {
        vm.prank(guardian);
        wallet.registerAgent(agent, didHash, 1 ether, 10 ether);
        assertTrue(wallet.isWhitelisted(agent));

        vm.prank(guardian);
        wallet.revokeAgent(agent);
        assertFalse(wallet.isWhitelisted(agent));
    }

    function test_onlyGuardianCanRegister() public {
        vm.prank(agent);
        vm.expectRevert("AgentWallet: not guardian");
        wallet.registerAgent(agent, didHash, 1 ether, 10 ether);
    }

    function test_transferWithinCapSucceeds() public {
        vm.prank(guardian);
        wallet.registerAgent(agent, didHash, 1 ether, 10 ether);
        vm.prank(agent);
        wallet.executeAction(address(target), "", 0.5 ether);
        assertEq(target.received(), 0.5 ether);
    }

    function test_transferOverCapReverts() public {
        vm.prank(guardian);
        wallet.registerAgent(agent, didHash, 1 ether, 10 ether);
        vm.prank(agent);
        vm.expectRevert("AgentWallet: exceeds spending cap");
        wallet.executeAction(address(target), "", 2 ether);
    }

    function test_contractCallRequiresWhitelistedSelector() public {
        vm.prank(guardian);
        wallet.registerAgent(agent, didHash, 1 ether, 10 ether);
        bytes memory data = abi.encodeWithSignature("ping()");

        vm.prank(agent);
        vm.expectRevert("AgentWallet: selector not whitelisted");
        wallet.executeAction(address(target), data, 0.1 ether);

        vm.prank(guardian);
        wallet.whitelistSelector(agent, bytes4(keccak256("ping()")));

        vm.prank(agent);
        wallet.executeAction(address(target), data, 0.1 ether);
        assertEq(target.received(), 0.1 ether);
    }

    function test_dailyLimitEnforced() public {
        vm.prank(guardian);
        wallet.registerAgent(agent, didHash, 1 ether, 1 ether);
        vm.prank(agent);
        wallet.executeAction(address(target), "", 0.6 ether);
        vm.prank(agent);
        vm.expectRevert("AgentWallet: daily limit exceeded");
        wallet.executeAction(address(target), "", 0.6 ether);
    }

    function test_dailyLimitResetsAfter24h() public {
        vm.prank(guardian);
        wallet.registerAgent(agent, didHash, 1 ether, 1 ether);
        vm.prank(agent);
        wallet.executeAction(address(target), "", 0.9 ether);
        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(agent);
        wallet.executeAction(address(target), "", 0.9 ether);
        assertEq(target.received(), 1.8 ether);
    }

    function test_queuedActionCannotExecuteEarly() public {
        vm.prank(guardian);
        wallet.registerAgent(agent, didHash, 1 ether, 10 ether);
        vm.prank(agent);
        bytes32 id = wallet.queueAction(address(target), "", 0.5 ether);
        vm.expectRevert("AgentWallet: timelock active");
        wallet.executeQueued(id);
    }

    function test_queuedActionExecutesAfterDelay() public {
        vm.prank(guardian);
        wallet.registerAgent(agent, didHash, 1 ether, 10 ether);
        vm.prank(agent);
        bytes32 id = wallet.queueAction(address(target), "", 0.5 ether);
        vm.warp(block.timestamp + 1 hours + 1);
        wallet.executeQueued(id);
        assertEq(target.received(), 0.5 ether);
    }

    function test_inactiveAgentCannotAct() public {
        vm.prank(agent);
        vm.expectRevert("AgentWallet: not an active agent");
        wallet.executeAction(address(target), "", 0.1 ether);
    }
}
