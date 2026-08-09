const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'index.html');
const jsDir = path.join(__dirname, 'js');
const backupPath = path.join(__dirname, 'index_bak.html');

if (!fs.existsSync(jsDir)) {
    fs.mkdirSync(jsDir);
}

let htmlContent = fs.readFileSync(htmlPath, 'utf8');
// 先备份原始文件
fs.writeFileSync(backupPath, htmlContent, 'utf8');
console.log('已备份原文件至 index_bak.html');

let counter = 1;

// 匹配所有的 <script>...</script> 标签
const scriptRegex = /<script([^>]*)>([\s\S]*?)<\/script>/gi;

const newHtml = htmlContent.replace(scriptRegex, (match, attrs, content) => {
    // 如果该 script 已经有了 src 属性（引入的外部文件），则跳过
    if (/src\s*=\s*['"]/.test(attrs)) {
        return match;
    }
    // 如果是用于存储数据的 JSON 标签（如 application/json），则跳过
    if (/type\s*=\s*['"]application\/json['"]/.test(attrs)) {
        return match;
    }
    // 如果 script 内部没有实质内容（只有空格换行），跳过
    if (content.trim().length === 0) {
        return match;
    }

    // 生成对应的独立 js 文件名
    const fileName = `app_logic_${counter}.js`;
    const filePath = path.join(jsDir, fileName);
    
    // 将内容写入独立 JS 文件
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`已抽取: ${fileName} (共 ${content.split('\n').length} 行代码)`);
    
    counter++;
    
    // 返回替换后的带有 src 的 script 标签（保留原有属性如 id 等）
    return `<script${attrs} src="js/${fileName}"></script>`;
});

// 保存抽取瘦身后的 HTML
fs.writeFileSync(htmlPath, newHtml, 'utf8');
console.log('\n✅ 抽取完成！index.html 已经更新。所有的内置代码都存放在了 js/ 文件夹下。');
