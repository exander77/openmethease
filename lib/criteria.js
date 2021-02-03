class Num {
    constructor(type, table, id, args) {
        this.type = type
        this.table = table
        this.id = id
        this.args = args
        this.table.add(this.type, this.id, this.args)
    }
    eval(table) {
        return this.table.eval(this.type, this.id, this.args)
    }
}

class RsNum extends Num {
    constructor(table, id, args) {
        super('rs', table, id, args)
    } 
}
class INum extends Num {
    constructor(table, id, args) {
        super('i', table, id, args)
    }
}
class DNum extends Num {
    constructor(table, id, args) {
        super('d', table, id, args)
    }
}
class GsNum extends Num {
    constructor(table, id, args) {
        super('gs', table, id, args)
    }
}

class Op {
    constructor(operands) {
        this.operands = operands 
    }
    add(e) {
        this.operands.push(e)
    }
    eval(table) {
    }
}

class Nop {
    eval(table) {
        return false  
    }
}

class Atleast extends Op {
    constructor(operands, count) {
        super(operands)
        this.count = count
     }
     eval(table) {
        //console.log(this.operands.map(e => e.eval(table)), this.operands.reduce((a, b) => a && !b.eval(table), true))
        const count = this.operands.reduce((a, b) => a + (b.eval(table) ? 1 : 0), 0)
        return count >= this.count
     }
} 

class And extends Op {
    eval(table) {
        return this.operands.reduce((a, b) => a && b.eval(table), true)
    }
}

class Or extends Op {
    eval(table) {
        return this.operands.reduce((a, b) => a || b.eval(table), false)
    }
}

class Not extends Op {
    eval(table) {
        return this.operands.reduce((a, b) => a && !b.eval(table), true)
    }
}

class Parser {
    constructor(table) {
        this.table = table
    }
    next() {
        ++this.index;
        this.c = this.input[this.index]
        //if (!this.c) throw 'Unexpected end of input on position: ' + this.index
        return true
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
                this.next()
            }
        } while (this.consumeHashComment() || this.consumeHtmlComment())
        return found
    }
    consumeHashComment() {
        if (!this.consumeCharacter('#')) return false
        while (!this.consumeCharacter('\n')) {
            this.next()
        }
        return true
    }
    consumeHtmlComment() {
        if (this.input[this.index+0] != '<') return false
        if (this.input[this.index+1] != '!') return false
        if (this.input[this.index+2] != '-') return false
        if (this.input[this.index+3] != '-') return false
        this.next(); this.next(); this.next(); this.next();
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
            this.next();
        }
        return s == 3
    }
    consumeCharacter(c) {
        if (this.c == c) {
            this.next()
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
        let str = this.parseString()
        switch (str) {
            case 'and':
                return new And(this.parseArguments(this.parseExpression.bind(this), ','))
            case 'or':
                return new Or(this.parseArguments(this.parseExpression.bind(this), ','))
            case 'not':
                return new Not(this.parseArguments(this.parseExpression.bind(this), ','))
            case 'rs':
                return new RsNum(this.table, this.parseNumber(), this.parseArguments(this.parseBasePairs.bind(this), ';'))
            case 'i':
                return new INum(this.table, this.parseNumber(), this.parseArguments(this.parseBasePairs.bind(this), ';'))
            case 'd':
                return new DNum(this.table, this.parseNumber(), this.parseArguments(this.parseBasePairs.bind(this), ';'))
            case 'gs':
                return new GsNum(this.table, this.parseNumber())
            case 'atleast':
                if (!this.consumeCharacter('(')) throw '( expected: ' + this.lookahead()
                const count = this.parseNumber()
                this.consumeWS()
                this.consumeCharacter(',')
                this.consumeWS()
                --this.index
                this.c = '('
                return new Atleast(this.parseArguments(this.parseExpression.bind(this), ','), count)
        }
        throw 'Unknown string: ' + str + ', ' + this.lookahead()
    }
    parse(input) {
        this.input = [...input]
        this.index = 0
        this.c = this.input[this.index]
        if (!this.c) return new Nop()
        this.consumeWS()
        if (!this.c) return new Nop()
        return this.parseExpression()
    }
}

function makeid(type, id, vars) {
    return type + id + (vars ? '(' + vars.join(';') + ')' : '')
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
