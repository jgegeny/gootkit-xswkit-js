function isProperty(str) {
  return /^[^0-9\/\\.\-+*!~()\[\];:?'"<>,{}|`~%\^& \f\n\r\t\v​\u00a0\u1680​\u180e\u2000​\u2001\u2002​\u2003\u2004​\u2005\u2006​\u2007\u2008​\u2009\u200a​\u2028\u2029​​\u202f\u205f​\u3000]\w*$/.test(str)
}
var gen = function(obj, prop) {
  return isProperty(prop) ? obj+'.'+prop : obj+'['+JSON.stringify(prop)+']'
}

gen.valid = isProperty
module.exports = gen