const axios = require('axios').default;

class AuthService {
  constructor(host, port) {
    if (host === undefined || port === undefined) {
      throw new Error('AuthService: host and port not set');
    }
    this.host = host;
    this.port = port;
  }

  requestKeypair(path = '/stateless/keypair') {
    return axios.get(this.host + ':' + this.port + path);
  }

  requestSigner(path = '/stateless/signer') {
    return axios.get(this.host + ':' + this.port + path);
  }

  sign(payload, path = '/stateless/sign') {
    return axios.post(this.host + ':' + this.port + path, payload);
  }

  verify(payload, path = '/stateless/verify') {
    return axios.post(this.host + ':' + this.port + path, payload);
  }

  encrypt(payload, path = '/stateless/encrypt') {
    return axios.post(this.host + ':' + this.port + path, payload);
  }

  generateKfrags(payload, path = '/stateless/kfrags') {
    return axios.post(this.host + ':' + this.port + path, payload);
  }

  reencrypt(payload, path = '/stateless/reencrypt') {
    return axios.post(this.host + ':' + this.port + path, payload);
  }

  decrypt(payload, path = '/stateless/decrypt') {
    return axios.post(this.host + ':' + this.port + path, payload);
  }

  simpleDecrypt(payload, path = '/stateless/simple_decrypt') {
    return axios.post(this.host + ':' + this.port + path, payload);
  }
}

module.exports = { AuthService };
