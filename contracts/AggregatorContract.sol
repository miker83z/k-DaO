// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./DataOwnerContract.sol";
import "./kDaO.sol";

/**
 * @dev Enables an Aggregator to request access to data
 */
contract AggregatorContract is Ownable {
    // Access Control List structure
    struct Aggregation {
        bytes[] dataIds;
        address[] aclIds;
        address[] users;
        uint256[] requestIds;
        bytes request;
        uint256 releaseDate;
        uint256 callForDataDeadline;
        uint256 minimumQuorumForProposals;
        uint256 minDebatingPeriod;
        uint256 minDifferenceLockPeriod;
        uint256 amountToStake;
        uint256 m;
    }

    // kDaO on chain contract
    address immutable _implementation;

    // Token used by the DAO
    address public _erc20token;

    // The contract used for timelocks
    address public _tokenTimelocks;

    // Aggregations of data performed (or to perform)
    mapping(uint256 => Aggregation) public _aggregations;

    // Number of Aggregations
    uint256 public _numAggregations;

    // List of kDaO cloned contracts
    address[] public _kDaOContracts;

    /**
     * Event for a new request made
     */
    event NewAggregation(
        uint256 aggregationId,
        address[] aclIds,
        uint256[] requestIds,
        bytes request
    );

    /**
     * Event for a new kDaO creation
     */
    event NewkDaO(uint256 aggregationId, uint256 kDaOId, address kDaOAddress);

    constructor(
        address token_,
        address implementation_,
        address tokenTimelocks_
    ) {
        _implementation = implementation_;
        _erc20token = token_;
        _tokenTimelocks = tokenTimelocks_;
    }

    /**
     * @dev Creates a request to grant access to id_ to users_
     * with a reason request_
     */
    function requestAccessToData(
        bytes[] memory dataIds_,
        address[] memory aclIds_,
        address[] memory users_,
        bytes memory request_,
        uint256[] memory parameters_
    ) public onlyOwner returns (uint256 aggregationId) {
        require(
            dataIds_.length == aclIds_.length,
            "AggregatorContract: input data length mismatch"
        );

        aggregationId = _numAggregations++;
        Aggregation storage a = _aggregations[aggregationId];
        a.dataIds = dataIds_;
        a.aclIds = aclIds_;
        a.users = users_;
        a.request = request_;
        /*uint256 releaseDatePeriod_,
        uint256 callForDataPeriod_,
        uint256 minimumQuorumForProposals_,
        uint256 minDebatingPeriod_,
        uint256 minDifferenceLockPeriod_,
        uint256 amountToStake_,
        uint256 m_*/
        a.releaseDate = block.timestamp + parameters_[0];
        a.callForDataDeadline = block.timestamp + parameters_[1];
        a.minimumQuorumForProposals = parameters_[2];
        a.minDebatingPeriod = parameters_[3];
        a.minDifferenceLockPeriod = parameters_[4];
        a.amountToStake = parameters_[5];
        a.m = parameters_[6];

        for (uint256 i = 0; i < aclIds_.length; i++) {
            a.requestIds.push(
                DataOwnerContract(aclIds_[i]).requestAccess(
                    dataIds_[i],
                    users_,
                    request_
                )
            );
        }

        emit NewAggregation(aggregationId, aclIds_, a.requestIds, request_);
    }

    /**
     * @dev Creates a new kDaO contract
     * @return the contract address
     */
    function createkDaO(uint256 aggregationId_)
        public
        onlyOwner
        returns (address)
    {
        Aggregation storage a = _aggregations[aggregationId_];
        require(block.timestamp >= a.callForDataDeadline);
        require(
            IERC20Upgradeable(_erc20token).allowance(owner(), address(this)) >=
                a.amountToStake,
            "Insufficient Balance"
        );
        address[] memory members = getKMembers(aggregationId_);
        require(members.length > a.m);

        address clone = Clones.clone(_implementation);
        kDaO(clone).initialize(
            _erc20token,
            members,
            owner(),
            a.releaseDate,
            _tokenTimelocks,
            a.minimumQuorumForProposals,
            a.minDebatingPeriod,
            a.minDifferenceLockPeriod
        );

        IERC20Upgradeable(_erc20token).transferFrom(
            owner(),
            clone,
            a.amountToStake
        );

        _kDaOContracts.push(clone);

        emit NewkDaO(aggregationId_, _kDaOContracts.length - 1, clone);

        return clone;
    }

    /**
     * @dev Check if k data owners allowed the aggregation aggregationId_
     */
    function checkKgtM(uint256 aggregationId_) public view returns (bool) {
        Aggregation storage a = _aggregations[aggregationId_];

        uint256 k = 0;
        for (uint256 i = 0; i < a.aclIds.length; i++) {
            bool temp = true;
            for (uint256 j = 0; j < a.users.length; j++) {
                temp =
                    temp &&
                    DataOwnerContract(a.aclIds[i]).checkPermissions(
                        a.users[j],
                        a.dataIds[i]
                    );
            }
            if (temp) k++;
        }
        if (k >= a.m) return true;
        return false;
    }

    /**
     * @dev Get the k data owners that allowed the aggregation aggregationId_
     */
    function getKMembers(uint256 aggregationId_)
        public
        view
        returns (address[] memory kMembers)
    {
        Aggregation storage a = _aggregations[aggregationId_];

        address[] memory tmpKMembers = new address[](a.aclIds.length);
        uint256 k = 0;
        for (uint256 i = 0; i < a.aclIds.length; i++) {
            bool temp = true;
            for (uint256 j = 0; j < a.users.length; j++) {
                temp =
                    temp &&
                    DataOwnerContract(a.aclIds[i]).checkPermissions(
                        a.users[j],
                        a.dataIds[i]
                    );
            }
            if (temp) tmpKMembers[k++] = DataOwnerContract(a.aclIds[i]).owner();
        }
        kMembers = new address[](k);
        for (uint256 i = 0; i < k; i++) {
            kMembers[i] = tmpKMembers[i];
        }
    }
}
