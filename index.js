const HDWalletProvider = require('@truffle/hdwallet-provider');
const { AuthService } = require('./lib/auth');
const { BrokerService } = require('./lib/broker');
const { Web3Wrapper, artifact } = require('./lib/web3Wrapper');

const MNEMONIC = process.env.MNEMONIC;

const test = async () => {
  const host = 'http://127.0.0.1';
  const port = 8022;
  const auth = new AuthService(host, port);

  const plaintext = 'Hello World!';

  const alice = (await auth.requestKeypair()).data;
  const signer = (await auth.requestSigner()).data;
  const bob = (await auth.requestKeypair()).data;

  const { ciphertext, capsule } = (
    await auth.encrypt({
      plaintext,
      pk: alice.pk,
    })
  ).data;

  const { kfrags } = (
    await auth.generateKfrags({
      sender: alice,
      signer,
      receiver: bob.pk,
      threshold: 2,
      nodes_number: 3,
    })
  ).data;

  const { cfrag: cfrag1 } = (
    await auth.reencrypt({
      sender: alice.pk,
      signer: signer.pk,
      receiver: bob.pk,
      capsule,
      kfrag: kfrags[0],
    })
  ).data;
  const cfrags = [cfrag1];

  const { cfrag: cfrag2 } = (
    await auth.reencrypt({
      sender: alice.pk,
      signer: signer.pk,
      receiver: bob.pk,
      capsule,
      kfrag: kfrags[1],
    })
  ).data;
  cfrags.push(cfrag2);

  const { plaintext: dPlaintext } = (
    await auth.decrypt({
      sender: alice.pk,
      signer: signer.pk,
      receiver: bob,
      capsule,
      ciphertext,
      cfrags,
    })
  ).data;

  console.log(dPlaintext);
};

const testSignature = async () => {
  const host = 'http://127.0.0.1';
  const port = 8022;
  const auth = new AuthService(host, port);

  const data = 'Hello World 2';
  const signer = (await auth.requestSigner()).data;

  const { signature } = (
    await auth.sign({
      signer,
      data,
    })
  ).data;

  const { verified } = (
    await auth.verify({
      signature,
      data,
      pk: signer.pk,
    })
  ).data;

  console.log('Signature verified: ' + verified);
};

const testContracts = async () => {
  const provider = new HDWalletProvider(MNEMONIC, 'http://127.0.0.1:8545');
  const deployer = new Web3Wrapper(provider);
  const accounts = await deployer.web3.eth.getAccounts();
  const owner = accounts[0];
  const alice = accounts[1];
  const bob = accounts[2];

  ///////////////////////////// Setup
  // ERC20 Token
  const token = await deployer.deploy(artifact.kDaOToken, owner, [
    'kDaOToken',
    'kDaO',
    100000,
  ]);

  //Timelock implementation
  const timelockImplementation = await deployer.deploy(
    artifact.SimpleTimelockUpgradeable,
    owner
  );

  //Timelock proxy
  const proxy = await deployer.deploy(artifact.TokenTimelockProxy, owner, [
    token.options.address,
    timelockImplementation.options.address,
  ]);

  //kDaO
  const kDaOImplementation = await deployer.deploy(artifact.kDaO, owner);

  //DataOwnerContract
  const docOwner = await deployer.deployDataOwnerContract(owner);
  const docAlice = await deployer.deployDataOwnerContract(alice);
  const docBob = await deployer.deployDataOwnerContract(bob);

  console.log(docOwner.address, docAlice.address, docBob.address);

  //AggregatorContract
  const agg = await deployer.deploy(artifact.AggregatorContract, owner, [
    token.options.address,
    kDaOImplementation.options.address,
    proxy.options.address,
  ]);
  ///////////////////////////////////////////////////

  ///////////////////// Operations
  const amountToStake = 10;
  let kDaOAddress = '0x0';
  const millisToWait = 9000;
  const debatingPeriodMul = 2;
  const reasons = deployer.web3.utils.utf8ToHex('some reasons');

  //should transfer 100 tokens to alice and bob'
  const res1 = await token.methods.transfer(alice, 100).send({
    from: owner,
  });
  const res2 = await token.methods.transfer(bob, 100).send({
    from: owner,
  });
  //should grant access to alice and bob
  const dataId = deployer.web3.utils.utf8ToHex('dataId1');
  const res3 = await docOwner.grantAccess([alice, bob], dataId);
  const res4 = await docOwner.checkPermissions(alice, dataId);
  //should grant access to alice after a request
  const res5 = await docOwner.requestAccess([alice], dataId, reasons, alice);
  const reqId = res5.events.NewRequest.returnValues.requestId;
  const res6 = await docOwner.grantAccessRequest(reqId);
  // should revoke access to alice
  const res7 = await docOwner.revokeAccess([alice], dataId);

  //aggregator should request access to alice and bob
  const dataIdAlice = deployer.web3.utils.utf8ToHex('dataIdAlice');
  const dataIdBob = deployer.web3.utils.utf8ToHex('dataIdBob');
  const releaseDatePeriod = Math.floor(
    (millisToWait * debatingPeriodMul * debatingPeriodMul) / 1000
  );
  const parameters = [releaseDatePeriod, 1, 1, 1, 1, 1000, 1];
  const res8 = await agg.methods
    .requestAccessToData(
      [dataIdAlice, dataIdBob],
      [docAlice.address, docBob.address],
      [owner],
      reasons,
      parameters
    )
    .send({
      from: owner,
    });

  const reqIdAlice = res8.events.NewAggregation.returnValues.requestIds[0];
  const reqIdBob = res8.events.NewAggregation.returnValues.requestIds[1];
  const aggId = res8.events.NewAggregation.returnValues.aggregationId;

  const res9 = await docAlice.grantAccessRequest(reqIdAlice);
  const res10 = await docBob.grantAccessRequest(reqIdBob);

  const checkKgtM = await agg.methods.checkKgtM(aggId).call();
  console.log(checkKgtM);

  provider.engine.stop();
};

const testBroker = async () => {
  const provider = new HDWalletProvider(MNEMONIC, 'http://127.0.0.1:8545');
  const deployer = new Web3Wrapper(provider);
  const accounts = await deployer.web3.eth.getAccounts();
  const owner = accounts[0];
  const alice = accounts[1];
  const bob = accounts[2];

  ///////////////////////////// Setup
  // ERC20 Token
  const token = await deployer.deploy(artifact.kDaOToken, owner, [
    'kDaOToken',
    'kDaO',
    100000,
  ]);

  //Timelock implementation
  const timelockImplementation = await deployer.deploy(
    artifact.SimpleTimelockUpgradeable,
    owner
  );

  //Timelock proxy
  const proxy = await deployer.deploy(artifact.TokenTimelockProxy, owner, [
    token.options.address,
    timelockImplementation.options.address,
  ]);

  //kDaO
  const kDaOImplementation = await deployer.deploy(artifact.kDaO, owner);

  //DataOwnerContract
  const docOwner = await deployer.deployDataOwnerContract(owner);
  const docAlice = await deployer.deployDataOwnerContract(alice);
  const docBob = await deployer.deployDataOwnerContract(bob);

  //AggregatorContract
  const agg = await deployer.deploy(artifact.AggregatorContract, owner, [
    token.options.address,
    kDaOImplementation.options.address,
    proxy.options.address,
  ]);
  ///////////////////////////////////////////////////

  ///////////////////// Operations
  const amountToStake = 10;
  let kDaOAddress = '0x0';
  const millisToWait = 9000;
  const debatingPeriodMul = 2;
  const reasons = deployer.web3.utils.utf8ToHex('some reasons');

  //should transfer 100 tokens to alice and bob'
  const res1 = await token.methods.transfer(alice, 100).send({
    from: owner,
  });
  const res2 = await token.methods.transfer(bob, 100).send({
    from: owner,
  });
  //should grant access to alice and bob
  const dataId = deployer.web3.utils.utf8ToHex('dataId1');
  const res3 = await docOwner.grantAccess([alice, bob], dataId);
  const res4 = await docOwner.checkPermissions(alice, dataId);
  //should grant access to alice after a request
  const res5 = await docOwner.requestAccess([alice], dataId, reasons, alice);
  const reqId = res5.events.NewRequest.returnValues.requestId;
  const res6 = await docOwner.grantAccessRequest(reqId);
  // should revoke access to alice
  const res7 = await docOwner.revokeAccess([alice], dataId);

  //aggregator should request access to alice and bob
  const dataIdAlice = deployer.web3.utils.utf8ToHex('dataIdAlice');
  const dataIdBob = deployer.web3.utils.utf8ToHex('dataIdBob');
  const releaseDatePeriod = Math.floor(
    (millisToWait * debatingPeriodMul * debatingPeriodMul) / 1000
  );
  const parameters = [releaseDatePeriod, 1, 1, 1, 1, 1000, 1];
  const res8 = await agg.methods
    .requestAccessToData(
      [dataIdAlice, dataIdBob],
      [docAlice.address, docBob.address],
      [owner],
      reasons,
      parameters
    )
    .send({
      from: owner,
    });

  const reqIdAlice = res8.events.NewAggregation.returnValues.requestIds[0];
  const reqIdBob = res8.events.NewAggregation.returnValues.requestIds[1];
  const aggId = res8.events.NewAggregation.returnValues.aggregationId;

  const res9 = await docAlice.grantAccessRequest(reqIdAlice);
  const res10 = await docBob.grantAccessRequest(reqIdBob);

  const checkKgtM = await agg.methods.checkKgtM(aggId).call();
  console.log(checkKgtM);

  const host = 'http://127.0.0.1';
  const port = 8022;
  const auth = new AuthService(host, port);

  const plaintext = 'Hello World!';

  const aliceKeyp = (await auth.requestKeypair()).data;
  const signer = (await auth.requestSigner()).data;
  const bobKeyp = (await auth.requestKeypair()).data;

  // aliceKeyp
  const { ciphertext, capsule } = (
    await auth.encrypt({
      plaintext,
      pk: aliceKeyp.pk,
    })
  ).data;

  const { kfrags } = (
    await auth.generateKfrags({
      sender: aliceKeyp,
      signer,
      receiver: bobKeyp.pk,
      threshold: 1,
      nodes_number: 4,
    })
  ).data;

  const broker = new BrokerService(host, 3162);

  await broker.storeCapsule({
    sender: aliceKeyp.pk,
    dataId: 'dataIdAlice',
    capsule,
  });

  await broker.storeKFrag({
    sender: aliceKeyp.pk,
    receiver: bobKeyp.pk,
    kfrag: kfrags[0],
  });

  await broker.generateCFrag({
    sender: aliceKeyp.pk,
    signer: signer.pk,
    dataId: 'dataIdAlice',
    receiver: bobKeyp.pk,
  });

  // BobKeyp
  const dataSign = 'sign this pls';
  const signerBob = (await auth.requestSigner()).data;

  const { signature } = (
    await auth.sign({
      signer: signerBob,
      data: dataSign,
    })
  ).data;

  const cfrag1 = (
    await broker.getCFrag({
      address: docAlice.address,
      dataId: 'dataIdAlice',
      account: owner,
      sender: aliceKeyp.pk,
      signer: signerBob.pk,
      data: dataSign,
      signature,
      receiver: bobKeyp.pk,
    })
  ).data;

  const cfrags = [cfrag1.result];

  const { plaintext: dPlaintext } = (
    await auth.decrypt({
      sender: aliceKeyp.pk,
      signer: signer.pk,
      receiver: bobKeyp,
      capsule,
      ciphertext,
      cfrags,
    })
  ).data;

  console.log(dPlaintext);

  provider.engine.stop();
};

const main = async () => {
  try {
    //await test();
    //await testSignature();
    //await testContracts();
    await testBroker();
  } catch (error) {
    console.log(error);
  }
};

main();
