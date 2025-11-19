const pako = require('pako')
const GzipInflate = pako.Inflate

class TextInflate { //{{{
    push(data, end) {
        this.onData(new Uint8Array(data));
        if (end) this.onEnd(); 
    }
}//}}}

class LineReader {//{{{
    CHUNK_SIZE = 1024000;
    position = 0;
    length = 0;

    byteBuffer = new Uint8Array(0);

    lines = [];
    lineCount = 0;
    lineIndexTracker = 0;

    fileReader = new FileReader();
    textDecoder = new TextDecoder('utf8');

    get position() { return this.position }
    
    get length() { return this.length }
    
    get progress() { return this.position/this.length }

    get allCachedLinesAreDispatched() {
        return !(this.lineIndexTracker < this.lineCount);
    }

    get blobIsReadInFull() {
        return !(this.position < this.length);
    }

    get bufferIsEmpty() {
        return this.byteBuffer.length === 0;
    }

    get endOfStream() {
        return this.blobIsReadInFull && this.allCachedLinesAreDispatched && this.bufferIsEmpty;
    }

    constructor(blob) {
        const self = this;
        this.blob = blob;
        this.length = blob.size;
        const name = this.blob.name.split(/(\\|\/)/g).pop();
        const ext = name.split('.').pop().toLowerCase();
        switch (ext) {
            case 'gz':
                this.inflator = new GzipInflate({chunkSize:this.CHUNK_SIZE});
                break
            default:
                this.inflator = new TextInflate({chunkSize:this.CHUNK_SIZE});
                break
        }
        this.inflator.onData = function (chunk) {
            let tempByteBuffer = new Uint8Array(self.byteBuffer.length + chunk.byteLength);
            tempByteBuffer.set(self.byteBuffer);
            tempByteBuffer.set(chunk, self.byteBuffer.length);
            self.byteBuffer = tempByteBuffer;
        };
        this.inflator.onEnd = function (status) {
              this.err = status;
              this.msg = this.strm.msg;
              console.error('Error:', this.err, this.msg)
        };
    }

    blob2arrayBuffer(blob) {
        return new Promise((resolve, reject) => {
            this.fileReader.onerror = reject;
            this.fileReader.onload = () => {
                resolve(this.fileReader.result);
            };

            this.fileReader.readAsArrayBuffer(blob);
        });
    }

    read(offset, count) {
        return new Promise(async (resolve, reject) => {
            if (!Number.isInteger(offset) || !Number.isInteger(count) || count < 1 || offset < 0 || offset > this.length - 1) {
                resolve(new ArrayBuffer(0));
                return
            }

            let endIndex = offset + count;

            if (endIndex > this.length) endIndex = this.length;

            let blobSlice = this.blob.slice(offset, endIndex);

            resolve(await this.blob2arrayBuffer(blobSlice));
        });
    }

    readLine() {
        return new Promise(async (resolve, reject) => {

            if (!this.allCachedLinesAreDispatched) {
                resolve(this.lines[this.lineIndexTracker++] + '\n');
                return;
            }

            while (!this.blobIsReadInFull) {
                let chunk = await this.read(this.position, this.CHUNK_SIZE);
                this.position += chunk.byteLength;
            
                this.inflator.push(chunk);
                
                let lastIndexOfLineFeedCharacter = this.byteBuffer.lastIndexOf(10); // LINE FEED CHARACTER (\n) IS ONE BYTE LONG IN UTF-8 AND IS 10 IN ITS DECIMAL FORM

                if (lastIndexOfLineFeedCharacter > -1) {
                    let lines = this.textDecoder.decode(this.byteBuffer).split('\n');
                    this.byteBuffer = this.byteBuffer.slice(lastIndexOfLineFeedCharacter + 1);

                    let firstLine = lines[0];

                    this.lines = lines.slice(1, lines.length - 1);
                    this.lineCount = this.lines.length;
                    this.lineIndexTracker = 0;

                    resolve(firstLine + '\n');
                    return;
                }
            }
            
            this.inflator.push(new Uint8Array(), true);

            if (!this.bufferIsEmpty) {
                let line = this.textDecoder.decode(this.byteBuffer);
                this.byteBuffer = new Uint8Array(0);
                resolve(line);
                return;
            }

            resolve(null);
        });
    }
}//}}}

module.exports.LineReader = LineReader
