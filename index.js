// Source: https://deepgram.com/docs?javascript#real-time-speech-recognition

try {
    require('./env.js');
} catch (e) {
    if (!process.env.DEEPGRAM_PASSWORD || !process.env.DEEPGRAM_USERNAME) {
        throw 'error: you need process.env.DEEPGRAM_PASSWORD and process.env.DEEPGRAM_USERNAME defined in the env.js file, or in the call to this node script.'
    }
}

const fs = require('fs');
const querystring = require('querystring');

// Creates a client
const RecognizeStream = require('./deepgram-stream');
const deepgram = require('./deepgram');

const stream = new RecognizeStream({
    url: `wss://brain.deepgram.com/v2/listen/stream?${querystring.stringify({
        ...deepgram.getQuerystring(),
        interim_results: true
    })}`,
    headers: {
        ...deepgram.getHeaders(),
        // 'Content-Type': 'audio/wav'
    }
});


stream.on('error', err => {
    console.log({ msg: 'error from deepgram stream', errMessage: err && err.message, err });
}).on('results', results => {
    // Results should show real time transcript
    console.log('Transcription: ', results);
}).on('data', data => {
    console.log('Final: ', 'Array of length: ' + data.length, data.length && "with keys: " + JSON.stringify(Object.keys(data[0])));

    // data: [{type, value, ts, end_ts, confidence}]
    console.log('Final (' + data.length + '): ', data.length && data.map(d => d.value).join(' '))
})

const filename = './discovery-1min.wav'

// Stream an audio file from disk to the Speech API, e.g. "./resources/audio.wav"
fs.createReadStream(filename).pipe(stream);

const secs = 30;
console.log(`Automatically ending stream in ${secs} sec`);
setTimeout(() => {
    console.log('Ending stream!')
    stream.stop();
    console.log('Waiting ' + secs / 2 + ' more secs for stream to print final message(s)');
    setTimeout(() => {
        console.log('Script is over');
    }, secs * 500);
}, secs * 1000);