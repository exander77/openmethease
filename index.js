const DnaAnalyzer = require('./lib/analyzer').DnaAnalyzer
const LineReader = require('./lib/linereader').LineReader

const fetch = require('node-fetch')

window.addEventListener('load', async event => { //{{{
    const logArea = document.getElementById('log')
    const log = console.log
    console.log = function() {
        logArea.value += '\n' + Array.prototype.join.call(arguments, ' ')
        logArea.scrollTop = logArea.scrollHeight
        log.apply(console, arguments)
    }
    logArea.value = 'Loading...'
    const dataFiles = ['Rsnum', 'RsnumI', 'Genotype', 'GenotypeI', 'Genoset', 'Medicine']
    const dataRequests = await Promise.all(dataFiles.map(e => fetch('data/' + e + '.json')))
    const [Rsnum, RsnumI, Genotype, GenotypeI, Genoset, Medicine] = await Promise.all(dataRequests.map(e => e.json()))
    const MedicineIndex = {}
    const NumMedicineIndex = {}
    Medicine.forEach(e => {
        MedicineIndex[e.id] = e
        e.criteria.forEach(f => {
            if (!NumMedicineIndex[f]) {
                NumMedicineIndex[f] = [e.id]
            } else {
                NumMedicineIndex[f].push(e.id)
            }
        })
    })
    const analyzer = new DnaAnalyzer(Rsnum, RsnumI, Genotype, GenotypeI, Genoset)
    const fileInput = document.getElementById('file')
    //const outputArea = document.getElementById('output')
    console.log('Rsnum:', Rsnum.length)
    console.log('RsnumI:', RsnumI.length)
    console.log('Genotype:', Genotype.length)
    console.log('GenotypeI:', GenotypeI.length)
    console.log('Genoset:', Genoset.length)
    console.log('Medicine:', Medicine.length)
    console.log('Loaded.')
    fileInput.disabled = false
    //outputArea.value = 'Output...'
    
    console.outputRsnum = function(rsid, genotype, magnitude, repute, summary, mergedRsid) {
        const outputBody = document.getElementById('RsnumTableBody')
        const Rs = 'rs' + rsid
        const MergedRs = 'rs' + mergedRsid
        const Gs = '(' + genotype.join(';') + ')'
        genotype = genotype.join(';')
        const html = '<tr><td><a id="' + Rs +'">'
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
        
        /*if (rsid == 15793179) {
            outputBody.innerHTML += "Dedly mutation for chickens detected. Do not worry unless you are a chicken!"
        }*/
        if (NumMedicineIndex[Rs]) {
            const outputBodyPharm = document.getElementById('PharmacogeneticsTableBody')
            NumMedicineIndex[Rs].forEach(e => {
                const html = '<tr><td>'
                    + '<a target="blank" href="https://www.snpedia.com/index.php/' + e + '">' + e + '</a></td><td>'
                    + (magnitude === undefined ? 'Undefined' : magnitude) + '</td><td>'
                    + (repute === undefined ? 'Undefined' : repute) + '</td><td>'
                    + (summary === undefined ? '' : summary) + (mergedRsid ? ' Merged with above: <a href="#' + MergedRs +'">#' + MergedRs + '</a>.' : '') + '</td><td>'
                    + '<a target="blank" href="https://www.snpedia.com/index.php/' + Rs +'">' + Rs + '</a>'
                    + '<a target="blank" href="https://www.snpedia.com/index.php/' + Rs + Gs + '">' + Gs.substr(0,6) + (Gs.length > 6 ? '...' : '') + '</a>'
                    + '<td></tr>'
                outputBodyPharm.innerHTML += html
            })
        }
    }

    console.outputGenoset = function(gsid, magnitude, repute, summary, output) {
        const outputBody = document.getElementById('GenosetTableBody')
        const Gs = 'gs' + gsid
        const html = '<tr><td><a id="' + Gs + '">'
            + gsid +'</td><td></a>'
            + (magnitude === undefined ? 'Undefined' : magnitude) + '</td><td>'
            + (repute === undefined ? 'Undefined' : repute) + '</td><td>'
            + (summary === undefined ? '' : summary) + '<h3>Criteria:</h3><pre>' + output + '</pre></td><td>'
            + '<a target="blank" href="https://www.snpedia.com/index.php/' + Gs + '">' + Gs + '</a>'
            + '<td></tr>'
        
        outputBody.innerHTML += html
        
        if (NumMedicineIndex[Gs]) {
            const outputBodyPharm = document.getElementById('PharmacogeneticsTableBody')
            NumMedicineIndex[Gs].forEach(e => {
                const html = '<tr><td>'
                    + '<a target="blank" href="https://www.snpedia.com/index.php/' + e + '">' + e + '</a></td><td>'
                    + (magnitude === undefined ? 'Undefined' : magnitude) + '</td><td>'
                    + (repute === undefined ? 'Undefined' : repute) + '</td><td>'
                    + (summary === undefined ? '' : summary) + '<h3>Criteria:</h3><pre>' + output + '</pre></td><td>'
                    + '<a target="blank" href="https://www.snpedia.com/index.php/' + Gs + '">' + Gs + '</a>'
                    + '<td></tr>'
                outputBodyPharm.innerHTML += html
            })
        }
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
