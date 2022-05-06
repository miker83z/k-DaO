const kDaOToken = artifacts.require('kDaOToken');
const SimpleTimelockUpgradeable = artifacts.require(
  'SimpleTimelockUpgradeable'
);
const TokenTimelockProxy = artifacts.require('TokenTimelockProxy');
const kDaO = artifacts.require('kDaO');
const DataOwnerContract = artifacts.require('DataOwnerContract');
const AggregatorContract = artifacts.require('AggregatorContract');

contract('AggregatorContract', (accounts) => {
  const owner = accounts[0];
  const alice = accounts[1];
  const bob = accounts[2];
  const amountToStake = 10;
  let kDaOAddress = '0x0';
  const millisToWait = 9000;
  const debatingPeriodMul = 2;

  it('should transfer 100 tokens to alice and bob', async () => {
    const token = await kDaOToken.deployed();
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
    const token = await kDaOToken.deployed(); //'0xebe3b325fe17f8d277809b73d78ecb19049d189a'
    const proxy = await TokenTimelockProxy.deployed(); //'0xc23df5821A98020Ccc2e0034052E2bbCea7D0383'
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
    const token = await kDaOToken.deployed(); //'0xebe3b325fe17f8d277809b73d78ecb19049d189a'
    const proxy = await TokenTimelockProxy.deployed(); //'0xc23df5821A98020Ccc2e0034052E2bbCea7D0383'
    const amountLocked = new web3.utils.BN(10);

    const lockAlice = await proxy.checkLocker(alice);
    const lockContractAlice = await SimpleTimelockUpgradeable.at(lockAlice[0]);

    const lockBob = await proxy.checkLocker(bob);
    const lockContractBob = await SimpleTimelockUpgradeable.at(lockBob[0]);

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

  it('should grant access to alice and bob', async () => {
    const doc = await DataOwnerContract.deployed();
    const dataId = web3.utils.utf8ToHex('dataId1');

    const res = await doc.grantAccess(dataId, [alice, bob], {
      from: owner,
    });
    console.log('DOC grantAccess(): ', res.receipt.gasUsed);

    const accessAlice = await doc.checkPermissions(alice, dataId);
    const accessBob = await doc.checkPermissions(bob, dataId);
    assert.equal(accessAlice, true, 'Access was not correctly granted');
    assert.equal(accessBob, true, 'Access was not correctly granted');
  });

  it('should grant access to alice after a request', async () => {
    const doc = await DataOwnerContract.deployed();
    const dataId = web3.utils.utf8ToHex('dataId2');

    const res = await doc.requestAccess(
      dataId,
      [alice],
      web3.utils.utf8ToHex('some reasons'),
      {
        from: alice,
      }
    );
    console.log('DOC requestAccess(): ', res.receipt.gasUsed);
    const reqId = res.logs[0].args.requestId;

    const res2 = await doc.grantAccessRequest(reqId, {
      from: owner,
    });
    console.log('DOC grantAccessRequest(): ', res2.receipt.gasUsed);

    const accessAlice = await doc.checkPermissions(alice, dataId);
    assert.equal(accessAlice, true, 'Access was not correctly granted');
  });

  it('should revoke access to alice', async () => {
    const doc = await DataOwnerContract.deployed();
    const dataId = web3.utils.utf8ToHex('dataId2');

    const res2 = await doc.revokeAccess(dataId, [alice], {
      from: owner,
    });
    console.log('DOC revokeAccess(): ', res2.receipt.gasUsed);

    const accessAlice = await doc.checkPermissions(alice, dataId);
    assert.equal(accessAlice, false, 'Access was not correctly revoked');
  });

  it('should revoke access to alice', async () => {
    const doc = await DataOwnerContract.deployed();
    const dataId = web3.utils.utf8ToHex('dataId2');

    const res2 = await doc.revokeAccess(dataId, [alice], {
      from: owner,
    });
    console.log('DOC revokeAccess(): ', res2.receipt.gasUsed);

    const accessAlice = await doc.checkPermissions(alice, dataId);
    assert.equal(accessAlice, false, 'Access was not correctly revoked');
  });

  it('aggregator should request access to alice and bob', async () => {
    const agg = await AggregatorContract.deployed();
    const docAlice = await DataOwnerContract.new({ from: alice });
    const docBob = await DataOwnerContract.new({ from: bob });
    const dataIdAlice = web3.utils.utf8ToHex('dataIdAlice');
    const dataIdBob = web3.utils.utf8ToHex('dataIdBob');
    const reasons = web3.utils.utf8ToHex('some reasons');

    const releaseDatePeriod = Math.floor(
      (millisToWait * debatingPeriodMul * debatingPeriodMul) / 1000
    );
    const callForDataPeriod = 1;
    const minimumQuorumForProposals = 1;
    const minDebatingPeriod = 1;
    const minDifferenceLockPeriod = 1;
    const m = 1;

    const parameters = [
      releaseDatePeriod,
      callForDataPeriod,
      minimumQuorumForProposals,
      minDebatingPeriod,
      minDifferenceLockPeriod,
      amountToStake,
      m,
    ];

    const res = await agg.requestAccessToData(
      [dataIdAlice, dataIdBob],
      [docAlice.address, docBob.address],
      [owner],
      reasons,
      parameters,
      {
        from: owner,
      }
    );
    console.log('AGG requestAccessToData(): ', res.receipt.gasUsed);

    const reqIdAlice = res.logs[0].args.requestIds[0];
    const reqIdBob = res.logs[0].args.requestIds[1];
    const aggId = res.logs[0].args.aggregationId;

    const res2 = await docAlice.grantAccessRequest(reqIdAlice, {
      from: alice,
    });
    const res3 = await docBob.grantAccessRequest(reqIdBob, {
      from: bob,
    });

    const accessAlice = await docAlice.checkPermissions(owner, dataIdAlice);
    assert.equal(accessAlice, true, 'Access was not correctly granted');
    const accessBob = await docBob.checkPermissions(owner, dataIdBob);
    assert.equal(accessBob, true, 'Access was not correctly granted');
    const checkKgtM = await agg.checkKgtM(aggId);
    assert.equal(checkKgtM, true, 'Access was not correctly granted');
  });

  it('should create a kDaO', async () => {
    const token = await kDaOToken.deployed();
    const agg = await AggregatorContract.deployed();
    const docAlice = await DataOwnerContract.new({ from: alice });
    const docBob = await DataOwnerContract.new({ from: bob });
    const dataIdAlice = web3.utils.utf8ToHex('dataIdAlice');
    const dataIdBob = web3.utils.utf8ToHex('dataIdBob');
    const reasons = web3.utils.utf8ToHex('some reasons');

    await token.approve(agg.address, amountToStake, {
      from: owner,
    });
    const res = await agg.createkDaO(0);
    console.log('AGG createkDaO(): ', res.receipt.gasUsed);
    kDaOAddress = res.logs[0].args.kDaOAddress;
  });

  it('should set a new proposal', async () => {
    const vot = await kDaO.at(kDaOAddress);
    const token = await kDaOToken.deployed();
    const proxy = await TokenTimelockProxy.deployed();
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
    const resAlice = await vot.submitRefundProposal(
      'Refund the people!',
      debatingPeriod,
      2,
      {
        from: alice,
      }
    );
    console.log('kDaO submitRefundProposal(): ', resAlice.receipt.gasUsed);
  });

  it('should vote', async () => {
    const vot = await kDaO.at(kDaOAddress);
    const resAlice = await vot.vote(0, 0, { from: alice });
    console.log('kDaO vote(): ', resAlice.receipt.gasUsed);
    const voteAlice = await vot.hasVotedFor(alice, 0, 0);
    assert.equal(voteAlice, true, 'Vote was not correct');
    await vot.vote(0, 1, { from: bob });
    const voteBob = await vot.hasVotedFor(bob, 0, 1);
    assert.equal(voteBob, true, 'Vote was not correct');
  });

  it('should change vote', async () => {
    const vot = await kDaO.at(kDaOAddress);
    const res = await vot.changeVote(0, 0, { from: bob });
    console.log('kDaO changeVote(): ', res.receipt.gasUsed);
    const bal1 = await vot.hasVotedFor(bob, 0, 0);
    const bal2 = await vot.hasVotedFor(bob, 0, 1);
    assert.equal(bal1, true, 'Vote change was not correct');
    assert.equal(bal2, false, 'Vote change was not correct');
  });

  it('should execute', async () => {
    const token = await kDaOToken.deployed();
    const vot = await kDaO.at(kDaOAddress);
    const balanceAliceInit = await token.balanceOf(alice);
    const balanceBobInit = await token.balanceOf(bob);
    await new Promise((res) =>
      setTimeout(res, millisToWait * debatingPeriodMul)
    );
    const res = await vot.executeRefundProposal(0, { from: owner });
    console.log('kDaO executeRefundProposal(): ', res.receipt.gasUsed);
    const bal = await vot.isExecuted(0);
    const bal2 = await vot.getProposalFinalResult(0);
    assert.equal(bal, true, 'Execute was not correct');
    assert.equal(bal2.toString(), 0, 'Vote was not correct');
    const balanceAlice = await token.balanceOf(alice);
    const balanceBob = await token.balanceOf(bob);
    assert.equal(
      balanceAlice - balanceAliceInit,
      '5',
      'Token was not correctly transferred'
    );
    assert.equal(
      balanceBob - balanceAliceInit,
      '5',
      'Token was not correctly transferred'
    );
  });
});
