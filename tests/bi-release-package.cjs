const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const manifest=JSON.parse(fs.readFileSync('extension/baocaodmx-bi/manifest.json','utf8'));
const files=JSON.parse(fs.readFileSync('index.html','utf8').match(/<script id="embedded-source" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const ui=files['src/components/BiExtensionStatus.tsx'];
const zipPath=`downloads/baocaodmx-bi-extension-${manifest.version}.zip`;
assert(ui.includes(`href="./${zipPath}"`),'Download link must name the packaged release');
assert(ui.includes(`Tải tiện ích ${manifest.version}`),'Visible version must match the manifest');
assert(fs.existsSync(zipPath));
execFileSync('python3',['-c',`
import pathlib,sys,zipfile
root=pathlib.Path('extension/baocaodmx-bi')
with zipfile.ZipFile(sys.argv[1]) as z:
 expected={'baocaodmx-bi/'+p.name:p for p in root.iterdir() if p.is_file()}
 assert set(z.namelist())==set(expected), 'ZIP file list differs from extension source'
 for name,p in expected.items(): assert z.read(name)==p.read_bytes(), 'ZIP differs: '+name
`,zipPath]);
for(const name of ['background.js','bridge.js','bi.js','popup.js','recognition.js','installment.js'])new vm.Script(fs.readFileSync('extension/baocaodmx-bi/'+name,'utf8'));
console.log('PASS: visible release version, download target, all ZIP entries match extension source, script syntax.');
