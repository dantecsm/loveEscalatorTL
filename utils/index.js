const fs = require('fs')
const path = require('path')
const iconv = require('iconv-lite')

const 日区隧道字典 = JSON.parse(fs.readFileSync(path.join("utils", "subs_cn_jp.json")))
// 中文隧道字典是日区隧道字典的 key value 互换
const 中文隧道字典 = Object.fromEntries(Object.entries(日区隧道字典).map(([k, v]) => [v, k]))

function replaceBlock(字节数组字符串, 待替换子字节数组字符串, 替换子字节数组字符串) {
    const 待替换位置 = 字节数组字符串.indexOf(待替换子字节数组字符串)

    if (待替换位置 === -1) {
        throw new Error(`待替换子字节数组字符串未找到: ${待替换子字节数组字符串}`)
    }

    const 待替换结束位置 = 待替换位置 + 待替换子字节数组字符串.length
    const 替换后的字节数组字符串 = 字节数组字符串.slice(0, 待替换位置) + 替换子字节数组字符串 + 字节数组字符串.slice(待替换结束位置)

    return 替换后的字节数组字符串
}

function replaceBuffer(buffer, subArrayToReplace, replacementSubArray, baseIdx = 0) {
    const startPos = buffer.indexOf(subArrayToReplace, baseIdx)
    if (startPos === -1) {
        throw new Error(`buffer 找不到待替换区: ${subArrayToReplace}`)
    }

    const endPos = startPos + subArrayToReplace.length
    const replacedBuffer = Buffer.concat([buffer.slice(0, startPos), replacementSubArray, buffer.slice(endPos)])
    return replacedBuffer
}

function 文件转字节数组(filePath) {
    const data = fs.readFileSync(filePath)
    return Array.from(data).map(d => num2Hex(d))
}

function 字节数组转文件(filePath, hexArr) {
    const buffer = Buffer.from(hexArr.map(h => parseInt(h, 16)))
    fs.writeFileSync(filePath, buffer)
}

function num2Hex(n, len = 2) {
    if (len !== 0) {
        return n.toString(16).padStart(len, '0').toUpperCase()
    } else {
        return n.toString(16).toUpperCase()
    }
}

function hex2Num(hex) {
    return parseInt(hex, 16)
}

function num2Bin(n, len = 8) {
    if (len !== 0) {
        return n.toString(2).padStart(len, '0')
    } else {
        return n.toString(2)
    }
}

function 中文转字节数组(中文) {
    const buffer = Buffer.from(中文)
    return Array.from(iconv.encode(buffer, 'gbk')).map(n => num2Hex(n))
}

function 日语转字节数组(日语) {
    const buffer = Buffer.from(日语)
    return Array.from(iconv.encode(buffer, 'shift-jis')).map(n => num2Hex(n))
}

function 字节数组转日语(字节数组) {
    const buffer = Buffer.from(字节数组.map(n => hex2Num(n)))
    return iconv.decode(buffer, 'shift-jis')
}

function 是否只有日语(预期日语文本) {
    const JP_REG = /^[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\uFF66-\uFF9D"{} a-zA-Z0-9\[\]:,（）……？！Ａ-Ｚａ-ｚ０-９~’"～―○●♪☆\n\x00％、。＆”／→＝：､．─\\/]+$/
    return JP_REG.test(预期日语文本)
}

function ReadDword(hexArr) {
    if (!(Array.isArray(hexArr) && hexArr.length === 4)) {
        throw new Error("当前 DWORD 字节数组不是数组或四字节")
    }
    const hex = hexArr.reverse().join('')
    return hex2Num(hex)
}

function WriteDword(num) {
    let hex = num.toString(16).padStart(8, '0').toUpperCase()
    if (hex.length > 8) {
        throw new Error("当前数字范围超出四字节限制")
    }
    const hexArr = []
    // 0003579A
    hexArr.unshift(hex.slice(0, 2))
    hexArr.unshift(hex.slice(2, 4))
    hexArr.unshift(hex.slice(4, 6))
    hexArr.unshift(hex.slice(6, 8))
    return hexArr
}

function 生成字典(日文输入目录, 中文输出目录, 输出字典文件) {
    const DICT = {}
    const 输入文件表 = fs.readdirSync(日文输入目录)

    输入文件表.map((文件名) => {
        const 输入文件路径 = path.join(日文输入目录, 文件名)
        const 输出文件路径 = path.join(中文输出目录, 文件名)
        if (!fs.existsSync(输出文件路径)) {
            const log = `不存在 ${输出文件路径}`
            throw new Error(log)
        }
        const inputData = JSON.parse(fs.readFileSync(输入文件路径))
        const outputData = JSON.parse(fs.readFileSync(输出文件路径))
        if (inputData.length !== outputData.length) {
            const log = `翻译文件长度不一致: ${输入文件路径} 与 ${输出文件路径}`
            throw new Error(log)
        }
        inputData.map((jp, idx) => {
            const { message: 日文句子 } = jp
            let { message: 中文句子 } = outputData[idx]
            const 全角中文 = 半角转全角(中文句子)

            let keyIdx = 1
            let key = 日文句子
            while (DICT[key] !== undefined) {
                keyIdx += 1
                key = `${日文句子}  字典第 ${keyIdx} 句`
            }

            DICT[key] = 全角中文
        })
    })
    fs.writeFileSync(输出字典文件, JSON.stringify(DICT, null, 2))
    console.log(`字典生成完成，已保存${输出字典文件}`)
    return DICT
}

function 中文转日区(str, hint = 'none', saveFile = '占用文本.txt') {
    const ret = str.split('').map(c => 日区隧道字典[c] || c).join('')
    if (hint !== 'none') {
        const 已被占用的日文字符 = str.split('').filter(c => 中文隧道字典[c] !== undefined)
        const 占用日语字符的中文 = 已被占用的日文字符.map(c => 中文隧道字典[c]).join('')
        if (已被占用的日文字符.length > 0) {
            const msg = `警告: ${已被占用的日文字符.join('')} 已被 ${占用日语字符的中文} 占用，保存到${saveFile}`
            if (hint === 'info') {
                console.log(msg)
                if (!fs.existsSync(saveFile)) {
                    fs.writeFileSync(saveFile, '')
                }
                const content = fs.readFileSync(saveFile, 'utf-8')
                if (!content.includes(msg)) {
                    fs.appendFileSync(saveFile, msg + '\n')
                }
            } else {
                throw msg
            }
        }
    }
    return ret
}

function 日区转中文(str) {
    return str.split('').map(c => 中文隧道字典[c] || c).join('')
}

function 半角转全角(str, exception = []) {
    if (!exception.includes('1')) str = str.replaceAll('1', '１')
    if (!exception.includes('2')) str = str.replaceAll('2', '２')
    if (!exception.includes('3')) str = str.replaceAll('3', '３')
    if (!exception.includes('4')) str = str.replaceAll('4', '４')
    if (!exception.includes('5')) str = str.replaceAll('5', '５')
    if (!exception.includes('6')) str = str.replaceAll('6', '６')
    if (!exception.includes('7')) str = str.replaceAll('7', '７')
    if (!exception.includes('8')) str = str.replaceAll('8', '８')
    if (!exception.includes('9')) str = str.replaceAll('9', '９')
    if (!exception.includes('0')) str = str.replaceAll('0', '０')

    if (!exception.includes('a')) str = str.replaceAll('a', 'ａ')
    if (!exception.includes('b')) str = str.replaceAll('b', 'ｂ')
    if (!exception.includes('c')) str = str.replaceAll('c', 'ｃ')
    if (!exception.includes('d')) str = str.replaceAll('d', 'ｄ')
    if (!exception.includes('e')) str = str.replaceAll('e', 'ｅ')
    if (!exception.includes('f')) str = str.replaceAll('f', 'ｆ')
    if (!exception.includes('g')) str = str.replaceAll('g', 'ｇ')
    if (!exception.includes('h')) str = str.replaceAll('h', 'ｈ')
    if (!exception.includes('i')) str = str.replaceAll('i', 'ｉ')
    if (!exception.includes('j')) str = str.replaceAll('j', 'ｊ')
    if (!exception.includes('k')) str = str.replaceAll('k', 'ｋ')
    if (!exception.includes('l')) str = str.replaceAll('l', 'ｌ')
    if (!exception.includes('m')) str = str.replaceAll('m', 'ｍ')
    if (!exception.includes('n')) str = str.replaceAll('n', 'ｎ')
    if (!exception.includes('o')) str = str.replaceAll('o', 'ｏ')
    if (!exception.includes('p')) str = str.replaceAll('p', 'ｐ')
    if (!exception.includes('q')) str = str.replaceAll('q', 'ｑ')
    if (!exception.includes('r')) str = str.replaceAll('r', 'ｒ')
    if (!exception.includes('s')) str = str.replaceAll('s', 'ｓ')
    if (!exception.includes('t')) str = str.replaceAll('t', 'ｔ')
    if (!exception.includes('u')) str = str.replaceAll('u', 'ｕ')
    if (!exception.includes('v')) str = str.replaceAll('v', 'ｖ')
    if (!exception.includes('w')) str = str.replaceAll('w', 'ｗ')
    if (!exception.includes('x')) str = str.replaceAll('x', 'ｘ')
    if (!exception.includes('y')) str = str.replaceAll('y', 'ｙ')
    if (!exception.includes('z')) str = str.replaceAll('z', 'ｚ')

    if (!exception.includes('A')) str = str.replaceAll('A', 'Ａ')
    if (!exception.includes('B')) str = str.replaceAll('B', 'Ｂ')
    if (!exception.includes('C')) str = str.replaceAll('C', 'Ｃ')
    if (!exception.includes('D')) str = str.replaceAll('D', 'Ｄ')
    if (!exception.includes('E')) str = str.replaceAll('E', 'Ｅ')
    if (!exception.includes('F')) str = str.replaceAll('F', 'Ｆ')
    if (!exception.includes('G')) str = str.replaceAll('G', 'Ｇ')
    if (!exception.includes('H')) str = str.replaceAll('H', 'Ｈ')
    if (!exception.includes('I')) str = str.replaceAll('I', 'Ｉ')
    if (!exception.includes('J')) str = str.replaceAll('J', 'Ｊ')
    if (!exception.includes('K')) str = str.replaceAll('K', 'Ｋ')
    if (!exception.includes('L')) str = str.replaceAll('L', 'Ｌ')
    if (!exception.includes('M')) str = str.replaceAll('M', 'Ｍ')
    if (!exception.includes('N')) str = str.replaceAll('N', 'Ｎ')
    if (!exception.includes('O')) str = str.replaceAll('O', 'Ｏ')
    if (!exception.includes('P')) str = str.replaceAll('P', 'Ｐ')
    if (!exception.includes('Q')) str = str.replaceAll('Q', 'Ｑ')
    if (!exception.includes('R')) str = str.replaceAll('R', 'Ｒ')
    if (!exception.includes('S')) str = str.replaceAll('S', 'Ｓ')
    if (!exception.includes('T')) str = str.replaceAll('T', 'Ｔ')
    if (!exception.includes('U')) str = str.replaceAll('U', 'Ｕ')
    if (!exception.includes('V')) str = str.replaceAll('V', 'Ｖ')
    if (!exception.includes('W')) str = str.replaceAll('W', 'Ｗ')
    if (!exception.includes('X')) str = str.replaceAll('X', 'Ｘ')
    if (!exception.includes('Y')) str = str.replaceAll('Y', 'Ｙ')
    if (!exception.includes('Z')) str = str.replaceAll('Z', 'Ｚ')

    if (!exception.includes(' ')) str = str.replaceAll(' ', '　')
    if (!exception.includes('/')) str = str.replaceAll('/', '／')
    if (!exception.includes('.')) str = str.replaceAll('.', '．')
    if (!exception.includes('(')) str = str.replaceAll('(', '（')
    if (!exception.includes(')')) str = str.replaceAll(')', '）')
    if (!exception.includes('､')) str = str.replaceAll('､', '、')
    if (!exception.includes(':')) str = str.replaceAll(':', '：')
    if (!exception.includes('-')) str = str.replaceAll('-', '─')
    if (!exception.includes('\\')) str = str.replaceAll('\\', '＼')
    if (!exception.includes('\'')) str = str.replaceAll('\'', '＇')
    if (!exception.includes('%')) str = str.replaceAll('%', '％')
    if (!exception.includes('<')) str = str.replaceAll('<', '＜')
    if (!exception.includes('>')) str = str.replaceAll('>', '＞')
    if (!exception.includes('·')) str = str.replaceAll('·', '．')
    if (!exception.includes('+')) str = str.replaceAll('+', '＋')

    return str
}

function printHexArray(hexArray) {
    let line = '';
    for (let i = 0; i < hexArray.length; i++) {
        line += hexArray[i] + ' ';
        if ((i + 1) % 16 === 0) {
            console.log(line.trim());
            line = '';
        }
    }
    if (line.length > 0) {
        console.log(line.trim());
    }
}

function printBufferArray(bufferArray) {
    const hexArray = Array.from(bufferArray).map(n => num2Hex(n))
    printHexArray(hexArray)
}

function readBufferDword(buffer, idx) {
    const a = buffer[idx + 3].toString(16).padStart(2, '0')
    const b = buffer[idx + 2].toString(16).padStart(2, '0')
    const c = buffer[idx + 1].toString(16).padStart(2, '0')
    const d = buffer[idx + 0].toString(16).padStart(2, '0')
    const hex = `${a}${b}${c}${d}`
    return hex2Num(hex) >>> 0
}

function readBufferWord(buffer, idx) {
    const a = buffer[idx + 1].toString(16).padStart(2, '0')
    const b = buffer[idx + 0].toString(16).padStart(2, '0')
    const hex = `${a}${b}`
    return hex2Num(hex) >>> 0
}

function writeBufferDword(buffer, idx, dword, endian = 'LE') {
    const hex = num2Hex(dword).padStart(8, '0')
    const a = hex.slice(0, 2)
    const b = hex.slice(2, 4)
    const c = hex.slice(4, 6)
    const d = hex.slice(6, 8)
    if (endian === 'LE') {
        buffer[idx + 3] = parseInt(a, 16)
        buffer[idx + 2] = parseInt(b, 16)
        buffer[idx + 1] = parseInt(c, 16)
        buffer[idx + 0] = parseInt(d, 16)
    } else {
        buffer[idx + 0] = parseInt(a, 16)
        buffer[idx + 1] = parseInt(b, 16)
        buffer[idx + 2] = parseInt(c, 16)
        buffer[idx + 3] = parseInt(d, 16)
    }
}

function writeBufferWord(buffer, idx, word) {
    const hex = num2Hex(word).padStart(4, '0')
    const a = hex.slice(0, 2)
    const b = hex.slice(2, 4)
    buffer[idx + 1] = parseInt(a, 16)
    buffer[idx + 0] = parseInt(b, 16)
}

function 创建uif字符替换表(outputFile) {
    const json = {
        "character_substitution": {
            "enable": true,
            "source_characters": "",
            "target_characters": ""
        }
    }
    json.character_substitution.source_characters = Object.values(日区隧道字典).join('')
    json.character_substitution.target_characters = Object.keys(日区隧道字典).join('')
    fs.writeFileSync(outputFile, JSON.stringify(json, null, 2))
}

// 把 buffer 用 FF + 8 字节方式压缩，返回压缩后的 buffer
function ffZip(buffer) {
    const bufferGroup = []
    for (let i = 0; i < buffer.length; i += 8) {
        const subBuffer = buffer.subarray(i, i + 8)
        bufferGroup.push(subBuffer)
    }

    const signs = [-1, 0x01, 0x03, 0x07, 0x0F, 0x1F, 0x3F, 0x7F, 0xFF]
    bufferGroup.map((subBuffer, idx) => {
        const len = subBuffer.length
        const pre = Buffer.from([signs[len]])
        bufferGroup[idx] = Buffer.concat([pre, subBuffer])
    })

    const newBuffer = Buffer.concat(bufferGroup)
    return newBuffer
}

function buffer2Hex(buffer) {
    return buffer.toString('hex').toUpperCase().match(/../g).join(' ')
}

function 重排表属性(objArr, keys = []) {
    return objArr.map(obj => {
        const reorderedObj = {};

        // 按照 keys 数组顺序添加键
        keys.forEach(key => {
            if (obj.hasOwnProperty(key)) {
                reorderedObj[key] = obj[key];
            }
        });

        // 添加剩余的键
        Object.keys(obj).forEach(key => {
            if (!keys.includes(key)) {
                reorderedObj[key] = obj[key];
            }
        });

        return reorderedObj;
    });
}

// 检查一句话中是否有不能 sjis 编码的文本
function hasIllegalSjisChar(message) {
    return Array.from(message).some(cn => {
        if (cn === '\n') return false
        cn = 半角转全角(cn)
        const jp = 中文转日区(cn)
        const buffer = iconv.encode(jp, 'sjis')
        if (buffer.length === 1) {
            console.log(cn, jp, '对应的 buffer 长度是 1', buffer)
            return true
        }
    })
}

module.exports = {
    num2Hex,
    hex2Num,
    num2Bin,
    ReadDword,
    WriteDword,
    replaceBlock,
    replaceBuffer,
    printHexArray,
    printBufferArray,
    readBufferDword,
    writeBufferDword,
    readBufferWord,
    writeBufferWord,
    ffZip,
    buffer2Hex,
    中文转字节数组,
    日语转字节数组,
    字节数组转日语,
    是否只有日语,
    文件转字节数组,
    字节数组转文件,
    生成字典,
    中文转日区,
    日区转中文,
    半角转全角,
    日区隧道字典,
    中文隧道字典,
    创建uif字符替换表,
    重排表属性,
    hasIllegalSjisChar,
}
