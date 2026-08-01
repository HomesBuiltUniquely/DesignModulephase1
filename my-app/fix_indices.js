const fs = require('fs');
const path = '/home/vishal/Hub/Projects/FrontandProjects/DesignModulephase1/my-app/app/Leads/[id]/page.tsx';
let code = fs.readFileSync(path, 'utf8');

// The popup rendering code starts around line 2688
const startIndex = code.indexOf('<TaskModal context={popupContext}');
const endIndex = code.indexOf('{checklistContext && (() => {');

let before = code.substring(0, startIndex);
let modalBlock = code.substring(startIndex, endIndex);
let after = code.substring(endIndex);

// Replace popupContext.milestoneIndex === X
modalBlock = modalBlock.replace(/popupContext\.milestoneIndex === 1/g, 'popupContext.milestoneIndex === 0');
modalBlock = modalBlock.replace(/popupContext\.milestoneIndex === 2/g, 'popupContext.milestoneIndex === 1');
modalBlock = modalBlock.replace(/popupContext\.milestoneIndex === 3/g, 'popupContext.milestoneIndex === 2');
modalBlock = modalBlock.replace(/popupContext\.milestoneIndex === 4/g, 'popupContext.milestoneIndex === 3');
modalBlock = modalBlock.replace(/popupContext\.milestoneIndex === 5/g, 'popupContext.milestoneIndex === 4');
modalBlock = modalBlock.replace(/popupContext\.milestoneIndex === 6/g, 'popupContext.milestoneIndex === 5');
modalBlock = modalBlock.replace(/popupContext\.milestoneIndex === 7(?![\s\S]*?Upload KT files)/g, 'popupContext.milestoneIndex === 6'); 
// wait, the above negative lookahead might be tricky if "Upload KT files" is on the same line or not.
// Let's do it manually for milestone 7 since there are only a few.
