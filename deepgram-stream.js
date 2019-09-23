const Duplex = require('stream').Duplex;
const util = require('util');
const W3CWebSocket = require('websocket').w3cwebsocket;



/**
 * pipe()-able Node.js Readable/Writeable stream - accepts binary audio and emits text in it's `data` events.
 * Also emits `results` events with interim results and other data.
 *
 * Cannot be instantiated directly, instead reated by calling #createRecognizeStream()
 *
 * Uses WebSockets under the hood. For audio with no recognizable speech, no `data` events are emitted.
 * @param {Object} options
 * @constructor
 */
function RecognizeStream(options) {
    Duplex.call(this, options);
    this.options = options;
    this.listening = false;
    this.initialized = false;
}
util.inherits(RecognizeStream, Duplex);

RecognizeStream.prototype.initialize = function () {
    const options = this.options;

    const url = options.url;
    const closingMessage = '';

    const socket = new W3CWebSocket(url, null, null, options.headers, null);
    this.socket = socket;

    // when the input stops, let the service know that we're done
    this.on('finish', () => {
        console.log('[Dg] finish');
        if (this.socket && this.socket.readyState === W3CWebSocket.OPEN) {
            this.socket.send(closingMessage);
        } else {
            this.once('connect', () => {
                console.log('[Dg] got connect');
                this.socket.send(closingMessage);
            });
        }
    });

    socket.onerror = (error) => {
        console.log('[Dg] got err');
        this.listening = false;
        this.emit('error', error);
    };

    this.socket.onopen = () => {
        console.log('[Dg] sent opening data');
        this.emit('connect');
        this.listening = true;
        this.emit('listening');
    };

    this.socket.onclose = (e) => {
        console.log('[Dg] onclose');
        this.listening = false;
        this.push('');

        /**
         * @event RecognizeStream#close
         * @param {Number} reasonCode
         * @param {String} description
         */
        this.emit('close', e.code, e.reason);
    };

    /**
     * @event RecognizeStream#error
     */
    const emitError = (msg, frame, err) => {
        if (err) {
            err.message = msg + ' ' + err.message;
        } else {
            err = new Error(msg);
        }
        err.raw = frame;
        this.emit('error', err);
    }

    socket.onmessage = (frame) => {
        console.log(frame);
        if (typeof frame.data !== 'string') {
            return emitError('Unexpected binary data received from server', frame);
        }

        let data;
        try {
            data = JSON.parse(frame.data);
        } catch (jsonEx) {
            return emitError('Invalid JSON received from service:', frame, jsonEx);
        }

        if (!data) throw new Error('Invalid JSON received from service');

        console.log({ data });

        let recognized = false;
        if (data.error) {
            emitError(data.error, frame);
            recognized = true;
        }

        if (data.TRANSCRIPT || data.type === 'connected') {
            // this is emitted both when the server is ready for audio
            if (!this.listening) {
                this.listening = true;
                this.emit('listening');
            }
            recognized = true;
        }

        if (data.TRANSCRIPT) {

            /**
             * Object with interim or final results, including possible alternatives. May have no results at all for empty audio files.
             * @event RecognizeStream#results
             * @param {Object} results
             */
            this.emit('results', data.TRANSCRIPT);
            // note: currently there is always either no entries or exactly 1 entry in the results array. However, this may change in the future.
            if (data.IS_FINAL) {

                /**
                 * Finalized text
                 * @event RecognizeStream#data
                 * @param {String} transcript
                 */

                // [{type, value, ts, end_ts, confidence}]
                this.emit('data', [{ value: data.TRANSCRIPT, confidence: data.CONFIDENCE, channel: data.CHANNEL }]);
            }
            recognized = true;
        }

        if (!recognized) {
            emitError('Unrecognised message from server', frame);
        }
    };

    this.initialized = true;
};

RecognizeStream.prototype._read = function () /* size*/ {
    // there's no easy way to control reads from the underlying library
    // so, the best we can do here is a no-op
};

RecognizeStream.prototype._write = function (chunk, encoding, callback) {
    // console.log(`writing. listening: ${this.listening} initialized: ${this.initialized}`);
    if (this.listening) {
        this.socket.send(chunk);
        this.afterSend(callback);
    } else {
        if (!this.initialized) {
            this.initialize();
        }
        this.once('listening', () => {
            console.log('[Dg] listening')
            this.socket.send(chunk);
            this.afterSend(callback);
        });
    }
};

// flow control - don't ask for more data until we've finished what we have
// todo: see if this can be improved
RecognizeStream.prototype.afterSend = function (next) {
    // note: bufferedAmount is currently always 0
    // see https://github.com/theturtle32/WebSocket-Node/issues/243
    if (this.socket.bufferedAmount <= (this._writableState.highWaterMark || 0)) {
        process.nextTick(next);
    } else {
        setTimeout(this.afterSend.bind(this, next), 10);
    }
};

RecognizeStream.prototype.stop = function () {
    console.log('[Dg] stop');
    this.emit('stopping');
    if (this.listening) {
        this.socket.send('');
        this.listening = false;
    }
    this.socket.close();
};

module.exports = RecognizeStream;