function makeid(type, id, vars) {
    return type + id + (vars ? '(' + vars.sort().join(';') + ')' : '')
}
module.exports.makeid = makeid
