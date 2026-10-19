// Packs the browser build into one self-contained page (three.js loads from jsDelivr).
import fs from 'node:fs';
const dir = 'dist-artifact';
const html = fs.readFileSync(`${dir}/index.html`, 'utf8');
const js = fs.readdirSync(`${dir}/assets`).find(f => f.endsWith('.js'));
const css = fs.readdirSync(`${dir}/assets`).find(f => f.endsWith('.css'));
const body = html.match(/<body>([\s\S]*)<\/body>/)[1].replace(/<script[^>]*src=[^>]*><\/script>/g, '');
const three = JSON.parse(fs.readFileSync('node_modules/three/package.json', 'utf8')).version;
const out = `<title>Bolt Works</title>
<style>${fs.readFileSync(`${dir}/assets/${css}`, 'utf8')}</style>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@${three}/build/three.module.js"}}</script>
${body.trim()}
<script type="module">${fs.readFileSync(`${dir}/assets/${js}`, 'utf8').replace(/<\/script/g, '<\\/script')}</script>
`;
fs.writeFileSync(process.argv[2] || 'bolt-works.html', out);
console.log('wrote', out.length, 'bytes');
