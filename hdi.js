const fs = require('fs')
const path = require('path')
const FatImage = require('./utils/replaceHdiFile');

// 将修改后的 LOVE.EAR 文件注入 hdi
const MY_FILE = "LOVE.EAR"
const HDI_FILE = "Love Escalator_CN.hdi"
const TARGET_FILE = "//LOVE/LOVE.EAR"

const img = new FatImage(HDI_FILE);
img.replaceFile(TARGET_FILE, fs.readFileSync(MY_FILE));
img.close();
console.log(`汉化文件 ${MY_FILE} 已注入 ${path.resolve(HDI_FILE)}`)
