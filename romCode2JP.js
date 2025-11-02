const { num2Hex, hex2Num } = require('./utils')
const JIS_DICT = require('./utils/JIS_DICT.json')
const REV_JIS_DICT = Object.fromEntries(Object.entries(JIS_DICT).map(([key, value]) => [value, key]))

const NAME_DICT = {
    "90": "くろさき",
    "92": "たかし",
    "94": "【たかし】",
    "96": "【脇谷】",
    "97": "【理恵】",
    "98": "【のり子】",
    "99": "【ひな子】",
    "9A": "【真由美】",
    "9B": "【美紀】",
    "9C": "【ともみ】",
    "9D": "【貴久美】",
    "9E": "【美奈代】",
    "9F": "【まりな】",
    "A0": "【あゆか】",
    "A1": "【美里】",
    "A2": "【榊原】",
    "A3": "【和正】",
    "A4": "【田村】",
    "A5": "【中野】",
    "A6": "【千葉】",
    "A7": "【藤田】",
    "A8": "【松波】",
    "A9": "【市川】",
    "AA": "【高市】",
    "AB": "【由美】",
    "AC": "【薫子】",
    "AD": "【神谷】",
    "AE": "【森】",
    "AF": "【高岡】",
    "B0": "【岡】",
    "B1": "【社長】",
    "B2": "【川久保】",
    "B3": "【さおり】",
    "B4": "【華奈】",
    "B5": "【みずき】",
    "B6": "【洋子】",
    "B7": "【男】",
    "B8": "【女】",
    "B9": "【男性】",
    "BA": "【女性】",
    "BB": "【男の子】",
    "BC": "【女の子】",
    "BD": "【女の子１】",
    "BE": "【女の子２】",
    "BF": "【女の子３】",
}
const REV_NAME_DICT = Object.fromEntries(Object.entries(NAME_DICT).map(([key, value]) => [value, key]))
const SINGLE_BYTE_OPS = {
    "90": { mean: "男主姓氏", placeHolder: "くろさき", handle: "翻译为黑崎" },
    "92": { mean: "男主名字", placeHolder: "たかし", handle: "翻译为贵志" },
    "81": { mean: "换行", placeHolder: "\n", handle: "翻译为\n" },
    "82": { mean: "自定义人名结束符", placeHolder: "＜８２＞", handle: "翻译与转换字节时还原" },
    "83": { mean: "自定义人名开始符", placeHolder: "＜８３＞", handle: "翻译与转换字节时还原" },
    "C4": { mean: "电影名", placeHolder: "＜Ｃ４＞", handle: "翻译与转换字节时还原 C4" },
    "C6": { mean: "电影名", placeHolder: "＜Ｃ６＞", handle: "翻译与转换字节时还原 C6" },
    "C8": { mean: "电影名", placeHolder: "＜Ｃ８＞", handle: "翻译与转换字节时还原 C8" },
    "CA": { mean: "电影类型", placeHolder: "＜ＣＡ＞", handle: "翻译与转换字节是还原 CA" },
    "CC": { mean: "电影类型", placeHolder: "＜ＣＣ＞", handle: "翻译与转换字节是还原 CC" },
    "CE": { mean: "电影类型", placeHolder: "＜ＣＥ＞", handle: "翻译与转换字节是还原 CE" },
}

function getValueFromKey(key) {
    if (typeof key !== 'string' || key.length !== 4) {
        throw new Error('Key must be a 4-character string.');
    }
    if (JIS_DICT[key] === undefined) {
        throw new Error(`Key ${key} not found in JIS dictionary.`);
    }
    return JIS_DICT[key];
}

function romCode2Text(romCodeArr, needLog = false) {
    const textArr = romCodeArr.map(code => {
        // 处理各种单字节占位符
        if (SINGLE_BYTE_OPS[code] !== undefined) {
            const { mean, placeHolder } = SINGLE_BYTE_OPS[code]
            if (needLog) {
                console.log(`${code} => ${mean}`)
            }
            return placeHolder
        }
        const key = num2Hex(hex2Num(code) + 0x2000)
        const value = getValueFromKey(key)
        if (needLog) {
            console.log(`${key} => ${value}`)
        }
        return value
    })
    return textArr.join('')
}

// ['aa', 'bb', ...] => 'jp'
function romCode2JP(hexArr, needLog = false) {
    // 假定只有一个名字
    if (NAME_DICT[hexArr[0]] !== undefined) {
        const name = NAME_DICT[hexArr[0]];
        hexArr.shift();
        const codes = name.split('').flatMap(c => {
            let [A, B] = REV_JIS_DICT[c].match(/.{2}/g);
            A = num2Hex(hex2Num(A) - 0x20);
            return [A, B];
        });
        hexArr = codes.concat(hexArr);
    }
    const parts = [];
    for (let i = 0; i < hexArr.length; i += 2) {
        const first = hexArr[i];
        if (first === '92') {
            // console.log('检测到 92，替换为男主人名')
            const codes = "たかし".split('').map(c => {
                let [A, B] = REV_JIS_DICT[c].match(/.{2}/g);
                A = num2Hex(hex2Num(A) - 0x20);
                return `${A}${B}`;
            });
            parts.push(...codes)
            i -= 1
        } else if (first === '90') {
            // console.log('检测到 90，替换为男主姓氏')
            const codes = "くろさき".split('').map(c => {
                let [A, B] = REV_JIS_DICT[c].match(/.{2}/g);
                A = num2Hex(hex2Num(A) - 0x20);
                return `${A}${B}`;
            });
            parts.push(...codes)
            i -= 1
        } else if (SINGLE_BYTE_OPS[first] !== undefined) {
            parts.push(first)
            i -= 1
        } else {
            parts.push(String(hexArr[i]) + String(hexArr[i + 1]));
        }
    }
    const jp = romCode2Text(parts, needLog)
    return jp
}

// jp => ['AA', 'BB', ...]
function jp2RomCode(jp) {
    jp = jp.replaceAll('贵志', '*').replaceAll('貴志', '*')
    jp = jp.replaceAll('黑崎', '※').replaceAll('黒崎', '※')
    jp = jp.replaceAll('＜８２＞', '↑')
    jp = jp.replaceAll('＜８３＞', '↓')
    jp = jp.replaceAll('＜Ｃ４＞', '→')
    jp = jp.replaceAll('＜Ｃ６＞', '○')
    jp = jp.replaceAll('＜Ｃ８＞', '☀')
    jp = jp.replaceAll('＜ＣＡ＞', '×')
    jp = jp.replaceAll('＜ＣＣ＞', '√')
    jp = jp.replaceAll('＜ＣＥ＞', '☁')
    const chars = jp.split('')
    const codes = chars.flatMap(c => {
        if (c === '*') {
            return ['92']
        }
        if (c === '※') {
            return ['90']
        }
        if (c === '\n') {
            return ['81']
        }
        if (c === '↑') {
            return ['82']
        }
        if (c === '↓') {
            return ['83']
        }
        if (c === '→') {
            return ['C4']
        }
        if (c === '○') {
            return ['C6']
        }
        if (c === '☀') {
            return ['C8']
        }
        if (c === '×') {
            return ['CA']
        }
        if (c === '√') {
            return ['CC']
        }
        if (c === '☁') {
            return ['CE']
        }

        if (!REV_JIS_DICT[c]) {
            throw `找不到 ${c} 对应的类JIS编码`
        } else {
            let [A, B] = REV_JIS_DICT[c].match(/../g)
            A = num2Hex(hex2Num(A) - 0x20)
            return [A, B]
        }
    })
    return codes
}

module.exports = {
    romCode2JP,
    jp2RomCode,
    REV_NAME_DICT
}

// test()
function test() {
    const hex = `2D 34 04 22 04 4A 04 3F 04 4E 15 2F 04 2D
04 46 04 24 04 6B 14 56 04 4B
`
    let hexArr = hex.replaceAll('\n', ' ').split(' ').filter(n => !!n);
    const jp = romCode2JP(hexArr, true)
    console.log(jp)
}