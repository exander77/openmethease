const Criteria = require('./criteria')

class Detector {
    process(chr, pos, ref, vars, genotype) {

    }
}

class GsDetector {
    detectors = []
    constructor(Genoset) {
        this.Genoset = Genoset
        this.Table = new Criteria.Table()
        this.Parser = new Criteria.Parser(this.Table)
        this.GenosetIndex = {}
        this.Genoset.forEach(e => {
            this.GenosetIndex[e.gsid] = e
        })
        this.Genoset.forEach(e => {
            e.parsed = this.Parser.parse(e.criteria)
        })
    }
    process(type, id, vars) {
        this.Table.set(type, id, vars, true)
    }
    eval() {
        this.Genoset.slice(0).reverse().forEach(e => {
            try {
                const value = e.parsed.eval(this.table)
                if (value) {
                    this.process('gs', e.gsid)
                    console.outputGenoset(e.gsid, e.magnitude, e.repute, e.summary, e.parsed.output(this.table))
                }
            } catch (e) {
                console.error('Criterium', e.gsid, 'cannot be evaluted:', e)
            }
        })
        //console.log(this.Table)
    }
}

class RsDetector {
    detectors = []
    constructor(Rsnum, Genotype, Genoset) {
        this.Rsnum = Rsnum
        this.Genotype = Genotype
        this.Genoset = Genoset
        
        this.Chromosomes = {}

        this.RsnumIndex = {}
        this.RsnumMerges = {}
        this.RsnumGenotype = {}
        this.RsnumChrPosIndex = {}
        this.Rsnum.forEach(e => {
            if (e.chromosome == undefined) return
            if (e.position == undefined) return
            e.position = parseInt(e.position)
            this.RsnumIndex[e.rsid] = e
            if (!this.Chromosomes[e.chromosome]) {
                this.Chromosomes[e.chromosome] = [e.position]
            } else {
                this.Chromosomes[e.chromosome].push(e.position)
            }
            const id = e.chromosome+'@'+e.position
            if (e.merged) {
                let merges = this.RsnumMerges[e.merged]
                if (!merges) this.RsnumMerges[e.merged] = merges = [e.rsid]
                else merges.push(e.rsid)
            }
            if (!this.RsnumChrPosIndex[id]) this.RsnumChrPosIndex[id] = e
        })
        Object.keys(this.Chromosomes).forEach(e => this.Chromosomes[e].sort((a,b) => a - b))
        this.GenotypeIndex = {}
        this.Genotype.forEach(e => {
            if (e.allele1 == undefined) return
            if (e.allele2 == undefined) return
            const genotype = [e.allele1, e.allele2]
            this.GenotypeIndex[(e.type ? e.type : 'rs') + e.rsid + '(' + genotype.join(';') + ')'] = e
            let tmp = this.RsnumGenotype[e.rsid]
            if (!tmp) this.RsnumGenotype[e.rsid] = tmp = [genotype]
            else tmp.push(genotype)
        })

        this.detectors.push(new GsDetector(Genoset))
    }
    process(chr, pos, rsa, ref, vars, genotype) {
        function flip(g) { return g.map(function(e) {
          if (e.length > 1) return flip(e.split('')).join('');
          return {'C':'G','G':'C','A':'T','T':'A','-':'-'}[e]
        }).map(e => [...e].reverse().join(''))}
        function makeid(type, id, vars) {
          return type + id + (vars ? '(' + vars.sort().join(';') + ')' : '')
        }

        //console.log('process', chr, pos, ref, vars, genotype)
        
        //geno1
        //if (vars[0] == '<NON_REF>') return
        const id = chr + '@' + pos
/*
A Single Nucleotide Variant : rs268
chr8         19813529   rs268   A    G    .    .       RS=268;...
NG_008855.1  21948      rs268   A    G    .    .       RS=268;...
NM_000237.2  953        rs268   A    G    .    .       RS=268;...

An Insertion Variant : rs9281300
NC_000006.11 31239170  rs9281300  C  CA  .  .  RS=9281300;...
NG_029422.2  5738      rs9281300  C  CA  .  .  RS=9281300;...

A Deletion Variant : rs1799758
NC_000016.9  2138199 rs1799758   GTGAG   G  .   .  RS=1799758;...
NG_005895.1  43893   rs1799758   GTGAG   G  .   .  RS=1799758;...
*/
        /*function ref2genotype(rsSNP, ref) {
            const genotypes = this.RsnumGenotype[rsSNP.rsid]
            let genotype = ['-','-']
            genotypes.forEach(e => {
                if (e[0] == ref 
            })
            return genotype
        }*/
        let rsSNP = this.RsnumChrPosIndex[id]
        if (!rsSNP) return
        while (rsSNP.merged) {
            const tmp =  this.RsnumIndex[rsSNP.merged]
            if (!tmp) break 
            rsSNP = tmp 
        }
        let gtSNP = null
        /*if (!rsSNP.geno1) { // TODO: not true Rs886703882, lookup gsid
            const tmp = this.RsnumGenotype[rsSNP.rsid]
            if (!tmp) genotype = ['-','-']
            else genotype = tmp[0]
        } else */
        if (!vars) {
            // Getting reference
            if (rsSNP.referenceallele) {
                genotype = [rsSNP.referenceallele, rsSNP.referenceallele] 
                /*if (rsSNP.orientation == 'minus') {
                    genotype = flip(genotype)
                }*/
            }
            else if (rsSNP.clinvar && rsSNP.clinvar.ref) {
                genotype = [rsSNP.clinvar.ref, rsSNP.clinvar.ref] 
                if (rsSNP.clinvar.reversed > 0) {
                    genotype = flip(genotype)
                }
            }
            else if (rsSNP.geno1) {
                // Search for 0 magnitude
                const missing = []
                let nomags = [rsSNP.geno1, rsSNP.geno2, rsSNP.geno3].filter((e) => {
                    const gsid = makeid('rs', rsSNP.rsid) + e
                    let gtSNP = this.GenotypeIndex[gsid]
                    if (gtSNP) {
                        while (gtSNP.redirect) {
                            const tmp =  this.GenotypeIndex[gtSNP.redirect]
                            if (!tmp) break 
                            gtSNP = tmp 
                        }
                        return gtSNP.magnitude === undefined || parseFloat(gtSNP.magnitude)<=0
                    }
                    missing.push(e)
                    return false
                })
                if (!nomags.length) {
                    if (!missing.length) {
                        console.error('No no magnitude found for:', rsSNP.rsid)
                        return
                    } nomags = missing
                }

                if (nomags.length > 1) {
                    //console.error('Multiple no magnitude found for:', rsSNP.rsid, nomags.length)
                    return
                }
                let nomag = nomags[0]
                genotype = nomag.substr(1,nomag.length-2).split(';')
            } else genotype = ['-','-']
        } else if (rsSNP.orientation == 'minus') {
            // if minus then flip and reverse genotype
            genotype = flip(genotype)
        }
        const gsid = makeid('rs', rsSNP.rsid, genotype)
        gtSNP = this.GenotypeIndex[gsid]
        if (gtSNP) {
            while (gtSNP.redirect) {
                const tmp =  this.GenotypeIndex[gtSNP.redirect]
                if (!tmp) break 
                gtSNP = tmp 
            }
        } else {
            // Ambiguous flip
            /*const genotype_flipped = flip(genotype)
            const gsid = makeid('rs', rsSNP.rsid, genotype_flipped)
            gtSNP = this.GenotypeIndex[gsid]
            if (gtSNP) {
                console.error('Ambiguous flip:', gsid)
                while (gtSNP.redirect) {
                    const tmp =  this.GenotypeIndex[gtSNP.redirect]
                    if (!tmp) break 
                    gtSNP = tmp 
                }
                genotype = genotype_flipped
            } else {*/
                //TODO: supress gtSNP
                gtSNP = {
                    summary: 'Missing GsNum on SNPedia.'
                }
            //}
        }
        if (gtSNP.magnitude !== undefined && gtSNP.magnitude.trim() == '') gtSNP.magnitude = undefined
        //TODO: supress low magnitude
        let report = true
        if (gtSNP.magnitude === undefined || parseFloat(gtSNP.magnitude) <= 0) 
            report = false
            if (gtSNP.repute != 'Good' && gtSNP.repute != 'Bad')
                report = false

        //report = true

        //TODO: simplify

        this.detectors.forEach(f => f.process('rs', rsSNP.rsid, genotype))
        if (report) console.outputRsnum(rsSNP.rsid, genotype, gtSNP.magnitude, gtSNP.repute, gtSNP.summary)
        if (this.RsnumMerges[rsSNP.rsid]) this.RsnumMerges[rsSNP.rsid].forEach(e => {
            if (rsSNP.rsid != e) {
                this.detectors.forEach(f => f.process('rs', e, genotype))
                if (report) console.outputRsnum(e, genotype, gtSNP.magnitude, gtSNP.repute, gtSNP.summary, rsSNP.rsid)
            }
        });
        
        /*if (vars[0] == '<NON_REF>') {
            let rsSNP = this.RsnumChrPosIndex[id]
            if (!rsSNP) return
            if (!rsSNP.g1 || rsSNP.g1.indexOf('-') < 0) return
            genotype = rsSNP.g1.substr(1,rsSNP.g1.length-2).split(';')
            const gsid = 'rs' + rsSNP.rsid + '(' + genotype.sort().join(';') + ')'
            let gtSNP = this.GenotypeIndex[gsid]
            if (!gtSNP) return 
            while (gtSNP.redirect) gtSNP = this.GenotypeIndex[gtSNP.redirect]
            console.outputRsnum(gtSNP.rsid, genotype.sort(), gtSNP.magnitude, gtSNP.repute, gtSNP.summary)
        } else {
            let rsSNP = this.RsnumChrPosIndex[id]
            if (!rsSNP) continue
            if (rsSNP.orientation == 'minus') genotype = flip(genotype)
            const gsid = 'rs' + rsSNP.rsid + '(' + genotype.sort().join(';') + ')'
            let gtSNP = this.GenotypeIndex[gsid]
            if (!gtSNP) continue
            while (gtSNP.redirect) gtSNP = this.GenotypeIndex[gtSNP.redirect]
            console.output(gtSNP.rsid, genotype.sort(), gtSNP.magnitude, gtSNP.repute, gtSNP.summary)
            //console.log('rs' + rsSNP.rsid + '(' + genotype.sort().join(';') + ')', gtSNP.magnitude, gtSNP.repute)
            for (let i=0;i<rsa.length;++i) {
                let rs = rsa[i]
                let rsSNP = null
                if (!rs) {
                    if (rsSNP) {
                        rs = rsSNP.rs
                    } else continue
                } else {
                    rsSNP = this.RsnumIndex[rs]
                }
                if (!rsSNP) continue
                if (rsSNP.orientation == 'minus') genotype = flip(genotype)
                const gsid = 'rs' + rsSNP.rsid + '(' + genotype.sort().join(';') + ')'
                let gtSNP = this.GenotypeIndex[gsid]
                if (!gtSNP) continue
                while (gtSNP.redirect) gtSNP = this.GenotypeIndex[gtSNP.redirect]
                console.output(gtSNP.rsid, genotype.sort(), gtSNP.magnitude, gtSNP.repute, gtSNP.summary)
                //console.log('rs' + rsSNP.rsid + '(' + genotype.sort().join(';') + ')', gtSNP.magnitude, gtSNP.repute)
            }
        }*/
    }
    eval() {
        this.detectors.forEach(f => f.eval())
    }
}

class DnaAnalyzer {
    detectors = []
    constructor(Rsnum, Genotype, Genoset) {
        this.Rsnum = Rsnum
        this.Genotype = Genotype
        this.Genoset = Genoset
        this.RsDetector = new RsDetector(Rsnum, Genotype, Genoset)
        this.Chromosomes = this.RsDetector.Chromosomes
        this.detectors.push(this.RsDetector)
    }
    async run(textReader, log) {
        let count = 0
       
        let chrindex = '0'
        let iindex = null

        while (!textReader.endOfStream) {
            count++
            const line = await textReader.readLine()
            if (!line) break
            if (line[0] == '#') continue
            const data = line.split('\t')
            let pos = parseInt(data[1])
            const chr = data[0].replace(/^chr/,'')
            if (chr != chrindex) {
                chrindex = chr
                iindex = 0
            }
            const ref = data[3]
            const vars = data[4].split(',')


            // Search index            
            let posindex = this.Chromosomes[chr][iindex]
            //console.log(chr, pos, posindex)
            if (vars[0] == '<NON_REF>') { // This is reference
                const endpos = parseInt(data[7].split('=')[1])
                while (posindex < pos) {
                    posindex = this.Chromosomes[chr][++iindex]
                }
                if (posindex == pos) this.process(chr, posindex, ref) 
                while (pos < posindex && posindex <= endpos) {
                    this.process(chr, posindex)
                    posindex = this.Chromosomes[chr][++iindex]
                }
                continue
            } else { // This is change againts reference
                //if (pos < posindex) continue // Report Unknown
                while (posindex < pos) {
                    posindex = this.Chromosomes[chr][++iindex]
                }
            }

            const rsa = []
            /*const rsa = data[2].split(';').map(e => {
                if (e == '') return null
                if (e == '.') return null
                if (!e) return null
                return e.replace(/^rs/i,'')
            })*/
            const gt_index = data[8].split(':').indexOf('GT')
            const bases = [ref].concat(data[4].replace(',<NON_REF>','').split(','))
            let genotype = []
            const base_indexes = data[9].split(':')[gt_index].replace('|', '/').split('/')

            let valid = true
            //let has_ref = false
            //let nonref_index = 1
            for (let i=0;i<base_indexes.length;++i) {
                let base_index = base_indexes[i]
                if (base_index == '.') {
                    valid = false
                    break
                }
                base_index = parseInt(base_index)
                //if (!base_index) has_ref = true
                //else nonref_index = base_index
                const base = bases[base_index]
                if (!base) {
                    valid = false
                    break
                }
                //Example: CTT,C 0/1 - needs pos incrementation
                if (base_index == 0 && base.length > 1) pos++
                genotype.push(base)
            }
            if (!valid) continue

            /*if (has_ref) {
                console.log(pos)
                let i = 0
                while (bases[0][i] == bases[nonref_index][i]) {pos++; i++}
            }*/

            try {
                this.process(chr, pos, rsa, ref, vars, genotype)
            } catch (e) {
                console.error('Unexpected error occured:', e)
            }
            /*if (vars[0] == '<NON_REF>') {
                const endpos = parseInt(data[7].split('=')[1])
                while (pos != endpos) {
                    pos++
                    this.process(chr, pos)
                }
            }*/

            if (count % 500000 == 1) {
                const progress = textReader.progress
                if (progress != -1)
                log('Status:', (progress*100).toFixed(2).padStart(5), '%', chr + '@' + data[1]);
            }
        }
        log('Lines:', count)
        this.eval()
    }
    process(chr, pos, rsa, ref, vars, genotype) {
        this.detectors.forEach(f => f.process(chr, pos, rsa, ref, vars, genotype))
    }
    eval() {
        this.detectors.forEach(f => f.eval())
    }
}

module.exports.DnaAnalyzer = DnaAnalyzer
