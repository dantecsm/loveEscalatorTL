// 把 ear 文件夹下所有文件打包成 LOVE.EAR 文件
// LOVE.EAR 文件的组成
//   前 4 个字节：C1 03 00 00，是文件数，961 个
// 	 然后是 { 子文件名: 16 字节, 开始地址: 4 字节, 文件大小: 4 字节 } * 961
// 	 最后是根据开始地址和文件大小连接每个子文件
//   LOVE.EAR 文件打包顺序是文件名称排序

const fs = require('fs')
const path = require('path')

const LOVE_EAR_JP_LEN = 25531617

const folder = 'ear_cn'
const destFile = 'LOVE.EAR'
packEarFile(folder, destFile)

function packEarFile(folder, destFile) {
    let files = fs.readdirSync(folder)
    const fileCount = files.length
    if (fileCount !== 961) {
        throw '文件数量不对'
    }
    let start = 4 + fileCount * 24
    const structs = files.map(name => {
        const filePath = path.join(folder, name)
        const buffer = fs.readFileSync(filePath)
        const length = buffer.length
        const ret = {
            name,
            start,
            length,
            buffer
        }
        start += length
        return ret
    })

    const HEAD = Buffer.from([0xC1, 0x03, 0x00, 0x00])
    const infoBuffers = structs.map(struct => {
        const { name, start, length } = struct
        const nameBuffer = Buffer.from(name.toUpperCase(), 'utf-8')
        const namePadding = Buffer.alloc(16 - nameBuffer.length)
        const startBuffer = Buffer.alloc(4)
        startBuffer.writeUInt32LE(start)
        const lengthBuffer = Buffer.alloc(4)
        lengthBuffer.writeUInt32LE(length)
        return Buffer.concat([nameBuffer, namePadding, startBuffer, lengthBuffer])
    })
    const INFO = Buffer.concat(infoBuffers)
    const BODY = Buffer.concat(structs.map(struct => struct.buffer))
    const resultBuffer = Buffer.concat([HEAD, INFO, BODY])
    fs.writeFileSync(destFile, resultBuffer)

    if (resultBuffer.length !== LOVE_EAR_JP_LEN) {
        throw `打包的 ${destFile} 的文件长度与原版日文 LOVE.EAR 长度不一致，可能有错误`
    }

    console.log(`汉化文件打包完成，保存为 ${path.resolve(destFile)}`)
}