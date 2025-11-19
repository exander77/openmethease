const pako = require('pako')
const DnaAnalyzer = require('../lib/analyzer').DnaAnalyzer
const GzipInflate = pako.Inflate
const fs = require('fs')
const readline = require('readline')

const args = process.argv.slice(2)

const Rsnum = JSON.parse(fs.readFileSync('data/Rsnum.json'))
const RsnumI = JSON.parse(fs.readFileSync('data/RsnumI.json'))
const Genotype = JSON.parse(fs.readFileSync('data/Genotype.json'))
const GenotypeI = JSON.parse(fs.readFileSync('data/GenotypeI.json'))
const Genoset = JSON.parse(fs.readFileSync('data/Genoset.json'))
    
const analyzer = new DnaAnalyzer(Rsnum, RsnumI, Genotype, GenotypeI, Genoset)
console.outputRsnum = function(rsid, genotype, magnitude, repute, summary, mergedRsid) {
    const Rs = 'rs' + rsid
    const Gs = '(' + genotype.join(';') + ')'
    console.log(Rs + Gs)
}
console.outputGenoset = function(gsid, magnitude, repute, summary, output) {
    console.log('gs' + gsid)
    console.log('output' + output)
}

class LineReader {
    constructor(stream) {
        const self = this
        this.rl = readline.createInterface({input: stream})
        this.readLine = (function () {
            const getLineGen = (async function* () {
                for await (const line of self.rl) {
                    yield line;
                }
            })();
            return async () => ((await getLineGen.next()).value);
        })();
    }
    get endOfStream() { return false }
    get progress() { return -1 }
}

async function main() {
    const textReader = new LineReader(args[0] ? fs.createReadStream(args[0]) : process.stdin)
    await analyzer.run(textReader, console.error)
}

main()
