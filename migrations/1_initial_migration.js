const kDaOToken = artifacts.require('kDaOToken');
const SimpleTimelockUpgradeable = artifacts.require(
  'SimpleTimelockUpgradeable'
);
const TokenTimelockProxy = artifacts.require('TokenTimelockProxy');
const kDaO = artifacts.require('kDaO');
const DataOwnerContract = artifacts.require('DataOwnerContract');
const AggregatorContract = artifacts.require('AggregatorContract');

module.exports = async (deployer) => {
  // Migrations
  // await deployer.deploy(Migrations);
  const totalSupply = new web3.utils.BN(10000);

  // ERC20 Token
  await deployer.deploy(kDaOToken, 'kDaOToken', 'kDaO', totalSupply);
  const daoToken = await kDaOToken.deployed();

  //Timelock implementation
  await deployer.deploy(SimpleTimelockUpgradeable);
  const timelockImplementation = await SimpleTimelockUpgradeable.deployed();

  //Timelock proxy
  await deployer.deploy(
    TokenTimelockProxy,
    daoToken.address,
    timelockImplementation.address
  );
  const timelockProxy = await TokenTimelockProxy.deployed();

  //kDaO
  await deployer.deploy(kDaO);
  const kDaOImplementation = await kDaO.deployed();

  //DataOwnerContract
  await deployer.deploy(DataOwnerContract);

  //AggregatorContract
  await deployer.deploy(
    AggregatorContract,
    daoToken.address,
    kDaOImplementation.address,
    timelockProxy.address
  );
};

/*
module.exports = async (deployer) => {
  // Migrations
  // await deployer.deploy(Migrations);
  const totalSupply = new web3.utils.BN(10000);
  const minimumQuorumForProposals = new web3.utils.BN(1);
  const minTimeForDebate = new web3.utils.BN(1);
  const minDifferenceLockPeriod_ = new web3.utils.BN(1);

  // ERC20 Token
  await deployer.deploy(kDaOToken, 'Token', 'TOK', totalSupply);
  const daoToken = await kDaOToken.deployed();

  //Timelock implementation
  await deployer.deploy(SimpleTimelockUpgradeable);
  const timelockImplementation = await SimpleTimelockUpgradeable.deployed();

  //Timelock proxy
  await deployer.deploy(
    TokenTimelockProxy,
    daoToken.address, //'0xebe3b325fe17f8d277809b73d78ecb19049d189a',
    timelockImplementation.address //'0x909De440E5121f5F7eCfBd000eb0b9F41C66C4fd'
  );
  const timelockProxy = await TokenTimelockProxy.deployed();

  //kDaO
  deployer.deploy(
    kDaO,
    timelockProxy.address,
    minimumQuorumForProposals,
    minTimeForDebate,
    minDifferenceLockPeriod_
  );
};*/
