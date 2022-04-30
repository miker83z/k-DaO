// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./NonSafeSimpleTimelockUpgradeable.sol";
import "../../node_modules/@openzeppelin/contracts/proxy/Clones.sol";

/**
 * @dev A token timelock proxy to create ERC20 token timelock contracts
 * for several addresses.
 *
 */
contract NonSafeTokenTimelockProxy {
    // Token to lock on chain contract
    address immutable _tokenToLock;

    // Token Timelock on chain contract
    address immutable _implementation;

    // List of cloned Timelock contracts
    address[] public _clonedContracts;

    // List of cloned Timelock contracts per address
    mapping(address => uint256[]) public _clonedContractsPerUser;

    /**
     * Event for a proposal added
     */
    event TokensLocked(uint256 amount);

    constructor(address token_, address implementation_) {
        _implementation = implementation_;
        _tokenToLock = token_;
    }

    /**
     * @dev Creates a new Timelock contract
     * @return the contract address
     */
    function lockTokens(
        address beneficiary_,
        uint256 amountToLock_,
        uint256 releaseTime_
    ) public returns (address) {
        require(
            IERC20Upgradeable(_tokenToLock).allowance(
                msg.sender,
                address(this)
            ) >= amountToLock_,
            "Insufficient Balance"
        );

        address clone = Clones.clone(_implementation);
        NonSafeSimpleTimelockUpgradeable(clone).initialize(
            _tokenToLock,
            beneficiary_,
            releaseTime_
        );

        IERC20Upgradeable(_tokenToLock).transferFrom(
            msg.sender,
            clone,
            amountToLock_
        );

        _clonedContracts.push(clone);
        _clonedContractsPerUser[msg.sender].push(_clonedContracts.length - 1);

        return clone;
    }

    function checkLocker(address locker)
        public
        view
        returns (address[] memory)
    {
        uint256[] storage clonedIds = _clonedContractsPerUser[locker];
        address[] memory lockerClonesAddresses =
            new address[](clonedIds.length);

        for (uint256 i = 0; i < clonedIds.length; i++) {
            lockerClonesAddresses[i] = (_clonedContracts[clonedIds[i]]);
        }

        return lockerClonesAddresses;
    }

    function checkLockerReleaseTimesAndBalances(address locker)
        public
        view
        returns (uint256[] memory, uint256[] memory)
    {
        address[] memory lockerClonesAddresses = checkLocker(locker);
        uint256[] memory releaseTimes =
            new uint256[](lockerClonesAddresses.length);
        uint256[] memory balances = new uint256[](lockerClonesAddresses.length);

        for (uint256 i = 0; i < lockerClonesAddresses.length; i++) {
            releaseTimes[i] = NonSafeSimpleTimelockUpgradeable(
                lockerClonesAddresses[i]
            )
                .releaseTime();
            balances[i] = NonSafeSimpleTimelockUpgradeable(
                lockerClonesAddresses[i]
            )
                .balanceLocked();
        }

        return (releaseTimes, balances);
    }
}
