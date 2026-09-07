import { execFileSync } from 'node:child_process';
const staged = process.argv.includes('--staged');
const files = execFileSync('git', staged ? ['diff','--cached','--name-only','--diff-filter=ACMR','-z'] : ['ls-files','-z'], {encoding:'utf8'}).split('\0').filter(Boolean);
let bad = false;
for (const file of files) {
 if (/package-lock\.json$/.test(file)) continue;
 if (/(^|\/)(\.env(\..+)?|\.dev\.vars.*)$/.test(file) && !file.endsWith('.env.example') || /\.(pem|key|p12|dump|backup)$/.test(file)) { console.error(`Forbidden private file: ${file}`); bad=true; continue; }
 let data; try { data=execFileSync('git',['show',`${staged?':': 'HEAD:'}${file}`],{encoding:'utf8',maxBuffer:5e6}); } catch { continue; }
 const patterns=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /\b(?:sk-[a-zA-Z0-9]{24,}|gh[pousr]_[a-zA-Z0-9]{30,}|github_pat_[a-zA-Z0-9_]{30,})\b/, /\beyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{15,}\b/];
 if(patterns.some(p=>p.test(data))) { console.error(`Potential secret in ${file} (value hidden)`); bad=true; }
}
if(bad) process.exit(1);
console.log('Secret scan passed.');
