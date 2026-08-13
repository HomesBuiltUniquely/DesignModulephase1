const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app/Components/GoogleCalendarView.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace hex colors with semantic tailwind classes
content = content.replace(/bg-\[\#f8fafd\]/g, 'bg-slate-50');
content = content.replace(/border-\[\#dadce0\]/g, 'border-gray-200');
content = content.replace(/border-\[\#edf0f2\]/g, 'border-gray-100');
content = content.replace(/ring-\[\#dadce0\]/g, 'ring-gray-200');
content = content.replace(/text-\[\#1f1f1f\]/g, 'text-gray-900');
content = content.replace(/text-\[\#3c4043\]/g, 'text-gray-800');
content = content.replace(/text-\[\#444746\]/g, 'text-gray-700');
content = content.replace(/text-\[\#5f6368\]/g, 'text-gray-600');
content = content.replace(/hover:bg-\[\#f1f3f4\]/g, 'hover:bg-gray-100');
content = content.replace(/hover:bg-\[\#f8fafd\]/g, 'hover:bg-slate-50');

fs.writeFileSync(filePath, content);
console.log('Replaced colors successfully.');
