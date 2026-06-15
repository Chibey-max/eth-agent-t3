// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AgentWallet
 * @notice On-chain policy enforcement for TEE-verified ETH agents.
 *
 * Trust stack:
 *   T3N TEE (identity + policy check inside enclave)
 *     → AgentWallet.sol (on-chain spending cap + whitelist)
 *       → Target contract / EOA
 *
 * The guardian registers agents with their T3N DID after the TEE
 * has verified identity. The AgentWallet enforces spending caps
 * and selector whitelists as a second enforcement layer.
 */
contract AgentWallet is ReentrancyGuard, Ownable {
    // ── Types ──────────────────────────────────────────────────────────────

    struct AgentPolicy {
        bool active;
        uint256 spendingCapWei;       // max wei per action
        uint256 dailyLimitWei;        // rolling 24h limit
        uint256 dailySpentWei;        // accumulated today
        uint256 dailyResetAt;         // unix timestamp for next reset
        bytes32 t3nDid;               // keccak256 of the did:t3n string
        mapping(bytes4 => bool) selectorWhitelist;
    }

    struct QueuedAction {
        address agent;
        address target;
        bytes   calldata_;
        uint256 value;
        uint256 readyAt;
        bool    executed;
    }

    // ── Storage ────────────────────────────────────────────────────────────

    address public guardian;
    uint256 public timelockDelay = 1 hours;

    mapping(address => AgentPolicy) private _policies;
    mapping(bytes32 => QueuedAction) public queue;

    // ── Events ─────────────────────────────────────────────────────────────

    event AgentRegistered(address indexed agent, bytes32 t3nDid, uint256 spendingCap);
    event AgentRevoked(address indexed agent);
    event ActionExecuted(address indexed agent, address indexed target, uint256 value, bool success);
    event ActionQueued(bytes32 indexed actionId, address indexed agent, address target, uint256 readyAt);
    event ActionExecutedFromQueue(bytes32 indexed actionId);
    event SelectorWhitelisted(address indexed agent, bytes4 selector);
    event GuardianTransferred(address oldGuardian, address newGuardian);

    // ── Modifiers ──────────────────────────────────────────────────────────

    modifier onlyGuardian() {
        require(msg.sender == guardian, "AgentWallet: not guardian");
        _;
    }

    modifier onlyActiveAgent() {
        require(_policies[msg.sender].active, "AgentWallet: not an active agent");
        _;
    }

    // ── Constructor ────────────────────────────────────────────────────────

    constructor(address _guardian) Ownable(msg.sender) {
        guardian = _guardian;
    }

    // ── Guardian functions ─────────────────────────────────────────────────

    /**
     * @notice Register an agent after its T3N DID has been verified in the TEE.
     * @param agent         The agent's Ethereum address
     * @param t3nDidHash    keccak256(abi.encodePacked(did_string))
     * @param spendingCap   Max wei per single action
     * @param dailyLimit    Rolling 24h spending limit in wei
     */
    function registerAgent(
        address agent,
        bytes32 t3nDidHash,
        uint256 spendingCap,
        uint256 dailyLimit
    ) external onlyGuardian {
        AgentPolicy storage p = _policies[agent];
        p.active = true;
        p.spendingCapWei = spendingCap;
        p.dailyLimitWei = dailyLimit;
        p.dailySpentWei = 0;
        p.dailyResetAt = block.timestamp + 1 days;
        p.t3nDid = t3nDidHash;
        emit AgentRegistered(agent, t3nDidHash, spendingCap);
    }

    function revokeAgent(address agent) external onlyGuardian {
        _policies[agent].active = false;
        emit AgentRevoked(agent);
    }

    function whitelistSelector(address agent, bytes4 selector) external onlyGuardian {
        _policies[agent].selectorWhitelist[selector] = true;
        emit SelectorWhitelisted(agent, selector);
    }

    function setTimelockDelay(uint256 delay) external onlyGuardian {
        require(delay >= 1 minutes && delay <= 7 days, "AgentWallet: delay out of range");
        timelockDelay = delay;
    }

    function transferGuardian(address newGuardian) external onlyGuardian {
        emit GuardianTransferred(guardian, newGuardian);
        guardian = newGuardian;
    }

    // ── Agent functions ────────────────────────────────────────────────────

    /**
     * @notice Execute an action immediately (within policy limits).
     */
    function executeAction(
        address target,
        bytes calldata data,
        uint256 value
    ) external nonReentrant onlyActiveAgent returns (bool) {
        _enforcePolicyAndSpend(msg.sender, data, value);

        (bool success, ) = target.call{value: value}(data);
        emit ActionExecuted(msg.sender, target, value, success);
        require(success, "AgentWallet: target call failed");
        return success;
    }

    /**
     * @notice Queue a timelocked action — must wait timelockDelay before executing.
     */
    function queueAction(
        address target,
        bytes calldata data,
        uint256 value
    ) external onlyActiveAgent returns (bytes32 actionId) {
        actionId = keccak256(abi.encodePacked(msg.sender, target, data, value, block.timestamp));
        queue[actionId] = QueuedAction({
            agent: msg.sender,
            target: target,
            calldata_: data,
            value: value,
            readyAt: block.timestamp + timelockDelay,
            executed: false
        });
        emit ActionQueued(actionId, msg.sender, target, block.timestamp + timelockDelay);
    }

    /**
     * @notice Execute a previously queued action after the timelock expires.
     */
    function executeQueued(bytes32 actionId) external nonReentrant {
        QueuedAction storage qa = queue[actionId];
        require(qa.agent != address(0), "AgentWallet: action not found");
        require(!qa.executed, "AgentWallet: already executed");
        require(block.timestamp >= qa.readyAt, "AgentWallet: timelock active");
        require(_policies[qa.agent].active, "AgentWallet: agent no longer active");

        _enforcePolicyAndSpend(qa.agent, qa.calldata_, qa.value);
        qa.executed = true;

        (bool success, ) = qa.target.call{value: qa.value}(qa.calldata_);
        emit ActionExecutedFromQueue(actionId);
        require(success, "AgentWallet: queued call failed");
    }

    // ── View functions ─────────────────────────────────────────────────────

    function isWhitelisted(address agent) external view returns (bool) {
        return _policies[agent].active;
    }

    function getPolicy(address agent) external view returns (
        bool active,
        uint256 spendingCap,
        uint256 dailyLimit,
        uint256 dailySpent,
        bytes32 t3nDid
    ) {
        AgentPolicy storage p = _policies[agent];
        return (p.active, p.spendingCapWei, p.dailyLimitWei, p.dailySpentWei, p.t3nDid);
    }

    function isSelectorAllowed(address agent, bytes4 selector) external view returns (bool) {
        return _policies[agent].selectorWhitelist[selector];
    }

    // ── Internal ───────────────────────────────────────────────────────────

    function _enforcePolicyAndSpend(address agent, bytes calldata data, uint256 value) internal {
        AgentPolicy storage p = _policies[agent];

        // Per-action spending cap
        require(value <= p.spendingCapWei, "AgentWallet: exceeds spending cap");

        // Selector whitelist (only for contract calls, not plain ETH transfers)
        if (data.length >= 4) {
            bytes4 selector = bytes4(data[:4]);
            require(p.selectorWhitelist[selector], "AgentWallet: selector not whitelisted");
        }

        // Rolling daily limit
        if (block.timestamp >= p.dailyResetAt) {
            p.dailySpentWei = 0;
            p.dailyResetAt = block.timestamp + 1 days;
        }
        require(p.dailySpentWei + value <= p.dailyLimitWei, "AgentWallet: daily limit exceeded");
        p.dailySpentWei += value;
    }

    receive() external payable {}
}
