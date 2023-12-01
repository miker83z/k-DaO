const poissonProcess = require('poisson-process');
const fs = require('fs');
const HDWalletProvider = require('@truffle/hdwallet-provider');
const { AuthService } = require('../lib/auth');
const { BrokerService } = require('../lib/broker');
const { Web3Wrapper, artifact } = require('../lib/web3Wrapper');
const { publicKeyCreate } = require('secp256k1');
const commandLineArgs = require('command-line-args');

require('dotenv').config();

const phrase = process.env.IOTA_WASP_MNEMONIC;
const url = process.env.IOTA_WASP_URL;
const chain = process.env.IOTA_WASP_CHAIN;
const providerOrUrl = `${url}/wasp/api/v1/chains/${chain}/evm`;

const optionDefinitions = [
  { name: 'bobs', alias: 'b', type: Number, defaultValue: 10 },
  { name: 'threshold', alias: 't', type: Number, defaultValue: 2 },
  { name: 'nodes', alias: 'n', type: Number, defaultValue: 4 },
  { name: 'tests', alias: 'x', type: Number, defaultValue: 1 },
  { name: 'cycles', alias: 'c', type: Number, defaultValue: 20 },
  { name: 'lambda', alias: 'l', type: Number, defaultValue: 1500 },
  {
    name: 'directory',
    alias: 'd',
    type: String,
    defaultValue: 'outputDataset',
  },
];
const options = commandLineArgs(optionDefinitions);

const MNEMONIC = process.env.MNEMONIC;

const dirMain = options.directory;
const lambda = options.lambda; //ms
const tests_number = options.tests;
const cycles = options.cycles;
const threshold = options.threshold;
const nodes_number = options.nodes;

const dataIdGlobal = 'dataIdX';
const plaintext = '0123456789';
const dataToSign = 'sign this pls';
let deployer;
let dirDate;

let aggregator = {
  host: 'http://127.0.0.1',
  rpcPort: 8545,
  brokerPort: 3161,
  authPort: 8021,
  account: '',
  keypair: {},
  signer: {},
  signerAccount: '',
  agg: {},
  ciphertext: '',
  capsule: {},
  provider: {},
  auth: {},
};

let bobs = {
  host: 'http://127.0.0.1',
  brokerPort: 3161,
  authPort: 8021,
  num: options.bobs,
  dir: '',
  account: [],
  keypair: [],
  signer: [],
  doc: [],
  signature: [],
  kfrags: [],
  auth: {},
};

let nodes = [
  {
    host: 'http://127.0.0.1',
    rpcPort: 8545,
    brokerPort: 3161,
    authPort: 8021,
    auth: {},
    broker: {},
  },
  {
    host: 'http://127.0.0.1',
    rpcPort: 8545,
    brokerPort: 3162,
    authPort: 8022,
    auth: {},
    broker: {},
  },
  {
    host: 'http://127.0.0.1',
    rpcPort: 8545,
    brokerPort: 3163,
    authPort: 8023,
    auth: {},
    broker: {},
  },
  {
    host: 'http://127.0.0.1',
    rpcPort: 8545,
    brokerPort: 3164,
    authPort: 8024,
    auth: {},
    broker: {},
  },
];

const preProcessing = async (plaintext, threshold, nodes_number) => {
  //////////// Tests output files' setup
  if (!fs.existsSync(dirMain)) fs.mkdirSync(dirMain);
  const dirBobs = dirMain + '/' + bobs.num + '/';
  if (!fs.existsSync(dirBobs)) fs.mkdirSync(dirBobs);
  const dirThreshold = dirBobs + threshold + '/';
  if (!fs.existsSync(dirThreshold)) fs.mkdirSync(dirThreshold);

  dirDate = new Date().toISOString();
  const dir = dirThreshold + dirDate + '/';
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  bobs.dir = dir;

  //////////// Nodes' setup
  for (let n = 0; n < nodes_number; n++) {
    nodes[n].auth = new AuthService(nodes[n].host, nodes[n].authPort);
    nodes[n].broker = new BrokerService(nodes[n].host, nodes[n].brokerPort);
  }

  //////////// Aggregator's setup
  aggregator.provider = new HDWalletProvider({
    mnemonic: {
      phrase,
    },
    providerOrUrl,
    numberOfAddresses: bobs.num + 1,
  });
  // General
  deployer = new Web3Wrapper(aggregator.provider);
  const accounts = Object.keys(aggregator.provider.wallets);
  // Back to agg
  aggregator.auth = new AuthService(aggregator.host, aggregator.authPort);
  aggregator.account = accounts[0];
  const aggregatorSkUint8 = new Uint8Array(
    aggregator.provider.wallets[aggregator.account].privateKey
  );
  const aggregatorPkUint8 = publicKeyCreate(aggregatorSkUint8, true);
  aggregator.keypair = {
    pk: Array.from(aggregatorPkUint8),
    sk: Array.from(aggregatorSkUint8),
  };
  const { pk: aggregatorSignerPkUint8, sk: aggregatorSignerSkUint8 } = (
    await aggregator.auth.requestSigner()
  ).data;
  aggregator.signer = {
    pk: Array.from(aggregatorSignerPkUint8),
    sk: Array.from(aggregatorSignerSkUint8),
  };
  aggregator.signerAccount = deployer.web3.eth.accounts.privateKeyToAccount(
    '0x' + Buffer.from(aggregatorSignerSkUint8).toString('hex')
  ).address;

  //////////// Main Smart Contracts Setup
  // ERC20 Token
  const token = await deployer.deploy(artifact.kDaOToken, aggregator.account, [
    'kDaOToken',
    'kDaO',
    100000,
  ]);
  //Timelock implementation
  const timelockImplementation = await deployer.deploy(
    artifact.SimpleTimelockUpgradeable,
    aggregator.account
  );
  //Timelock proxy
  const proxy = await deployer.deploy(
    artifact.TokenTimelockProxy,
    aggregator.account,
    [token.options.address, timelockImplementation.options.address]
  );
  //kDaO
  const kDaOImplementation = await deployer.deploy(
    artifact.kDaO,
    aggregator.account
  );
  //AggregatorContract
  aggregator.agg = await deployer.deploy(
    artifact.AggregatorContract,
    aggregator.account,
    [
      token.options.address,
      kDaOImplementation.options.address,
      proxy.options.address,
    ]
  );

  //////////// Bobs' setup
  bobs.auth = new AuthService(bobs.host, bobs.authPort);
  for (let i = 0; i < bobs.num; i++) {
    const tmpAcc = accounts[1 + i];
    bobs.account.push(tmpAcc);
    const bobSkUint8 = new Uint8Array(
      aggregator.provider.wallets[tmpAcc].privateKey
    );
    const bobPkUint8 = publicKeyCreate(bobSkUint8, true);
    bobs.keypair.push({
      pk: Array.from(bobPkUint8),
      sk: Array.from(bobSkUint8),
    });
    const { pk: aggregatorSignerPkUint8, sk: aggregatorSignerSkUint8 } = (
      await bobs.auth.requestSigner()
    ).data;
    bobs.signer.push({
      pk: Array.from(aggregatorSignerPkUint8),
      sk: Array.from(aggregatorSignerSkUint8),
    });

    // Deploy DOContract
    await deployer.sendEther(aggregator.account, tmpAcc, 1000000000000000000);
    bobs.doc.push(await deployer.deployDataOwnerContract(tmpAcc));

    // Get and send Capsule
    const { capsule } = (
      await bobs.auth.encrypt({
        plaintext,
        pk: bobs.keypair[i].pk,
      })
    ).data;
    for (let n = 0; n < nodes_number; n++) {
      await nodes[n].broker.storeCapsule({
        sender: bobs.keypair[i].pk,
        dataId: dataIdGlobal,
        capsule,
      });
    }

    // File's setup
    const filepath = bobs.dir + 'bob-' + i + '.csv';
    fs.writeFile(
      filepath,
      'counter,start,storeDLT,storeKfrags,finish\n', //TODO
      (err) => {
        if (err) throw err;
      }
    );
  }
};

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms, false));
};

const getRandomInt = (min, max) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min);
};

const singleBobGoesForAWalk = async (
  ibob,
  cycle,
  threshold,
  nodes_number,
  lambda,
  tstampsAgg,
  reqId
) => {
  const tstamps = new Array(7).fill(-1);
  tstamps[0] = tstampsAgg[0];
  tstamps[1] = tstampsAgg[1];
  const promisesBobTS = [];
  const promisesBobTS2 = [];
  const promisesAggregatorTS = [];

  try {
    //Start walking
    if (tstamps[1] !== -1) {
      ///////////////////////////////////////////////////////////////////////
      //Bob grants access request in the smart contract
      await bobs.doc[ibob].grantAccessRequest(reqId);
      tstamps[2] = new Date().getTime();
      ///////////////////////////////////////////////////////////////////////

      ///////////////////////////////////////////////////////////////////////
      //Bob stores Aggregator's kfrags in each node
      //Create KFrags
      const randomNodeKFrag = getRandomInt(0, nodes_number);
      let kfrags;
      let condition = true;
      do {
        //TODO check why (rust)
        kfrags = (
          await nodes[randomNodeKFrag].auth.generateKfrags({
            sender: bobs.keypair[ibob],
            signer: bobs.signer[ibob],
            receiver: aggregator.keypair.pk,
            threshold,
            nodes_number,
          })
        ).data.kfrags;
        let prova = false;
        for (let ks = 0; ks < kfrags.length; ks++) {
          if (kfrags[ks].length !== 259) {
            console.log('kfrags error');
            prova = true;
          }
        }
        condition = prova;
      } while (condition);
      //Store KFrags
      const promisesBob = [];
      let promisesBobErr = false;
      for (let n = 0; n < nodes_number; n++) {
        promisesBob.push(
          nodes[n].broker.storeKFrag({
            sender: bobs.keypair[ibob].pk,
            receiver: aggregator.keypair.pk,
            kfrag: kfrags[n],
          })
        );
      }
      await Promise.all(
        promisesBob.map((promise) =>
          promise
            .then((res) => {
              if (res.status == 200) {
                promisesBobTS.push(new Date().getTime() - tstamps[2]);
              } else {
                promisesBobTS.push(-1);
                promisesBobErr = true;
              }
            })
            .catch((e) => {
              promisesBobTS.push(-1);
              console.log(e);
              promisesBobErr = true;
            })
        )
      );
      if (promisesBobErr) {
        throw new Error('KFrags distribution error');
      }
      tstamps[3] = new Date().getTime();
      ///////////////////////////////////////////////////////////////////////

      ///////////////////////////////////////////////////////////////////////
      //Bob generates Aggregator's cfrags in each node
      //Create and store CFrags
      const promisesBob2 = [];
      let promisesBobErr2 = false;
      for (let n = 0; n < nodes_number; n++) {
        promisesBob2.push(
          nodes[n].broker.generateCFrag({
            sender: bobs.keypair[ibob].pk,
            signer: bobs.signer[ibob].pk,
            dataId: dataIdGlobal,
            receiver: aggregator.keypair.pk,
          })
        );
      }
      await Promise.all(
        promisesBob2.map((promise) =>
          promise
            .then((res) => {
              if (res.status == 200) {
                promisesBobTS2.push(new Date().getTime() - tstamps[3]);
              } else {
                promisesBobTS2.push(-1);
                promisesBobErr2 = true;
              }
            })
            .catch((e) => {
              promisesBobTS2.push(-1);
              console.log(e);
              promisesBobErr2 = true;
            })
        )
      );
      if (promisesBobErr2) {
        throw new Error('CFrags generation error');
      }
      tstamps[4] = new Date().getTime();
      ///////////////////////////////////////////////////////////////////////

      ///////////////////////////////////////////////////////////////////////
      //Aggregator requests cfrags
      //Create Signature
      const randomNodeSignature = getRandomInt(0, nodes_number);
      const { signature } = (
        await nodes[randomNodeSignature].auth.sign({
          signer: aggregator.signer,
          data: dataToSign,
        })
      ).data;
      //Get t CFrags
      const promisesAggregator = [];
      let promisesAggregatorErr = false;
      const chosenNodes = [];
      const cfrags = [];
      for (let k = 0; k < threshold; k++) {
        var randomNodeCFrag;
        do {
          randomNodeCFrag = getRandomInt(0, nodes_number);
        } while (chosenNodes.includes(randomNodeCFrag));
        chosenNodes.push(randomNodeCFrag);
        promisesAggregator.push(
          nodes[randomNodeCFrag].broker.getCFrag({
            address: bobs.doc[ibob].address,
            dataId: dataIdGlobal,
            sender: bobs.keypair[ibob].pk,
            signer: aggregator.signer.pk,
            signature,
            receiver: aggregator.keypair.pk,
          })
        );
      }
      await Promise.all(
        promisesAggregator.map((promise) =>
          promise
            .then((res) => {
              if (res.status == 200) {
                promisesAggregatorTS.push(new Date().getTime() - tstamps[4]);
              } else {
                promisesAggregatorTS.push(-1);
                promisesAggregatorErr = true;
              }
            })
            .catch((e) => {
              promisesAggregatorTS.push(-1);
              console.log(e);
              promisesAggregatorErr = true;
            })
        )
      );
      if (promisesAggregatorErr) {
        throw new Error('KFrags distribution error');
      }
      tstamps[5] = new Date().getTime();
      ///////////////////////////////////////////////////////////////////////

      ///////////////////////////////////////////////////////////////////////
      //Key Redistribution
      let randomNodeCFrag2 = getRandomInt(0, nodes_number);
      const sid =
        cycle * 1000 + ibob + getRandomInt(0, Number.MAX_SAFE_INTEGER / 2);
      const parties = 5;
      const thresholdRefresh = 3;
      const dh_point = [
        3, 248, 92, 16, 145, 125, 119, 97, 185, 247, 94, 147, 17, 90, 84, 1,
        142, 9, 237, 202, 165, 133, 107, 110, 221, 41, 181, 30, 142, 238, 111,
        228, 107,
      ];
      const precursor = [
        2, 73, 132, 47, 131, 129, 0, 31, 112, 153, 107, 119, 88, 77, 130, 198,
        122, 160, 149, 24, 220, 229, 127, 18, 206, 210, 175, 208, 117, 133, 182,
        202, 186,
      ];
      const delegatee_key = [
        2, 177, 68, 125, 44, 113, 169, 50, 229, 3, 234, 78, 206, 105, 227, 167,
        244, 76, 218, 133, 255, 29, 140, 140, 160, 125, 132, 165, 145, 88, 61,
        6, 139,
      ];
      const id = [
        'CFB8AA869E8941B58E680B88D9673EFBA345A38D37B00D6ADE35B00F67A08F80',
        '5959A6AE444C989EBD096EFDC46C8BFEBEA0D031D472008FFBB6F2347FC82CC0',
        '93BEFAC409E4A863A0F26ADC6508C75A7D5FD7EBB479400206E8BBF5B0539EB7',
        '615FEB0C83CF9FA3B84AEFA1A29B9E380AA8BD64BC8F4A581E0B91B247CCF5E3',
        '585B01A63A80C839EE73CA313E79C25710D78C9A11893C9BF4856EED02622637',
      ];
      const sk = [
        [
          44, 170, 187, 26, 236, 53, 108, 172, 179, 38, 244, 251, 72, 246, 178,
          208, 7, 129, 111, 206, 4, 55, 22, 249, 136, 189, 115, 168, 246, 217,
          245, 116,
        ],
        [
          143, 95, 152, 35, 162, 113, 72, 18, 107, 104, 187, 44, 134, 2, 107,
          37, 248, 161, 234, 237, 41, 72, 248, 177, 120, 147, 58, 77, 130, 244,
          100, 142,
        ],
        [
          37, 182, 132, 105, 81, 179, 163, 95, 248, 10, 29, 72, 235, 128, 54,
          200, 95, 99, 60, 44, 151, 201, 75, 31, 130, 181, 23, 33, 171, 158,
          153, 116,
        ],
        [
          78, 191, 113, 132, 124, 232, 199, 128, 147, 26, 234, 133, 69, 124, 36,
          147, 124, 15, 202, 38, 202, 103, 215, 32, 136, 162, 49, 241, 240, 111,
          68, 204,
        ],
        [
          116, 141, 216, 95, 237, 86, 68, 78, 133, 106, 213, 208, 119, 92, 122,
          33, 183, 143, 147, 147, 197, 71, 230, 208, 109, 229, 62, 70, 200, 4,
          12, 39,
        ],
      ];

      for (let k = 0; k < id.length; k++) {
        await nodes[randomNodeCFrag2].auth.keyRefresh({
          sid,
          parties,
          threshold,
          dh_point,
          precursor,
          delegatee_key,
          id: id[k],
          sk: sk[k],
        });
      }
      tstamps[6] = new Date().getTime();
    }
  } catch (error) {
    console.log('Test error: ', error);
  } finally {
    let resString = '';
    for (let t = 1; t < tstamps.length; t++) {
      if (tstamps[t] === -1) {
        resString += tstamps[t];
      } else {
        resString += tstamps[t] - tstamps[t - 1];
      }
      if (t !== tstamps.length - 1) {
        resString += ',';
      }
    }
    console.log(
      'Bob',
      ibob,
      'cycle',
      cycle,
      ', Results:',
      resString,
      promisesBobTS,
      promisesBobTS2,
      promisesAggregatorTS
    );
    const filepath = bobs.dir + 'bob-' + ibob + '.csv';
    fs.appendFile(filepath, cycle + ',' + resString + '\n', (err) => {
      if (err) throw err;
    });
  }
};

const test = async (cycle, threshold, nodes_number, lambda) => {
  const sleepingFor = poissonProcess.sample(lambda * cycle);
  console.log(
    'Bobs',
    bobs.num,
    ', cycle',
    cycle,
    ', waiting for',
    sleepingFor,
    'ms'
  );
  await sleep(sleepingFor);

  const millisToWait = 9000;
  const debatingPeriodMul = 2;
  const releaseDatePeriod = Math.floor(
    (millisToWait * debatingPeriodMul * debatingPeriodMul) / 1000
  );
  const parameters = [releaseDatePeriod, 1, 1, 1, 1, 1000, 1];
  const reasons = deployer.web3.utils.utf8ToHex('some reasons');
  const dataId = deployer.web3.utils.utf8ToHex(dataIdGlobal);
  const dataIds = new Array(bobs.num).fill(dataId);
  const tmpDoc = [];
  for (let d = 0; d < bobs.doc.length; d++) {
    tmpDoc.push(bobs.doc[d].address);
  }

  const tstamps = new Array(2).fill(-1);
  var reqId = new Array(bobs.num).fill(-1);
  try {
    tstamps[0] = new Date().getTime();
    const res8 = await aggregator.agg.methods
      .requestAccessToData(
        dataIds,
        tmpDoc,
        [aggregator.signerAccount],
        reasons,
        parameters
      )
      .send({
        from: aggregator.account,
      });
    reqId = res8.events.NewAggregation.returnValues.requestIds;
    tstamps[1] = new Date().getTime();
  } catch (error) {
    console.log(error);
  } finally {
    const promisesWalk = [];
    for (let i = 0; i < bobs.num; i++) {
      promisesWalk.push(
        singleBobGoesForAWalk(
          i,
          cycle,
          threshold,
          nodes_number,
          lambda,
          tstamps,
          reqId[i]
        )
      );
    }
    await Promise.all(promisesWalk);
  }
};

const main = async () => {
  for (let i = 0; i < tests_number; i++) {
    try {
      console.log('Starting Test n.', i + 1);
      await sleep(2000);

      await preProcessing(plaintext, threshold, nodes_number);
      console.log('Pre processing OK');
      await sleep(5000);

      const promisesTest = [];
      for (let cycle = 0; cycle < cycles; cycle++) {
        promisesTest.push(test(cycle, threshold, nodes_number, lambda));
      }
      await Promise.all(promisesTest);
      console.log('Finished Test n.', i + 1);
    } catch (error) {
      console.log(error);
    } finally {
      aggregator.provider.engine.stop();
    }
  }
};

main();
