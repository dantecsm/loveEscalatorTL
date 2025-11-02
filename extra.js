// 检查 JIS_DICT.json 有多少字符对应多个编码，把这些文字对应的重复编码全部测试一遍，只留一个
const fs = require('fs')
const { 半角转全角, 中文转日区, hex2Num } = require('./utils')
const { romCode2JP, jp2RomCode } = require('./romCode2JP')

// table2.json 主要包含了 table.json 未提取的选项文本，以及部分例如主角回想场景的自动播放文本
const table2 = require('./table2.json')

// 如果有多个句子，这里需要补充人名
const nameDict = {
    '【脇谷】': { cnName: '【胁谷】', byte: '96' },
    '【真由美】': { cnName: '【真由美】', byte: '9A' },
    '【理恵】': { cnName: '【理惠】', byte: '97' }
}

const files = Object.keys(table2)
for (const file of files) {
    const changes = table2[file]
    for (const change of changes) {
        let { addr, jpHex, cnHex, jp, cn, isFirstOption, 保留前2字节, 保留前4字节 } = change

        // isFirstOption 为 true 时，检查 cnHex 中不应该有 00
        if (isFirstOption) {
            if (cnHex.includes('00')) {
                throw `作为第一个选项，不应出现 00 => ${cn}`
            }
        }

        // 只有 jp 为 "" 的情况才需要解析 jp
        if (!jp) {
            jp = romCode2JP(jpHex.split(' '))
            console.log(jp)
            change.jp = jp    
        }

        // 只有 cnHex 为 "" 的情况才需要更新 cnHex，这样我才能自定义 cnHex 而不被覆盖
        if (cn) {
            cn = 半角转全角(cn)
            cn = 中文转日区(cn)
            let cnArr = jp2RomCode(cn)

            // 处理人名单字节替换问题
            const jpNames = Object.keys(nameDict)
            const jpName = jpNames.find(item => jp.startsWith(item))
            if (jpName) {
                const { cnName, byte } = nameDict[jpName]
                cnArr.splice(0, cnName.length * 2, byte)
            }

            // 然后处理保留2字节或前4字节的问题
            if (保留前2字节 !== undefined) {
                const bytes = jpHex.split(' ').slice(0, 2)
                cnArr = bytes.concat(cnArr)
            } else if (保留前4字节 !== undefined) {
                const bytes = jpHex.split(' ').slice(0, 4)
                cnArr = bytes.concat(cnArr)
            }

            const jpArr = jpHex.split(' ')
            const lenDiff = jpArr.length - cnArr.length
            if (lenDiff < 0) {
                throw `翻译的中文长度不应该大于日文: ${cn}`
            } else {
                for (let i = 0; i < lenDiff; i++) {
                    cnArr.push('00')
                }
            }
            cnHex = cnArr.join(' ').toUpperCase()
            if (cnHex.length !== jpHex.length) {
                throw `中文 hex 和日文 hex 长度不同`
            }
            change.cnHex = cnHex
        }
    }
    table2[file] = table2[file].sort((a, b) => hex2Num(a.addr) - hex2Num(b.addr))
    table2[file].forEach(change => change.jpHex = change.jpHex.toUpperCase())
    table2[file].forEach(change => change.cnHex = change.cnHex.toUpperCase())
}
fs.writeFileSync('table2.json', JSON.stringify(table2, null, 2))
console.log(`已更新 table2.json 的 cnHex 列`)