// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// 1. Re-declare ModeCode locally to avoid deep imports
type ModeCode is bytes32;

// 2. Define the exact interface the DelegationManager expects
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

// 3. Implement the interface
contract YieldCaveatEnforcer is ICaveatEnforcer {
    // Official Base Mainnet Addresses
    address public constant AAVE_V3_POOL =
        0xA238Dd80C259a72e81d7e4664a9801593F98d1c5;
    address public constant LIFI_DIAMOND =
        0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE;

    function beforeHook(
        bytes calldata /* _terms */,
        bytes calldata /* _args */,
        ModeCode /* _mode */,
        bytes calldata _executionCalldata,
        bytes32 /* _delegationHash */,
        address /* _delegator */,
        address /* _redeemer */
    ) public pure override {
        // Decode the execution calldata to get the target contract
        (address target, , ) = abi.decode(
            _executionCalldata,
            (address, uint256, bytes)
        );

        // SECURITY GATE: Revert if the agent tries to send funds to any other address
        require(
            target == AAVE_V3_POOL || target == LIFI_DIAMOND,
            "BRAHMA GUARD: Unauthorized contract execution."
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
        // No post-execution checks required for this caveat
    }
}
