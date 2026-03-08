const DropboxSign = require('@dropbox/sign');

const configuration = new DropboxSign.Configuration({
  username: process.env.HELLOSIGN_API_KEY,
});

const signatureRequestApi = new DropboxSign.SignatureRequestApi(configuration);

module.exports = { DropboxSign, signatureRequestApi };
