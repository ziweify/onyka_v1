/** Compact MD5 for webmaster hash tools (not for password storage). */
export function md5(input: string): string {
  const utf8 = unescape(encodeURIComponent(input))
  const msg: number[] = []
  for (let i = 0; i < utf8.length; i++) msg[i >> 2] |= utf8.charCodeAt(i) << ((i % 4) * 8)
  const bitLen = utf8.length * 8
  msg[bitLen >> 5] |= 0x80 << (bitLen % 32)
  msg[(((bitLen + 64) >>> 9) << 4) + 14] = bitLen

  let [a, b, c, d] = [1732584193, -271733879, -1732584194, 271733878]

  const cmn = (q: number, a0: number, b0: number, x: number, s: number, t: number) => {
    const n = (a0 + q + x + t) | 0
    return (((n << s) | (n >>> (32 - s))) + b0) | 0
  }
  const ff = (a0: number, b0: number, c0: number, d0: number, x: number, s: number, t: number) =>
    cmn((b0 & c0) | (~b0 & d0), a0, b0, x, s, t)
  const gg = (a0: number, b0: number, c0: number, d0: number, x: number, s: number, t: number) =>
    cmn((b0 & d0) | (c0 & ~d0), a0, b0, x, s, t)
  const hh = (a0: number, b0: number, c0: number, d0: number, x: number, s: number, t: number) =>
    cmn(b0 ^ c0 ^ d0, a0, b0, x, s, t)
  const ii = (a0: number, b0: number, c0: number, d0: number, x: number, s: number, t: number) =>
    cmn(c0 ^ (b0 | ~d0), a0, b0, x, s, t)

  for (let i = 0; i < msg.length; i += 16) {
    const [aa, bb, cc, dd] = [a, b, c, d]
    a = ff(a, b, c, d, msg[i], 7, -680876936)
    d = ff(d, a, b, c, msg[i + 1], 12, -389564586)
    c = ff(c, d, a, b, msg[i + 2], 17, 606105819)
    b = ff(b, c, d, a, msg[i + 3], 22, -1044525330)
    a = ff(a, b, c, d, msg[i + 4], 7, -176418897)
    d = ff(d, a, b, c, msg[i + 5], 12, 1200080426)
    c = ff(c, d, a, b, msg[i + 6], 17, -1473231341)
    b = ff(b, c, d, a, msg[i + 7], 22, -45705983)
    a = ff(a, b, c, d, msg[i + 8], 7, 1770035416)
    d = ff(d, a, b, c, msg[i + 9], 12, -1958414417)
    c = ff(c, d, a, b, msg[i + 10], 17, -42063)
    b = ff(b, c, d, a, msg[i + 11], 22, -1990404162)
    a = ff(a, b, c, d, msg[i + 12], 7, 1804603682)
    d = ff(d, a, b, c, msg[i + 13], 12, -40341101)
    c = ff(c, d, a, b, msg[i + 14], 17, -1502002290)
    b = ff(b, c, d, a, msg[i + 15], 22, 1236535329)

    a = gg(a, b, c, d, msg[i + 1], 5, -165796510)
    d = gg(d, a, b, c, msg[i + 6], 9, -1069501632)
    c = gg(c, d, a, b, msg[i + 11], 14, 643717713)
    b = gg(b, c, d, a, msg[i], 20, -373897302)
    a = gg(a, b, c, d, msg[i + 5], 5, -701558691)
    d = gg(d, a, b, c, msg[i + 10], 9, 38016083)
    c = gg(c, d, a, b, msg[i + 15], 14, -660478335)
    b = gg(b, c, d, a, msg[i + 4], 20, -405537848)
    a = gg(a, b, c, d, msg[i + 9], 5, 568446438)
    d = gg(d, a, b, c, msg[i + 14], 9, -1019803690)
    c = gg(c, d, a, b, msg[i + 3], 14, -187363961)
    b = gg(b, c, d, a, msg[i + 8], 20, 1163531501)
    a = gg(a, b, c, d, msg[i + 13], 5, -1444681467)
    d = gg(d, a, b, c, msg[i + 2], 9, -51403784)
    c = gg(c, d, a, b, msg[i + 7], 14, 1735328473)
    b = gg(b, c, d, a, msg[i + 12], 20, -1926607734)

    a = hh(a, b, c, d, msg[i + 5], 4, -378558)
    d = hh(d, a, b, c, msg[i + 8], 11, -2022574463)
    c = hh(c, d, a, b, msg[i + 11], 16, 1839030562)
    b = hh(b, c, d, a, msg[i + 14], 23, -35309556)
    a = hh(a, b, c, d, msg[i + 1], 4, -1530992060)
    d = hh(d, a, b, c, msg[i + 4], 11, 1272893353)
    c = hh(c, d, a, b, msg[i + 7], 16, -155497632)
    b = hh(b, c, d, a, msg[i + 10], 23, -1094730640)
    a = hh(a, b, c, d, msg[i + 13], 4, 681279174)
    d = hh(d, a, b, c, msg[i], 11, -358537222)
    c = hh(c, d, a, b, msg[i + 3], 16, -722521979)
    b = hh(b, c, d, a, msg[i + 6], 23, 76029189)
    a = hh(a, b, c, d, msg[i + 9], 4, -640364487)
    d = hh(d, a, b, c, msg[i + 12], 11, -421815835)
    c = hh(c, d, a, b, msg[i + 15], 16, 530742520)
    b = hh(b, c, d, a, msg[i + 2], 23, -995338651)

    a = ii(a, b, c, d, msg[i], 6, -198630844)
    d = ii(d, a, b, c, msg[i + 7], 10, 1126891415)
    c = ii(c, d, a, b, msg[i + 14], 15, -1416354905)
    b = ii(b, c, d, a, msg[i + 5], 21, -57434055)
    a = ii(a, b, c, d, msg[i + 12], 6, 1700485571)
    d = ii(d, a, b, c, msg[i + 3], 10, -1894986606)
    c = ii(c, d, a, b, msg[i + 10], 15, -1051523)
    b = ii(b, c, d, a, msg[i + 1], 21, -2054922799)
    a = ii(a, b, c, d, msg[i + 8], 6, 1873313359)
    d = ii(d, a, b, c, msg[i + 15], 10, -30611744)
    c = ii(c, d, a, b, msg[i + 6], 15, -1560198380)
    b = ii(b, c, d, a, msg[i + 13], 21, 1309151649)
    a = ii(a, b, c, d, msg[i + 4], 6, -145523070)
    d = ii(d, a, b, c, msg[i + 11], 10, -1120210379)
    c = ii(c, d, a, b, msg[i + 2], 15, 718787259)
    b = ii(b, c, d, a, msg[i + 9], 21, -343485551)

    a = (a + aa) | 0
    b = (b + bb) | 0
    c = (c + cc) | 0
    d = (d + dd) | 0
  }

  const toHex = (n: number) => {
    let s = ''
    for (let j = 0; j < 4; j++) s += ((n >> (j * 8)) & 0xff).toString(16).padStart(2, '0')
    return s
  }
  return toHex(a) + toHex(b) + toHex(c) + toHex(d)
}
