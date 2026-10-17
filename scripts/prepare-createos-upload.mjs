import {readFileSync,readdirSync,writeFileSync,mkdirSync,lstatSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {parseEnv} from 'node:util';
import {credentialValues} from '../apps/api/src/privacy.ts';

// Explicit source allowlist: runtime secrets and private evidence never enter the build context.
try {
 const root=resolve('.'),paths=[];
 const walk=directory=>{for(const entry of readdirSync(directory,{withFileTypes:true})){
  if(entry.name.startsWith('.')||['node_modules','dist'].includes(entry.name)||entry.name.endsWith('.tsbuildinfo'))continue;
  const path=join(directory,entry.name);if(entry.isSymbolicLink())throw Error('Symlinks cannot enter the deployment snapshot.');
  if(entry.isDirectory())walk(path);else if(entry.isFile())paths.push(path);
 }};
 for(const directory of ['apps/api/src','apps/web','packages/contracts/src','fixtures'])walk(directory);
 paths.push(...['package.json','package-lock.json','tsconfig.json','tsconfig.server.json','Dockerfile','.dockerignore','apps/api/package.json','packages/contracts/package.json']);
 const secrets=credentialValues({...process.env,...parseEnv(readFileSync('.env','utf8'))});
 const files=[...new Set(paths)].sort().map(path=>{if(lstatSync(path).isSymbolicLink())throw Error('Symlink excluded');const bytes=readFileSync(path);const text=bytes.toString('utf8');if(secrets.some(secret=>text.includes(secret)||text.includes(JSON.stringify(secret).slice(1,-1))))throw Error('Private credential found in build source.');return {path:relative(root,resolve(path)).replaceAll('\\','/'),content:bytes.toString('base64')};});
 if(files.length>100)throw Error('Upload file limit exceeded');
 const manifest=files.map(file=>({path:file.path,sha256:createHash('sha256').update(Buffer.from(file.content,'base64')).digest('hex')}));
 mkdirSync('.local',{recursive:true});writeFileSync('.local/createos-upload-private.json',JSON.stringify({files}),{mode:0o600});writeFileSync('.local/createos-source-manifest.json',JSON.stringify(manifest,null,2));
 console.log(JSON.stringify({prepared:true,files:files.length,bytes:files.reduce((n,f)=>n+Buffer.from(f.content,'base64').length,0),sourceSha256:createHash('sha256').update(JSON.stringify(manifest)).digest('hex'),privateCredentialsExcluded:true}));
}catch{console.error(JSON.stringify({prepared:false,privateDetailsSuppressed:true}));process.exitCode=1;}
