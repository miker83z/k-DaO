// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

//import "./others/NonSafeTokenTimelockUpgradeable.sol";
import "../node_modules/@openzeppelin/contracts-upgradeable/token/ERC20/utils/TokenTimelockUpgradeable.sol";

contract SimpleTimelockUpgradeable is TokenTimelockUpgradeable {
    function initialize(
        address token_,
        address beneficiary_,
        uint256 releaseTime_
    ) public initializer {
        __TokenTimelock_init(
            IERC20Upgradeable(token_),
            beneficiary_,
            releaseTime_
        );
    }

    function balanceLocked() public view returns (uint256) {
        return token().balanceOf(address(this));
    }
}
