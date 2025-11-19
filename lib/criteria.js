const makeid = require('./common').makeid

function escape(html) {
     let returnText = html;
     returnText = returnText.replace(/</gi, "&lt;");
     returnText = returnText.replace(/>/gi, "&gt;");
     return returnText;
}

class Node {
    constructor(prefix) {
        //console.log(this, prefix)
        this.prefix = prefix
        this.suffix = []
    }
    setPrefix(value) {
        this.prefix = value
    }
    setSuffix(value) {
        this.suffix = value
    }
    eval(table) {
        return false  
    }
    output(table) {
        return ''
    }
    wrap(text, value) {
        let output = ''
        if (this.prefix.length) output += '<i class="black">' + escape(this.prefix.join('')) + '</i>'
        output += '<b class="' + (value ? 'green' : 'red') + '">' + text +'</b>'
        if (this.suffix.length) output += '<i class="black">' + escape(this.suffix.join('')) + '</i>'
        return output
    }
}

class Num extends Node {
    constructor(type, table, id, args, prefix) {
        super(prefix)
        this.type = type
        this.table = table
        this.id = id
        this.args = args
        this.table.add(this.type, this.id, this.args)
        this.cache = undefined
    }
    eval(table) {
        return this.cache !== undefined ? this.cache : this.table.eval(this.type, this.id, this.args)
    }
    output(table) {
        return this.wrap(makeid(this.type, this.id, this.args), this.eval(table))
    }
}

class RsNum extends Num {
    constructor(table, id, args, p) {
        super('rs', table, id, args, p)
    } 
}
class INum extends Num {
    constructor(table, id, args, p) {
        super('i', table, id, args, p)
    }
}
class DNum extends Num {
    constructor(table, id, args, p) {
        super('d', table, id, args, p)
    }
}
class GsNum extends Num {
    constructor(table, id, args, p) {
        super('gs', table, id, args, p)
    }
}

class Op extends Node {
    constructor(operands, prefix) {
        super(prefix)
        this.operands = operands 
    }
    add(e) {
        this.operands.push(e)
    }
    eval(table) {
    }
    output(table) {
    }
}

class Nop extends Node {
}

class Atleast extends Op {
    constructor(operands, count, prefix) {
        super(operands, prefix)
        this.count = count
     }
     eval(table) {
        //console.log(this.operands.map(e => e.eval(table)), this.operands.reduce((a, b) => a && !b.eval(table), true))
        const count = this.operands.reduce((a, b) => a + (b.eval(table) ? 1 : 0), 0)
        return count >= this.count
     }
    output(table) {
        return this.wrap('aleast('+this.count+','+this.operands.map(e => e.output(table)).join(', ')+')', this.eval(table))
    }
} 

class And extends Op {
    eval(table) {
        return this.operands.reduce((a, b) => a && b.eval(table), true)
    }
    output(table) {
        return this.wrap('and('+this.operands.map(e => e.output(table)).join(', ')+')', this.eval(table))
    }
}

class Or extends Op {
    eval(table) {
        return this.operands.reduce((a, b) => a || b.eval(table), false)
    }
    output(table) {
        return this.wrap('or('+this.operands.map(e => e.output(table)).join(', ')+')', this.eval(table))
    }
}

class Not extends Op {
    eval(table) {
        return this.operands.reduce((a, b) => a && !b.eval(table), true)
    }
    output(table) {
        return this.wrap('not('+this.operands.map(e => e.output(table)).join(', ')+')', this.eval(table))
    }
}

class Parser {
    constructor(table) {
        this.table = table
        this.prefixReset()
        this.prefixStatus = true
    }
    next(comment) {
        if (this.c !== undefined && comment) {
            this.prefixArray.push(this.c)
        }
        ++this.index
        this.c = this.input[this.index]
        //if (!this.c) throw 'Unexpected end of input on position: ' + this.index
        return true
    }
    prev() {
        --this.index
    }
    prefix(value) {
        if (value) this.prefixArray = value
        else return this.prefixArray
    }
    prefixReset() {
        this.prefix([])
    }
    lookahead() {
        return '"' + this.input.join('').substr(this.index) + '"'
    }
    consumeWS() {
        let found = false
        while (this.consumeHashComment() || this.consumeHtmlComment()) {}
        do {
            while (this.c && this.c.match(/\s/)) {
                found = true
                this.next(true)
            }
        } while (this.consumeHashComment() || this.consumeHtmlComment())
        return found
    }
    consumeHashComment() {
        if (!this.consumeCharacter('#', true)) return false
        while (!this.consumeCharacter('\n', true)) {
            this.next(true)
        }
        return true
    }
    consumeHtmlComment() {
        if (this.input[this.index+0] != '<') return false
        if (this.input[this.index+1] != '!') return false
        if (this.input[this.index+2] != '-') return false
        if (this.input[this.index+3] != '-') return false
        this.next(true); this.next(true); this.next(true); this.next(true);
        let s = 0;
        while (this.c && s != 3) {
            switch (s) {
                case 0:
                    if (this.c == '-') s++
                    break
                case 1:
                    if (this.c == '-') s++
                    else s=0
                    break
                case 2:
                    if (this.c == '>') s++;
                    else if (this.c != '-') s=0
                    break
            }
            this.next(true);
        }
        return s == 3
    }
    consumeCharacter(c, comment) {
        if (this.c == c) {
            this.next(comment)
            return true
        }
        return false
    }
    parseString() {
        let str = ''
        while (this.c && this.c.match(/[a-z]/i)) {
            str += this.c
            this.next()
        }
        return str
    }
    parseBasePairs() {
        let str = ''
        while (this.c.match(/[CGATDI-]/i)) {
            str += this.c
            this.next()
        }
        if (str.length < 1) throw 'Empty base pair: ' + this.lookahead()
        return str
    }
    parseNumber() {
        let num = 0
        while (this.c.match(/[0-9]/)) {
            num = num*10 + parseInt(this.c)
            this.next()
        }
        return num
    }
    parseArguments(callback, separator) {
        let args = []
        if (!this.consumeCharacter('(')) throw '( expected: ' + this.lookahead()
        do {
            this.consumeWS()
            if (this.c == ')') break
            args.push(callback())
            this.consumeWS()
        } while (this.consumeCharacter(separator))
        if (!this.consumeCharacter(')')) throw ') expected: ' + this.lookahead() 
        return args
    }
    parseExpression() {
        this.consumeWS()
        let prefix = this.prefix()
        this.prefixReset()
        let str = this.parseString()
        switch (str) {
            case 'and':
                return new And(this.parseArguments(this.parseExpression.bind(this), ','), prefix)
            case 'or':
                return new Or(this.parseArguments(this.parseExpression.bind(this), ','), prefix)
            case 'not':
                return new Not(this.parseArguments(this.parseExpression.bind(this), ','), prefix)
            case 'rs':
                return new RsNum(this.table, this.parseNumber(), this.parseArguments(this.parseBasePairs.bind(this), ';'), prefix)
            case 'i':
                return new INum(this.table, this.parseNumber(), this.parseArguments(this.parseBasePairs.bind(this), ';'), prefix)
            case 'd':
                return new DNum(this.table, this.parseNumber(), this.parseArguments(this.parseBasePairs.bind(this), ';'), prefix)
            case 'gs':
                return new GsNum(this.table, this.parseNumber(), null, prefix)
            case 'atleast':
                if (!this.consumeCharacter('(')) throw '( expected: ' + this.lookahead()
                const count = this.parseNumber()
                this.consumeWS()
                this.consumeCharacter(',')
                this.consumeWS()
                this.prev()
                this.c = '('
                return new Atleast(this.parseArguments(this.parseExpression.bind(this), ','), count, prefix)
        }
        throw 'Unknown string: ' + str + ', ' + this.lookahead()
    }
    parse(input) {
        this.input = [...input]
        this.index = 0
        this.c = this.input[this.index]
        if (!this.c) return new Nop(this.prefix())
        this.consumeWS()
        if (!this.c) return new Nop(this.prefix())
        const expression = this.parseExpression()
        this.prefixReset()
        this.consumeWS()
        expression.input = escape(input)
        expression.setSuffix(this.prefix())
        return expression
    }
}

class Table {
    table = {}
    missing = {}
    add(type, id, vars) {
        this.table[makeid(type, id, vars)] = false
        //if (type == 'rs') this.missing[makeid(type, id)] = true
    }
    eval(type, id, vars) {
        const rs = makeid(type, id)
        //if (type == 'rs' && this.missing[rs]) throw "Missing: " + rs
        return this.table[makeid(type, id, vars)]
    }
    get length() {
        return Object.keys(this.table).length
    }
    set(type, id, vars, value) {
        //if (type == 'rs') this.missing[makeid(type, id)] = false
        const key = makeid(type, id, vars)
        if (vars) {
            if (this.table[key] !== undefined) {
                this.table[key] = value
            }
            vars.forEach(e => {
                const key = type + id + '(' + e + ')'
                if (this.table[key] !== undefined) {
                    this.table[key] = value
                }
            })
        } else {
            if (this.table[key] !== undefined) {
                this.table[key] = value
            }
        }
    }
}

module.exports.Parser = Parser
module.exports.Table = Table
