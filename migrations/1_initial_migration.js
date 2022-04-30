const HypercubeDAOToken = artifacts.require('HypercubeDAOToken');
const NonSafeSimpleTimelockUpgradeable = artifacts.require(
  'NonSafeSimpleTimelockUpgradeable'
);
const NonSafeTokenTimelockProxy = artifacts.require(
  'NonSafeTokenTimelockProxy'
);
const NonSafeVoting = artifacts.require('NonSafeVoting');

module.exports = async (deployer) => {
  // Migrations
  // await deployer.deploy(Migrations);
  const totalSupply = new web3.utils.BN(10000);
  const minimumQuorumForProposals = new web3.utils.BN(1);
  const minTimeForDebate = new web3.utils.BN(1);
  const minDifferenceLockPeriod_ = new web3.utils.BN(1);

  // ERC20 Token
  await deployer.deploy(HypercubeDAOToken, 'Token', 'TOK', totalSupply);
  const daoToken = await HypercubeDAOToken.deployed();

  //Timelock implementation
  await deployer.deploy(NonSafeSimpleTimelockUpgradeable);
  const timelockImplementation =
    await NonSafeSimpleTimelockUpgradeable.deployed();

  //Timelock proxy
  await deployer.deploy(
    NonSafeTokenTimelockProxy,
    daoToken.address,
    timelockImplementation.address
  );
  const timelockProxy = await NonSafeTokenTimelockProxy.deployed();

  //Voting
  await deployer.deploy(
    NonSafeVoting,
    timelockProxy.address,
    minimumQuorumForProposals,
    minTimeForDebate,
    minDifferenceLockPeriod_
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
  await deployer.deploy(HypercubeDAOToken, 'Token', 'TOK', totalSupply);
  const daoToken = await HypercubeDAOToken.deployed();

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

  //Voting
  deployer.deploy(
    Voting,
    timelockProxy.address,
    minimumQuorumForProposals,
    minTimeForDebate,
    minDifferenceLockPeriod_
  );
};*/
