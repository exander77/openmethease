const pako = require('pako')
const fetch = require('node-fetch')
const DnaAnalyzer = require('./lib/analyzer').DnaAnalyzer
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

window.addEventListener('load', async event => { //{{{
    const logArea = document.getElementById('log')
    const log = console.log
    console.log = function() {
        logArea.value += '\n' + Array.prototype.join.call(arguments, ' ')
        logArea.scrollTop = logArea.scrollHeight
        log.apply(console, arguments)
    }
    logArea.value = 'Loading...'
    const dataFiles = ['Rsnum', 'Genotype', 'Genoset']
    const dataRequests = await Promise.all(dataFiles.map(e => fetch('data/' + e + '.json')))
    const [Rsnum, Genotype, Genoset] = await Promise.all(dataRequests.map(e => e.json()))
    const analyzer = new DnaAnalyzer(Rsnum, Genotype, Genoset)
    const fileInput = document.getElementById('file')
    //const outputArea = document.getElementById('output')
    console.log('Rsnum:', Rsnum.length)
    console.log('Genotype:', Genotype.length)
    console.log('Genoset:', Genoset.length)
    console.log('Loaded.')
    fileInput.disabled = false
    //outputArea.value = 'Output...'
    console.outputRsnum = function(rsid, genotype, magnitude, repute, summary, mergedRsid) {
        const outputBody = document.getElementById('RsnumTableBody')
        const Rs = 'Rs' + rsid
        const MergedRs = 'rs' + mergedRsid
        const Gs = '(' + genotype.join(';') + ')'
        genotype = genotype.join(';')
        const html = '<tr><td><a id="rs'+rsid+'">'
            + rsid +'</td><td></a>'
            + genotype.substr(0,11) + (genotype.length > 11 ? '...' : '') +'</td><td>'
            + (magnitude === undefined ? 'Undefined' : magnitude) + '</td><td>'
            + (repute === undefined ? 'Undefined' : repute) + '</td><td>'
            + (summary === undefined ? '' : summary) + (mergedRsid ? ' Merged with above: <a href="#' + MergedRs +'">#' + MergedRs + '</a>.' : '') + '</td><td>'
            + '<a target="blank" href="https://www.snpedia.com/index.php/' + Rs +'">' + Rs + '</a>'
            + '<a target="blank" href="https://www.snpedia.com/index.php/' + Rs + Gs + '">' + Gs.substr(0,6) + (Gs.length > 6 ? '...' : '') + '</a>'
            //+ (mergedRsid ? ', <a href="#' + MergedRs +'">#' + MergedRs + '</a>' : '')
            + '<td></tr>'
        outputBody.innerHTML += html
    }
    console.outputGenoset = function(gsid, magnitude, repute, summary) {
        const outputBody = document.getElementById('GenosetTableBody')
        const html = '<tr><td><a id="gs'+gsid+'">'
            + gsid +'</td><td></a>'
            + (magnitude === undefined ? 'Undefined' : magnitude) + '</td><td>'
            + (repute === undefined ? 'Undefined' : repute) + '</td><td>'
            + (summary === undefined ? '' : summary) + '</td><td>'
            + '<a target="blank" href="https://www.snpedia.com/index.php/Gs' + gsid +'">Gs' + gsid + '</a>'
            + '<td></tr>'
        
        outputBody.innerHTML += html
    }
    const searchFields = ['searchRsid', 'searchGenotype', 'searchMagnitude', 'searchRepute', 'searchSummary', 'searchSource']
    searchFields.forEach((e,j) => {
        const outputBody = document.getElementById('RsnumTablebody')
        const input = document.getElementById(e)
        input.addEventListener('change', event => {
            const rows = outputBody.getElementsByTagName('tr')
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i]
                let match = true
                searchFields.forEach((e,j) => {
                    if (!match) return
                    const input = document.getElementById(e)
                    const filter = input.value.toLowerCase()
                    if (!filter || filter.trim() == '') return
                    const td = row.getElementsByTagName("td")[j]
                    if (td) {
                        const txtValue = td.textContent || td.innerText
                        const c = filter[0]
                        if (c == '>') {
                            match &= txtValue.toLowerCase() > parseFloat(filter.substr(1))
                        } else if (c == '<') {
                            match &= txtValue.toLowerCase() < parseFloat(filter.substr(1))
                        } else if (c == '=') {
                            match &= txtValue.toLowerCase() == filter.substr(1)
                        } else if (c == '!') {
                            match &= txtValue.toLowerCase() != filter.substr(1)
                        } else if (c == '/') {
                            match &= txtValue.toLowerCase().match(new RegExp(filter.substr(1)))
                        } else {
                            match &= txtValue.toLowerCase().indexOf(filter) > -1
                        }
                    }
                });
                row.style.display = match ? "" : "none"
            }
        })
    })
    fileInput.addEventListener('change', async event => {
        fileInput.disabled = true
        const file = fileInput.files[0]
        const name = file.name.split(/(\\|\/)/g).pop()
        const ext = name.split('.').pop().toLowerCase()
        console.log('Input:', name, ext)
        const textReader = new LineReader(file)
        await analyzer.run(textReader, console.log)
        console.log('Done.')
    })

    const tablinks = document.getElementsByClassName("tablinks");
    for (let j = 0; j < tablinks.length; j++) {
        tablinks[j].addEventListener('click', event => {
            const tabcontent = document.getElementsByClassName("tabcontent");
            for (let i = 0; i < tabcontent.length; i++) {
                tabcontent[i].style.display = "none";
            }
            for (let i = 0; i < tablinks.length; i++) {
                tablinks[i].className = tablinks[i].className.replace(" active", "");
            }
            document.getElementById(event.currentTarget.id.split('Button')[0]).style.display = "table";
            event.currentTarget.className += " active";
        })
    }
    document.getElementById("RsnumTabButton").click();
});//}}}
