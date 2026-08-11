const fs = require('fs');
const glob = require('glob'); // Note: we can use a simple recursive read if glob is not installed.
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        const dirPath = path.join(dir, f);
        const isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

const files = [];
walkDir('app/admin', (f) => {
    if (f.endsWith('page.tsx') && f.includes('create-')) files.push(f);
});
walkDir('app', (f) => {
    if (f.endsWith('register/page.tsx')) files.push(f);
});

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    if (!content.includes('import CustomSelect')) {
        content = content.replace(
            "import { getApiBase } from '@/app/lib/apiBase';",
            "import { getApiBase } from '@/app/lib/apiBase';\nimport CustomSelect from '@/app/Components/ui/CustomSelect';"
        );
        content = content.replace(
            "import { BRANCH_OPTIONS } from '../../constants/branches';",
            "import { BRANCH_OPTIONS } from '../../constants/branches';\nimport CustomSelect from '@/app/Components/ui/CustomSelect';"
        );
    }
    content = content.replace(
        /<select value={branch} onChange={\(e\) => setBranch\(e.target.value\)} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-white" required>[\s\S]*?<\/select>/,
        `<CustomSelect\n                value={branch}\n                onChange={(val) => setBranch(val)}\n                options={BRANCH_OPTIONS.map((b) => ({ value: b, label: b }))}\n                placeholder="Select branch"\n              />`
    );
    // for deputy-general-manager
    content = content.replace(
        /<select\s+value={branch}\s+onChange={\(e\) => setBranch\(e.target.value\)}\s+className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-white"\s+required\s*>\s*\{BRANCH_OPTIONS\.map\(\(b\) => \(\s*<option key=\{b\} value=\{b\}>\s*\{b\}\s*<\/option>\s*\)\)\}\s*<\/select>/g,
        `<CustomSelect\n                value={branch}\n                onChange={(val) => setBranch(val)}\n                options={BRANCH_OPTIONS.map((b) => ({ value: b, label: b }))}\n                placeholder="Select branch"\n              />`
    );
    
    fs.writeFileSync(file, content);
});
console.log("Replaced in:", files);
