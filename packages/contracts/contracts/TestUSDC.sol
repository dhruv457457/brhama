// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title TestUSDC
 * @notice Mintable ERC-20 for Sepolia testing. Anyone can mint.
 */
contract TestUSDC is ERC20 {
    constructor() ERC20("Test USDC", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Anyone can mint — this is a testnet token.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
