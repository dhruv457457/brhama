// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// ─────────────────────────────────────────────────────────────────────────────
// YieldCaveatEnforcer
//
// A novel ERC-7715 caveat enforcer for an autonomous AI yield agent.
// Enforces that the delegated agent MAY ONLY:
//
//   1. Call approve(address,uint256) on the USDC contract
//      — and ONLY to approve the Aave V3 Pool as spender
//
//   2. Call supply(address,uint256,address,uint16) on the Aave V3 Pool
//      — and ONLY with USDC as the asset
//
// ANY other target, function, or token is rejected on-chain.
// The user never loses custody — funds flow directly to Aave, never to the agent.
//
// Deployed on: Base Mainnet, Polygon Mainnet
// ─────────────────────────────────────────────────────────────────────────────

type ModeCode is bytes32;

interface ICaveatEnforcer {
    function beforeHook(
        bytes calldata _terms,
        bytes calldata _args,
        ModeCode _mode,
        bytes calldata _executionCalldata,
        bytes32 _delegationHash,
        address _delegator,
        address _redeemer
    ) external;

    function afterHook(
        bytes calldata _terms,
        bytes calldata _args,
        ModeCode _mode,
        bytes calldata _executionCalldata,
        bytes32 _delegationHash,
        address _delegator,
        address _redeemer
    ) external;
}

contract YieldCaveatEnforcer is ICaveatEnforcer {
    // ── Function selectors ──────────────────────────────────────────────────
    // approve(address,uint256)
    bytes4 public constant APPROVE_SELECTOR = 0x095ea7b3;
    // supply(address,uint256,address,uint16)
    bytes4 public constant SUPPLY_SELECTOR = 0x617ba037;

    // ── Chain-specific config stored at deploy time ─────────────────────────
    address public immutable USDC;
    address public immutable AAVE_V3_POOL;

    // ── Events for transparency ─────────────────────────────────────────────
    event YieldActionAllowed(
        address indexed delegator,
        address indexed redeemer,
        address indexed target,
        bytes4 selector,
        uint256 amount
    );

    event YieldActionBlocked(
        address indexed delegator,
        address indexed redeemer,
        address indexed target,
        bytes4 selector
    );

    // ── Constructor: set chain-specific addresses at deploy time ────────────
    constructor(address _usdc, address _aaveV3Pool) {
        require(_usdc != address(0), "YieldCaveatEnforcer: zero USDC");
        require(_aaveV3Pool != address(0), "YieldCaveatEnforcer: zero Aave");
        USDC = _usdc;
        AAVE_V3_POOL = _aaveV3Pool;
    }

    // ── Core enforcement logic ───────────────────────────────────────────────
    function beforeHook(
        bytes calldata /* _terms */,
        bytes calldata /* _args */,
        ModeCode /* _mode */,
        bytes calldata _executionCalldata,
        bytes32 /* _delegationHash */,
        address _delegator,
        address _redeemer
    ) public override {
        // Decode execution: (target, value, callData)
        (address target,  /* value */, bytes memory callData) = abi.decode(
            _executionCalldata,
            (address, uint256, bytes)
        );

        // Must have at least a 4-byte selector
        require(
            callData.length >= 4,
            "YieldCaveatEnforcer: calldata too short"
        );

        // Extract the 4-byte function selector
        bytes4 selector;
        assembly {
            selector := mload(add(callData, 0x20))
        }

        // ── PATH 1: approve(address spender, uint256 amount) on USDC ────────
        // Agent is allowed to approve ONLY the Aave V3 Pool as spender.
        if (target == USDC && selector == APPROVE_SELECTOR) {
            require(
                callData.length >= 68,
                "YieldCaveatEnforcer: approve calldata too short"
            );

            // Decode spender from approve calldata (offset 4)
            address spender;
            assembly {
                spender := mload(add(callData, 0x24))
            }

            require(
                spender == AAVE_V3_POOL,
                "YieldCaveatEnforcer: approve spender must be Aave V3 Pool"
            );

            uint256 amount;
            assembly {
                amount := mload(add(callData, 0x44))
            }

            emit YieldActionAllowed(
                _delegator,
                _redeemer,
                target,
                selector,
                amount
            );
            return;
        }

        // ── PATH 2: supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) ──
        // Agent is allowed to supply ONLY USDC to Aave V3 Pool.
        if (target == AAVE_V3_POOL && selector == SUPPLY_SELECTOR) {
            require(
                callData.length >= 132,
                "YieldCaveatEnforcer: supply calldata too short"
            );

            // Decode asset from supply calldata (offset 4)
            address asset;
            assembly {
                asset := mload(add(callData, 0x24))
            }

            require(
                asset == USDC,
                "YieldCaveatEnforcer: supply asset must be USDC"
            );

            uint256 amount;
            assembly {
                amount := mload(add(callData, 0x44))
            }

            emit YieldActionAllowed(
                _delegator,
                _redeemer,
                target,
                selector,
                amount
            );
            return;
        }

        // ── BLOCKED: anything else ───────────────────────────────────────────
        emit YieldActionBlocked(_delegator, _redeemer, target, selector);

        revert(
            string(
                abi.encodePacked(
"YieldCaveatEnforcer: unauthorized only USDC.approve(AavePool) ",
                    "and AavePool.supply(USDC) are permitted"
                )
            )
        );
    }

    function afterHook(
        bytes calldata /* _terms */,
        bytes calldata /* _args */,
        ModeCode /* _mode */,
        bytes calldata /* _executionCalldata */,
        bytes32 /* _delegationHash */,
        address /* _delegator */,
        address /* _redeemer */
    ) public pure override {
        // No post-execution checks required
    }
}
