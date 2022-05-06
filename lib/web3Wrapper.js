const Web3 = require('web3');

const kDaOToken = require('../build/contracts/kDaOToken.json');
const SimpleTimelockUpgradeable = require('../build/contracts/SimpleTimelockUpgradeable.json');
const TokenTimelockProxy = require('../build/contracts/TokenTimelockProxy.json');
const kDaO = require('../build/contracts/kDaO.json');
const DataOwnerContract = require('../build/contracts/DataOwnerContract.json');
const AggregatorContract = require('../build/contracts/AggregatorContract.json');

class Web3Wrapper {
  constructor(provider) {
    if (provider === undefined) {
      throw new Error('Web3Wrapper: provider not set');
    }
    this.web3 = new Web3(provider);
  }

  async deploy(artifact, from, argus) {
    return await new this.web3.eth.Contract(artifact.abi)
      .deploy({ data: artifact.bytecode, arguments: argus })
      .send({ from });
  }

  async deployDataOwnerContract(from) {
    return new DataOwnerContractWrapper(
      await new this.web3.eth.Contract(DataOwnerContract.abi)
        .deploy({ data: DataOwnerContract.bytecode })
        .send({ from }),
      from
    );
  }
}

class DataOwnerContractWrapper {
  constructor(contract, owner) {
    if (contract === undefined || owner === undefined) {
      throw new Error('Web3Wrapper: contract not set');
    }
    this.doc = contract;
    this.from = owner;
    this.address = contract.options.address;
  }

  requestAccess(accounts, dataId, reasons, from) {
    return this.doc.methods
      .requestAccess(dataId, accounts, reasons)
      .send({ from });
  }

  grantAccessRequest(reqId) {
    return this.doc.methods.grantAccessRequest(reqId).send({ from: this.from });
  }

  grantAccess(accounts, dataId) {
    return this.doc.methods
      .grantAccess(dataId, accounts)
      .send({ from: this.from });
  }

  revokeAccess(accounts, dataId) {
    return this.doc.methods
      .revokeAccess(dataId, accounts)
      .send({ from: this.from });
  }

  checkPermissions(account, dataId) {
    return this.doc.methods.checkPermissions(account, dataId).call();
  }
}

module.exports = {
  Web3Wrapper,
  DataOwnerContractWrapper,
  artifact: {
    kDaOToken,
    SimpleTimelockUpgradeable,
    TokenTimelockProxy,
    kDaO,
    DataOwnerContract,
    AggregatorContract,
  },
};
