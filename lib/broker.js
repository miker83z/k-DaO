const axios = require('axios').default;

class BrokerService {
  constructor(host, port) {
    if (host === undefined || port === undefined) {
      throw new Error('BrokerService: host and port not set');
    }
    this.host = host;
    this.port = port;
  }

  checkPermissions(payload, path = '/auth/checkPermissions') {
    return axios.post(this.host + ':' + this.port + path, payload);
  }

  storeCapsule(payload, path = '/auth/storeCapsule') {
    return axios.post(this.host + ':' + this.port + path, payload);
  }

  storeKFrag(payload, path = '/auth/storeKFrag') {
    return axios.post(this.host + ':' + this.port + path, payload);
  }

  generateCFrag(payload, path = '/auth/generateCFrag') {
    return axios.post(this.host + ':' + this.port + path, payload);
  }

  getCFrag(payload, path = '/auth/getCFrag') {
    return axios.post(this.host + ':' + this.port + path, payload);
  }
}

module.exports = { BrokerService };
