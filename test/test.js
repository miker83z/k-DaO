const HypercubeDAOToken = artifacts.require('HypercubeDAOToken');
const NonSafeSimpleTimelockUpgradeable = artifacts.require(
  'NonSafeSimpleTimelockUpgradeable'
);
const NonSafeTokenTimelockProxy = artifacts.require(
  'NonSafeTokenTimelockProxy'
);
const NonSafeVoting = artifacts.require('NonSafeVoting');

contract('Voting', (accounts) => {
  const owner = accounts[0];
  const alice = accounts[1];
  const bob = accounts[2];
  const millisToWait = 1500;
  const debatingPeriodMul = 2;

  it('should transfer 100 tokens to alice and bob', async () => {
    const token = await HypercubeDAOToken.deployed();
    const amount = new web3.utils.BN(100);

    const resAlice = await token.transfer(alice, amount, {
      from: owner,
    });
    console.log('ERC20 transfer(): ', resAlice.receipt.gasUsed);
    const resBob = await token.transfer(bob, amount, {
      from: owner,
    });
    const balanceAlice = await token.balanceOf(alice);
    const balanceBob = await token.balanceOf(bob);
    assert.equal(balanceAlice, '100', 'Token was not correctly transferred');
    assert.equal(balanceBob, '100', 'Token was not correctly transferred');
  });

  it('should lock 10 tokens each for alice and bob', async () => {
    const token = await HypercubeDAOToken.deployed(); //'0xebe3b325fe17f8d277809b73d78ecb19049d189a'
    const proxy = await NonSafeTokenTimelockProxy.deployed(); //'0xc23df5821A98020Ccc2e0034052E2bbCea7D0383'
    const amountToLock = new web3.utils.BN(10);
    const releaseDateNotBN = Math.floor((Date.now() + millisToWait) / 1000);
    const releaseDate = new web3.utils.BN(releaseDateNotBN);

    await token.approve(proxy.address, amountToLock, {
      from: alice,
    });
    const resAlice = await proxy.lockTokens(alice, amountToLock, releaseDate, {
      from: alice,
    });
    console.log('TokenTimelock lockTokens(): ', resAlice.receipt.gasUsed); //501818 contract creation

    await token.approve(proxy.address, amountToLock, {
      from: bob,
    });
    const resBob = await proxy.lockTokens(bob, amountToLock, releaseDate, {
      from: bob,
    });

    const lockAlice = await proxy.checkLockerReleaseTimesAndBalances(alice);
    assert.equal(
      lockAlice[0],
      releaseDateNotBN,
      'Release date was not correctly set'
    );
    assert.equal(lockAlice[1], '10', 'Token was not correctly locked');

    const lockBob = await proxy.checkLockerReleaseTimesAndBalances(bob);
    assert.equal(
      lockBob[0],
      releaseDateNotBN,
      'Release date was not correctly set'
    );
    assert.equal(lockBob[1], '10', 'Token was not correctly locked');
  });

  it('should release 10 tokens each for alice and bob', async () => {
    const token = await HypercubeDAOToken.deployed(); //'0xebe3b325fe17f8d277809b73d78ecb19049d189a'
    const proxy = await NonSafeTokenTimelockProxy.deployed(); //'0xc23df5821A98020Ccc2e0034052E2bbCea7D0383'
    const amountLocked = new web3.utils.BN(10);

    const lockAlice = await proxy.checkLocker(alice);
    const lockContractAlice = await NonSafeSimpleTimelockUpgradeable.at(
      lockAlice[0]
    );

    const lockBob = await proxy.checkLocker(bob);
    const lockContractBob = await NonSafeSimpleTimelockUpgradeable.at(
      lockBob[0]
    );

    await new Promise((res) => setTimeout(res, millisToWait));

    const resAlice = await lockContractAlice.release({
      from: alice,
    });
    const balanceAlice = await token.balanceOf(alice);
    assert.equal(balanceAlice, '100', 'Token was not correctly transferred');
    console.log('TokenTimelock release(): ', resAlice.receipt.gasUsed);

    await lockContractBob.release({
      from: bob,
    });
    const balanceBob = await token.balanceOf(bob);
    assert.equal(balanceBob, '100', 'Token was not correctly transferred');
  });

  it('should set a new proposal', async () => {
    const vot = await NonSafeVoting.deployed();
    const token = await HypercubeDAOToken.deployed();
    const proxy = await NonSafeTokenTimelockProxy.deployed();
    const amountToLock = new web3.utils.BN(10);
    const releaseDateNotBN = Math.floor(
      (Date.now() + millisToWait * 100) / 1000
    );
    const releaseDate = new web3.utils.BN(releaseDateNotBN);
    await token.approve(proxy.address, amountToLock, {
      from: alice,
    });
    await proxy.lockTokens(alice, amountToLock, releaseDate, {
      from: alice,
    });
    await token.approve(proxy.address, amountToLock, {
      from: bob,
    });
    await proxy.lockTokens(bob, amountToLock, releaseDate, {
      from: bob,
    });

    const debatingPeriodNotBN = Math.floor(
      (millisToWait * debatingPeriodMul) / 1000
    );
    const debatingPeriod = new web3.utils.BN(debatingPeriodNotBN);
    const resAlice = await vot.submitProposal('Vote Me!', debatingPeriod, 10, {
      from: alice,
    });
    console.log('Voting submitProposal(): ', resAlice.receipt.gasUsed);
    console.log(await vot.getProposalSMetadata(0));
  });

  it('should add two suggestions', async () => {
    const vot = await NonSafeVoting.deployed();
    const resAlice = await vot.submitSuggestion(0, 'Suggestion 1', {
      from: alice,
    });
    console.log('Voting submitSuggestion(): ', resAlice.receipt.gasUsed);
    await vot.submitSuggestion(0, 'Suggestion 2', { from: bob });
    const num = await vot.numberOfProposalSuggestions(0);
    assert.equal(num, '2', 'Submissions wwere not correctly set');
    console.log(await vot.getProposalSuggestionMetadata(0, 0));
    console.log(await vot.getProposalSuggestionMetadata(0, 1));
  });

  it('should vote', async () => {
    const vot = await NonSafeVoting.deployed();
    const resAlice = await vot.vote(0, 0, { from: alice });
    console.log('Voting vote(): ', resAlice.receipt.gasUsed);
    const voteAlice = await vot.hasVotedFor(alice, 0, 0);
    assert.equal(voteAlice, true, 'Vote was not correct');
    await vot.vote(0, 1, { from: bob });
    const voteBob = await vot.hasVotedFor(bob, 0, 1);
    assert.equal(voteBob, true, 'Vote was not correct');
  });

  it('should change vote', async () => {
    const vot = await NonSafeVoting.deployed();
    await vot.changeVote(0, 0, { from: bob });
    const bal1 = await vot.hasVotedFor(bob, 0, 0);
    const bal2 = await vot.hasVotedFor(bob, 0, 1);
    assert.equal(bal1, true, 'Vote change was not correct');
    assert.equal(bal2, false, 'Vote change was not correct');
  });

  it('should execute', async () => {
    const vot = await NonSafeVoting.deployed();
    await new Promise((res) =>
      setTimeout(res, millisToWait * debatingPeriodMul)
    );
    const resAlice = await vot.executeProposal(0, { from: owner });
    console.log('Voting executeProposal(): ', resAlice.receipt.gasUsed);
    const bal = await vot.isExecuted(0);
    const bal2 = await vot.getProposalFinalResult(0);
    assert.equal(bal, true, 'Execute was not correct');
    assert.equal(bal2.toString(), 0, 'Vote was not correct');
  });
});
