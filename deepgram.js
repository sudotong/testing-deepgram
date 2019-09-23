const { DEEPGRAM_PASSWORD, DEEPGRAM_USERNAME } = process.env;

exports.getHeaders = function () {
    const prebase64 = `${(DEEPGRAM_USERNAME || "username").trim()}:${(DEEPGRAM_PASSWORD || "password").trim()}`;
    const authString = Buffer.from(prebase64).toString('base64');
    return {
        'Authorization': `Basic ${authString}`,
    };
};

exports.getQuerystring = function () {
    return {
        model: 'phonecall',
        punctuate: true
    };
};