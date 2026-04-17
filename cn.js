const fs = require('fs')
const path = require('path')
const { 半角转全角, 中文转日区, replaceBuffer, hex2Num } = require('./utils')
const { REV_NAME_DICT, jp2RomCode } = require('./romCode2JP.js')

const tableFile = 'table.json'
const refDir = 'ear_jp'
const destDir = 'ear_cn'
genCnFiles(tableFile, refDir, destDir)

function genCnFiles(tableFile, refDir, destDir) {
    let isOK = true
    let times = 7
    do {
        addCnHexColumn(tableFile, refDir)
        fixHexLength(tableFile)
        isOK = checkHexLength(tableFile)
    } while (!isOK && times-- > 0)

    if (!isOK) {
        throw `校验不通过，存在文件中文字节长度日文字节不一致`        
    }
    addCnFiles(tableFile, refDir, destDir)
}

function addCnHexColumn(tableFile, refDir) {
    const table = JSON.parse(fs.readFileSync(tableFile))
    const files = Object.keys(table)
    for (const file of files) {
        const items = table[file]
        let searchIdx = 0
        let groupIdx = -1
        const fileBuffer = fs.readFileSync(path.join(refDir, file))
        items.forEach((item, idx) => {
            let { jpHex, jpName, jp, cn } = item

            if (jp === 'error') {
                return
            }

            const cnHexArr = []
            const nameCode = REV_NAME_DICT[`【${jpName}】`] || ""
            if (nameCode) {
                cnHexArr.push(...nameCode.match(/.{2}/g))
            }
            cn = 半角转全角(cn)
            cn = 中文转日区(cn)
            const cnRomCode = jp2RomCode(cn)
            cnHexArr.push(...cnRomCode)
            const jpHexInnerArr = preprocess(jpHex.split(' '))

            // 打上日语字节开始位置，结束位置标签，以便寻找连续的日语文本
            const jpBuffer = Buffer.from(jpHex.split(' ').join(''), 'hex')
            const startIdx = fileBuffer.indexOf(jpBuffer, searchIdx)
            const endIdx = startIdx + jpBuffer.length
            searchIdx = endIdx
            item.startIdx = startIdx
            item.endIdx = endIdx
            const lastItemEndIdx = items[idx - 1]?.endIdx
            if (lastItemEndIdx && lastItemEndIdx === startIdx) {
                item.groupIdx = groupIdx
            } else {
                groupIdx += 1
                item.groupIdx = groupIdx
            }

            // 长度校正
            const minusLen = item.minusLen || 0
            const lenDiff = jpHexInnerArr.length - cnHexArr.length - minusLen
            if (Math.abs(lenDiff) % 2 === 1) {
                console.log(`长度差为奇数: ${lenDiff} => ${jpName} ${jp} ${cn}`)
                throw `长度差为奇数，无法删除或添加字节`
            }

            delete item.padLen
            if (lenDiff > 0) {
                for (let i = 0; i < lenDiff; i++) {
                    cnHexArr.push('00')
                }
                item.padLen = lenDiff
            }

            const jpHexInner = jpHexInnerArr.join(' ')
            const cnHexInner = cnHexArr.join(' ')
            const index = jpHex.indexOf(jpHexInner)
            if (index < 0) {
                throw `找不到 ${jpHexInner} 在 ${jpHex} 中的位置`
            }

            const cnHex = jpHex.replace(jpHexInner, cnHexInner)
            item.cnHex = cnHex
        })
    }
    fs.writeFileSync(tableFile, JSON.stringify(table, null, 2))
    console.log(`已更新 ${tableFile} 的 cnHex 列`)
}

function fixHexLength(tableFile) {
    const table = JSON.parse(fs.readFileSync(tableFile))
    const files = Object.keys(table)
    for (const file of files) {
        const items = table[file]
        const groups = {}
        items.forEach(item => {
            const { groupIdx, jpHex, cnHex } = item
            if (groupIdx === undefined) {
                return
            }
            if (!groups[groupIdx]) {
                groups[groupIdx] = []
            }
            groups[groupIdx].push({ jpHex, cnHex, item })
        })
        for (const groupIdx in groups) {
            const group = groups[groupIdx]
            let jpLen = 0
            let cnLen = 0
            group.forEach(({ jpHex, cnHex }) => {
                jpLen += jpHex.split(' ').length
                cnLen += cnHex.split(' ').length
            })
            if (jpLen !== cnLen) {
                console.log(`${file} 文件的第 ${groupIdx} 组组内长度不一致: 日文长度 ${jpLen} !== ${cnLen} 中文长度`)
                fixGroupLen(cnLen, jpLen, group, file, groupIdx)
            }
        }
    }
    fs.writeFileSync(tableFile, JSON.stringify(table, null, 2))
}

function fixGroupLen(cnLen, jpLen, group, file, groupIdx) {
    const diff = cnLen - jpLen
    if (diff < 0) {
        group.forEach(({ item }) => delete item.minusLen)
    } else {
        // 累计这一组内的 padding 余量，如果大于等于 diff 则可以不改文本地修复，否则至少需要在组内删除 (diff - padding) / 2 向上取整个字
        let padding = 0
        group.forEach(({ item }) => {
            if (item?.padLen) {
                padding += item.padLen
            }
        })
        if (padding >= diff) {
            // 尝试通过修改或添加minusLen字段修复
            // 规则是，找出 group 里所有存在 padLen 的字段的记录，尝试添加或修改 minusLen 字段
            let left = diff
            const canFixItems = group.filter(({ item }) => item.padLen)
            for (const { item } of canFixItems) {
                if (left === 0) break
                const pad = item.padLen
                if (pad <= left) {
                    if (item.minusLen) {
                        item.minusLen += pad
                    } else {
                        item.minusLen = pad
                    }
                    left -= pad
                } else {
                    if (item.minusLen) {
                        item.minusLen += left
                    } else {
                        item.minusLen = left
                    }
                    left = 0
                }
            }
            console.log(`${file} 内第${groupIdx}组超出${diff}字节，但padding为${padding}，已自动修复`)
        } else {
            // padding 不够，至少需要在组内删除一些中文文本本身
            const needDeleteChar = Math.ceil((diff - padding) / 2)
            console.log(`${file} 第${groupIdx}组超出${diff}字节，padding为${padding}，需在以下几句中删除至少${needDeleteChar}个中文字符`)
            group.forEach(({ item }) => {
                console.log(item.cn)
            })
        }

    }
}

// 以 group 为单位检查，确保每个组内所有 jpHex 长度之和与 cnHex 长度之和相等
function checkHexLength(tableFile) {
    const table = JSON.parse(fs.readFileSync(tableFile))
    const files = Object.keys(table)
    for (const file of files) {
        const items = table[file]
        const groups = {}
        items.forEach(item => {
            const { groupIdx, jpHex, cnHex } = item
            if (groupIdx === undefined) {
                return
            }
            if (!groups[groupIdx]) {
                groups[groupIdx] = []
            }
            groups[groupIdx].push({ jpHex, cnHex, item })
        })
        for (const groupIdx in groups) {
            const group = groups[groupIdx]
            let jpLen = 0
            let cnLen = 0
            group.forEach(({ jpHex, cnHex }) => {
                jpLen += jpHex.split(' ').length
                cnLen += cnHex.split(' ').length
            })
            if (jpLen !== cnLen) {
                console.log(`${file} 文件的第 ${groupIdx} 组组内长度不一致: 日文长度 ${jpLen} !== ${cnLen} 中文长度`)
                return false            
            }
        }
    }
    console.log(`校验通过，所有文件组内中文字节长度日文字节与一致`)
    return true
}

function addCnFiles(tableFile, refDir, destDir) {
    if (fs.existsSync(destDir)) {
        fs.rmSync(destDir, { recursive: true })
    }
    // 拷贝 refDir 到 destDir
    fs.cpSync(refDir, destDir, { recursive: true })

    const table = JSON.parse(fs.readFileSync(tableFile))
    const files = Object.keys(table)
    for (const file of files) {
        const items = table[file]
        const destFile = path.join(destDir, file)
        let buffer = fs.readFileSync(destFile)
        for (const item of items) {
            const { jpHex, cnHex, jp } = item
            if (jp === 'error') {
                continue
            }
            const jpHexBuffer = Buffer.from(jpHex.split(' ').join(''), 'hex')
            const cnHexBuffer = Buffer.from(cnHex.split(' ').join(''), 'hex')
            buffer = replaceBuffer(buffer, jpHexBuffer, cnHexBuffer)
        }
        fs.writeFileSync(destFile, buffer)
    }
    console.log(`已根据 ${tableFile} 汉化所有文件，保存目录 ${path.resolve(destDir)}`)
}

function preprocess(hexArr) {
    let newHexArr = Array.from(hexArr)
    // 去掉 00 前缀
    newHexArr.shift();
    // 去掉 00 15 XX XX 后缀
    // while (newHexArr.slice(-1)[0] !== '00') {
    //     newHexArr.pop();
    // }
    // newHexArr.pop();
    newHexArr = newHexArr.slice(0, -4)
    return newHexArr
}
