const axios = require('axios').default;

const host = 'http://127.0.0.1';
const port = 8022;

const requestKeypair = (host, port, path = '/stateless/keypair') => {
  try {
    return axios.get(host + ':' + port + path);
  } catch (error) {
    console.log(error);
  }
};

const requestSigner = (host, port, path = '/stateless/signer') => {
  try {
    return axios.get(host + ':' + port + path);
  } catch (error) {
    console.log(error);
  }
};

const sign = (host, port, payload, path = '/stateless/sign') => {
  try {
    return axios.post(host + ':' + port + path, payload);
  } catch (error) {
    console.log(error);
  }
};

const verify = (host, port, payload, path = '/stateless/verify') => {
  try {
    return axios.post(host + ':' + port + path, payload);
  } catch (error) {
    console.log(error);
  }
};

const encrypt = (host, port, payload, path = '/stateless/encrypt') => {
  try {
    return axios.post(host + ':' + port + path, payload);
  } catch (error) {
    console.log(error);
  }
};

const generateKfrags = (host, port, payload, path = '/stateless/kfrags') => {
  try {
    return axios.post(host + ':' + port + path, payload);
  } catch (error) {
    console.log(error);
  }
};

const reencrypt = (host, port, payload, path = '/stateless/reencrypt') => {
  try {
    return axios.post(host + ':' + port + path, payload);
  } catch (error) {
    console.log(error);
  }
};

const decrypt = (host, port, payload, path = '/stateless/decrypt') => {
  try {
    return axios.post(host + ':' + port + path, payload);
  } catch (error) {
    console.log(error);
  }
};

const simpleDecrypt = (
  host,
  port,
  payload,
  path = '/stateless/simple_decrypt'
) => {
  try {
    return axios.post(host + ':' + port + path, payload);
  } catch (error) {
    console.log(error);
  }
};

//TODO
const storeCapsule = (host, port, payload, path = '/core/storeCapsule') => {
  try {
    return axios.post(host + ':' + port + path, payload);
  } catch (error) {
    console.log(error);
  }
};

//TODO
const storeDLT = (host, port, payload, path = '/core/storeDLT') => {
  try {
    return axios.post(host + ':' + port + path, payload);
  } catch (error) {
    console.log(error);
  }
};

//TODO
const storeKfrags = (host, port, payload, path = '/core/storeKfrags') => {
  try {
    return axios.post(host + ':' + port + path, payload);
  } catch (error) {
    console.log(error);
  }
};

//TODO
const getCfrags = (host, port, payload, path = '/core/getCfrags') => {
  try {
    return axios.post(host + ':' + port + path, payload);
  } catch (error) {
    console.log(error);
  }
};

const test = async () => {
  const plaintext = 'Hello World!';

  const alice = (await requestKeypair(host, port)).data;
  const signer = (await requestSigner(host, port)).data;
  const bob = (await requestKeypair(host, port)).data;

  const { ciphertext, capsule } = (
    await encrypt(host, port, {
      plaintext,
      pk: alice.pk,
    })
  ).data;

  const { kfrags } = (
    await generateKfrags(host, port, {
      sender: alice,
      signer,
      receiver: bob.pk,
      threshold: 2,
      nodes_number: 3,
    })
  ).data;

  const { cfrag: cfrag1 } = (
    await reencrypt(host, port, {
      sender: alice.pk,
      signer: signer.pk,
      receiver: bob.pk,
      capsule,
      kfrag: kfrags[0],
    })
  ).data;
  const cfrags = [cfrag1];

  const { cfrag: cfrag2 } = (
    await reencrypt(host, port, {
      sender: alice.pk,
      signer: signer.pk,
      receiver: bob.pk,
      capsule,
      kfrag: kfrags[1],
    })
  ).data;
  cfrags.push(cfrag2);

  const { plaintext: dPlaintext } = (
    await decrypt(host, port, {
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
  const signer = (await requestSigner(host, port)).data;
  const data = 'Hello World 2';

  const { signature } = (
    await sign(host, port, {
      signer,
      data,
    })
  ).data;

  const { verified } = (
    await verify(host, port, {
      signature,
      data,
      pk: signer.pk,
    })
  ).data;

  console.log('Signature verified: ' + verified);
};

const main = async () => {
  await test();
  await testSignature();
};

module.exports = {
  requestKeypair,
  requestSigner,
  sign,
  verify,
  encrypt,
  generateKfrags,
  reencrypt,
  decrypt,
  simpleDecrypt,
};
