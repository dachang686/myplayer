const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

const assetsDir = path.join(__dirname, 'assets');

// Recursively find all JS files
function findJsFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            findJsFiles(filePath, fileList);
        } else if (filePath.endsWith('.js')) {
            fileList.push(filePath);
        }
    }
    return fileList;
}

function deobfuscateFile(filePath) {
    console.log(`Processing: ${filePath}`);
    const code = fs.readFileSync(filePath, 'utf-8');
    
    try {
        const ast = parser.parse(code, {
            sourceType: 'unambiguous',
            allowAwaitOutsideFunction: true,
            allowReturnOutsideFunction: true
        });

        traverse(ast, {
            // Convert string literal bracket notation to dot notation
            // e.g., obj['prop'] -> obj.prop
            MemberExpression(path) {
                if (
                    path.node.computed &&
                    t.isStringLiteral(path.node.property) &&
                    /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(path.node.property.value)
                ) {
                    path.node.property = t.identifier(path.node.property.value);
                    path.node.computed = false;
                }
            },
            
            // Convert hexadecimal/unicode strings to normal strings
            StringLiteral(path) {
                if (path.node.extra && path.node.extra.raw) {
                    // Removing extra.raw will force Babel to regenerate the string with normal characters
                    delete path.node.extra.raw;
                }
            },
            
            // Numeric literal normalization
            NumericLiteral(path) {
                if (path.node.extra && path.node.extra.raw) {
                    delete path.node.extra.raw;
                }
            },

            // Evaluate binary expressions (Constant Folding)
            // Commented out to prevent "Maximum call stack size exceeded" on deeply nested ASTs
            /*
            BinaryExpression(path) {
                const { confident, value } = path.evaluate();
                if (confident) {
                    path.replaceWith(t.valueToNode(value));
                }
            }
            */
        });

        // Generate the deobfuscated and formatted code
        const output = generate(ast, {
            retainLines: false,
            compact: false,
            minified: false,
            jsescOption: {
                minimal: true // Keeps unicode characters instead of escaping them
            }
        }, code);

        fs.writeFileSync(filePath, output.code, 'utf-8');
        console.log(`[Success] Deobfuscated: ${filePath}`);
    } catch (err) {
        console.error(`[Error] Failed to process ${filePath}:`, err.message);
    }
}

const jsFiles = findJsFiles(assetsDir);
console.log(`Found ${jsFiles.length} JS files to process.`);

jsFiles.forEach(deobfuscateFile);
console.log('Done!');
