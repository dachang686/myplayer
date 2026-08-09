const fs = require('fs');
const path = require('path');

const jsDir = path.join(__dirname, 'js');
const htmlPath = path.join(__dirname, 'index.html');
let htmlContent = fs.readFileSync(htmlPath, 'utf8');

// 只处理我们在上一步抽出来的 app_logic_*.js
const files = fs.readdirSync(jsDir).filter(f => /^app_logic_\d+\.js$/.test(f));
const mappings = {};

// 根据文件内容自动判断它的功能并生成有意义的文件名
function determineName(content, index) {
    // 1. 尝试匹配块级注释标题 (如 /* ============ BuildPlayer - 核心游戏逻辑 ============ */)
    const titleMatch = content.match(/\/\*\s*=+\s*\n\s*(.*?)\s*\n/);
    if (titleMatch && titleMatch[1]) {
        let title = titleMatch[1].replace(/BuildPlayer\s*-\s*/i, '').trim();
        if (title.includes('核心游戏逻辑')) return 'core_game_logic';
        if (title.includes('事件数据')) return 'event_data';
        if (title.includes('UI')) return 'ui_renderer';
        if (title.includes('常量')) return 'constants';
        if (title.includes('工具函数')) return 'utils';
        if (title.includes('成就系统')) return 'achievements';
        if (title.includes('动画')) return 'animations';
    }
    
    // 2. 尝试匹配单行分隔符注释 (如 // ── Storage 工具 ──)
    const lineMatch = content.match(/\/\/\s*──\s*(.*?)\s*──/);
    if (lineMatch && lineMatch[1]) {
        if (lineMatch[1].includes('Storage') || lineMatch[1].includes('存储')) return 'storage';
    }

    // 3. 匹配常见特征代码
    if (content.includes('window.onerror = function')) return 'error_handler';
    if (content.includes('function adjustScale(')) return 'screen_scale_adapter';
    if (content.includes('gtag(')) return 'google_analytics';
    if (content.includes('var isWeixin =')) return 'weixin_share';
    
    // 4. 如果没有找到特殊标题，抓取文件中定义的第一个全局变量或函数的名字
    const declMatch = content.match(/^(?:var|const|let|function)\s+([a-zA-Z0-9_]+)/m);
    if (declMatch && declMatch[1]) {
        return declMatch[1].toLowerCase();
    }
    
    return 'module_' + index;
}

let nameCounts = {};

// 第一步：决定所有的新文件名
files.forEach(file => {
    const filePath = path.join(jsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // 从文件名里提取原本的数字
    const index = file.match(/\d+/)[0]; 
    let baseName = determineName(content, index);
    
    // 避免重名
    if (!nameCounts[baseName]) {
        nameCounts[baseName] = 1;
    } else {
        nameCounts[baseName]++;
        baseName = `${baseName}_${nameCounts[baseName]}`;
    }
    
    mappings[file] = `${baseName}.js`;
});

console.log("=========== 准备重命名 ============");
// 第二步：执行重命名和 HTML 替换
for (let oldFile in mappings) {
    const newFile = mappings[oldFile];
    console.log(`[重命名] ${oldFile.padEnd(16)} ->  ${newFile}`);
    
    const oldPath = path.join(jsDir, oldFile);
    const newPath = path.join(jsDir, newFile);
    
    // 如果重命名的新文件已经存在（可能是以前跑过），先删掉旧的以防冲突
    if (fs.existsSync(newPath) && oldPath !== newPath) {
        fs.unlinkSync(newPath);
    }
    fs.renameSync(oldPath, newPath);
    
    // 在 HTML 中将引入路径更新为新的名字
    const regex = new RegExp(`src="js/${oldFile}"`, 'g');
    htmlContent = htmlContent.replace(regex, `src="js/${newFile}"`);
}

fs.writeFileSync(htmlPath, htmlContent, 'utf8');
console.log('\n✅ 整理完毕！文件已重命名，并且 index.html 中的引入路径已同步更新。');
