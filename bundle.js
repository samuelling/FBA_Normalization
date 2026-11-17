// Writes a single-file copy of the dashboard (default: standalone.html) with the
// scripts inlined, for sharing or for hosts that serve only one file.
//   node bundle.js [output.html]
const fs = require('fs'), path = require('path');
const out = process.argv[2] || path.join(__dirname, 'standalone.html');
let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
html = html.replace(/<script src="([\w.]+\.js)(\?v=\d+)?"><\/script>/g, (m, file) => {
  const js = fs.readFileSync(path.join(__dirname, file), 'utf8').replace(/<\/script/g, '<\\/script');
  return '<script>\n' + js + '\n</script>';
});
if (/<script src=/.test(html)) throw new Error('a script tag was not inlined');
fs.writeFileSync(out, html);
console.log('wrote ' + out + ' (' + html.length + ' bytes)');
