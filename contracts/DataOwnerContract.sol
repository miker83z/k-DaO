// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @dev Enables a Data Owner to maintaing an Access Control List for
 * managing access to the data
 */
contract DataOwnerContract is Ownable {
    // Access Control List structure
    struct ACL {
        bool created;
        mapping(address => bool) allowed;
    }

    // Request structure
    struct Request {
        bytes dataId;
        address[] users;
        bytes request;
    }

    // Access Control List
    mapping(bytes => ACL) _data;

    // Requests for granting access
    mapping(uint256 => Request) public _requests;

    // Number of Requests
    uint256 public _numRequests;

    /**
     * Event for an access granted
     */
    event AccessGranted(uint256 amount);

    /**
     * Event for a new request made
     */
    event NewRequest(
        uint256 requestId,
        bytes dataId,
        address[] users,
        bytes request
    );

    /**
     * @dev Creates a request to grant access to id_ to users_
     * with a reason request_
     */
    function requestAccess(
        bytes memory id_,
        address[] memory users_,
        bytes memory request_
    ) public returns (uint256 requestId) {
        requestId = _numRequests++;
        Request storage r = _requests[requestId];
        r.dataId = id_;
        r.users = users_;
        r.request = request_;

        emit NewRequest(requestId, id_, users_, request_);
    }

    /**
     * @dev Grants access to r.dataId to r.users where r is a
     * request with id requestId_
     */
    function grantAccessRequest(uint256 requestId_) public onlyOwner {
        Request storage r = _requests[requestId_];
        _grantAccess(r.dataId, r.users);
    }

    /**
     * @dev Grants access to id_ to users_
     */
    function grantAccess(bytes memory id_, address[] memory users_)
        public
        onlyOwner
    {
        _grantAccess(id_, users_);
    }

    /**
     * @dev Revokes access to id_ to users_
     */
    function revokeAccess(bytes memory id_, address[] memory users_)
        public
        onlyOwner
    {
        require(
            _data[id_].created == true,
            "DataOwnerContract: data id not correct"
        );

        for (uint256 i = 0; i < users_.length; i++) {
            _data[id_].allowed[users_[i]] = false;
        }
    }

    /**
     * @dev Internal function to grant access to id_ to users_
     */
    function _grantAccess(bytes memory id_, address[] memory users_) internal {
        if (_data[id_].created == false) _data[id_].created = true;

        for (uint256 i = 0; i < users_.length; i++) {
            _data[id_].allowed[users_[i]] = true;
        }
    }

    /**
     * @dev Check if user_ is allowed to access id_
     */
    function checkPermissions(address user_, bytes memory id_)
        public
        view
        returns (bool)
    {
        if (_data[id_].allowed[user_] == true || user_ == owner()) return true;
        return false;
    }
}
