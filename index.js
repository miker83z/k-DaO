const HDWalletProvider = require('@truffle/hdwallet-provider');
const { AuthService } = require('./lib/auth');
const { BrokerService } = require('./lib/broker');
const { Web3Wrapper, artifact } = require('./lib/web3Wrapper');
const { publicKeyCreate } = require('secp256k1');

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
  try {
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
  } catch (error) {
    console.log(error);
  } finally {
    provider.engine.stop();
  }
};

const testBroker = async () => {
  const provider = new HDWalletProvider(MNEMONIC, 'http://127.0.0.1:8545');
  try {
    const host = 'http://127.0.0.1';
    const auth = new AuthService(host, 8024);
    const broker = new BrokerService(host, 3164);
    const deployer = new Web3Wrapper(provider);

    //const accounts = await deployer.web3.eth.getAccounts();
    //console.log(provider.wallets[accounts[0]].getPrivateKeyString().slice(2));
    const accounts = Object.keys(provider.wallets);
    ////////////// Owner
    const aggregator = accounts[0];
    const aggregatorSkUint8 = new Uint8Array(
      provider.wallets[aggregator].privateKey
    );
    const aggregatorPkUint8 = publicKeyCreate(aggregatorSkUint8, true);
    const aggregatorKeypair = {
      pk: Array.from(aggregatorPkUint8),
      sk: Array.from(aggregatorSkUint8),
    };
    const { pk: aggregatorSignerPkUint8, sk: aggregatorSignerSkUint8 } = (
      await auth.requestSigner()
    ).data;
    const aggregatorSignerKeypair = {
      pk: Array.from(aggregatorSignerPkUint8),
      sk: Array.from(aggregatorSignerSkUint8),
    };
    const aggregatorSigner = deployer.web3.eth.accounts.privateKeyToAccount(
      '0x' + Buffer.from(aggregatorSignerSkUint8).toString('hex')
    ).address;
    ////////////// Alice
    const doAlice = accounts[1];
    const doAliceSkUint8 = new Uint8Array(provider.wallets[doAlice].privateKey);
    const doAlicePkUint8 = publicKeyCreate(doAliceSkUint8, true);
    const doAliceKeypair = {
      pk: Array.from(doAlicePkUint8),
      sk: Array.from(doAliceSkUint8),
    };
    const { pk: doAliceSignerPkUint8, sk: doAliceSignerSkUint8 } = (
      await auth.requestSigner()
    ).data;
    const doAliceSignerKeypair = {
      pk: Array.from(doAliceSignerPkUint8),
      sk: Array.from(doAliceSignerSkUint8),
    };
    ////////////// Bob
    const doBob = accounts[2];
    const doBobSkUint8 = new Uint8Array(provider.wallets[doBob].privateKey);
    const doBobPkUint8 = publicKeyCreate(doBobSkUint8, true);
    const doBobKeypair = {
      pk: Array.from(doBobPkUint8),
      sk: Array.from(doBobSkUint8),
    };
    const { pk: doBobSignerPkUint8, sk: doBobSignerSkUint8 } = (
      await auth.requestSigner()
    ).data;
    const doBobSignerKeypair = {
      pk: Array.from(doBobSignerPkUint8),
      sk: Array.from(doBobSignerSkUint8),
    };

    ///////////////////////////// Setup
    // ERC20 Token
    const token = await deployer.deploy(artifact.kDaOToken, aggregator, [
      'kDaOToken',
      'kDaO',
      100000,
    ]);

    //Timelock implementation
    const timelockImplementation = await deployer.deploy(
      artifact.SimpleTimelockUpgradeable,
      aggregator
    );

    //Timelock proxy
    const proxy = await deployer.deploy(
      artifact.TokenTimelockProxy,
      aggregator,
      [token.options.address, timelockImplementation.options.address]
    );

    //kDaO
    const kDaOImplementation = await deployer.deploy(artifact.kDaO, aggregator);

    //DataOwnerContract
    const docOwner = await deployer.deployDataOwnerContract(aggregator);
    const docAlice = await deployer.deployDataOwnerContract(doAlice);
    const docBob = await deployer.deployDataOwnerContract(doBob);

    //AggregatorContract
    const agg = await deployer.deploy(artifact.AggregatorContract, aggregator, [
      token.options.address,
      kDaOImplementation.options.address,
      proxy.options.address,
    ]);
    ///////////////////////////////////////////////////

    ///////////////////// Operations
    const millisToWait = 9000;
    const debatingPeriodMul = 2;
    const reasons = deployer.web3.utils.utf8ToHex('some reasons');

    //aggregator should request access to doAlice and doBob
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
        [aggregatorSigner],
        reasons,
        parameters
      )
      .send({
        from: aggregator,
      });

    const reqIdAlice = res8.events.NewAggregation.returnValues.requestIds[0];
    const reqIdBob = res8.events.NewAggregation.returnValues.requestIds[1];
    await docAlice.grantAccessRequest(reqIdAlice);
    await docBob.grantAccessRequest(reqIdBob);

    const plaintext = 'Hello World!';

    const { ciphertext, capsule } = (
      await auth.encrypt({
        plaintext,
        pk: doAliceKeypair.pk,
      })
    ).data;

    const { kfrags } = (
      await auth.generateKfrags({
        sender: doAliceKeypair,
        signer: doAliceSignerKeypair,
        receiver: aggregatorKeypair.pk,
        threshold: 1,
        nodes_number: 4,
      })
    ).data;

    await broker.storeCapsule({
      sender: doAliceKeypair.pk,
      dataId: 'dataIdAlice',
      capsule,
    });

    await broker.storeKFrag({
      sender: doAliceKeypair.pk,
      receiver: aggregatorKeypair.pk,
      kfrag: kfrags[0],
    });

    await broker.generateCFrag({
      sender: doAliceKeypair.pk,
      signer: doAliceSignerKeypair.pk,
      dataId: 'dataIdAlice',
      receiver: aggregatorKeypair.pk,
    });

    const dataToSign = 'sign this pls';

    const { signature } = (
      await auth.sign({
        signer: aggregatorSignerKeypair,
        data: dataToSign,
      })
    ).data;

    const cfrag1 = (
      await broker.getCFrag({
        address: docAlice.address,
        dataId: 'dataIdAlice',
        sender: doAliceKeypair.pk,
        signer: aggregatorSignerKeypair.pk,
        signature,
        receiver: aggregatorKeypair.pk,
      })
    ).data;

    const cfrags = [cfrag1.result];

    const { plaintext: dPlaintext } = (
      await auth.decrypt({
        sender: doAliceKeypair.pk,
        signer: doAliceSignerKeypair.pk,
        receiver: aggregatorKeypair,
        capsule,
        ciphertext,
        cfrags,
      })
    ).data;

    console.log(dPlaintext);
  } catch (error) {
    console.log(error);
  } finally {
    provider.engine.stop();
  }
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
