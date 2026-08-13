const { YouVersionBibleClient } = require('./youVersionBibleClient');
const client = new YouVersionBibleClient({ appKey: 'test' });
// NBLA version ID might be 149
client.baseUrl = "https://api.youversion.com/v1"; // bypass token check for a moment or test
// Oh wait, I don't have the API key!
