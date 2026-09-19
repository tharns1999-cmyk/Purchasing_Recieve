const fs = require('fs');
const path = require('path');
const files = fs.readdirSync('gas').filter(f => f.endsWith('.gs')).map(f => path.join('gas', f));
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  content = content.replace(/SpreadsheetApp\.getActiveSpreadsheet\(\)/g, "SpreadsheetApp.openById('13xLjgBYXZYqC-RAP8rodNtkMeRykJr9rpD4UA2jkkkE')");
  fs.writeFileSync(f, content);
});
console.log('Replaced all getActiveSpreadsheet');
