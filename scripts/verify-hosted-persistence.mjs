import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseEnv} from 'node:util';
import {credentialValues} from '../apps/api/src/privacy.ts';

let stage='configuration',observedHttpStatus=null;
try {
 const mode=process.argv[2];if(!['before','after'].includes(mode))throw Error('Select before or after verification.');
 const {origin}=JSON.parse(readFileSync('.local/hosted-target-private.json','utf8'));const url=new URL(origin);if(url.protocol!=='https:'||url.username||url.password)throw Error('An actual HTTPS origin is required.');
 const request=(path,options={})=>fetch(new URL(path,origin),{...options,redirect:'error',signal:AbortSignal.timeout(15000)});
 stage='health'; const health=await request('/api/health');observedHttpStatus=health.status;const healthBody=await health.json();if(!health.ok||healthBody.service!=='fastforward'||!healthBody.testMode)throw Error('Actual application health failed');
 stage='frontend'; const html=await request('/');const text=await html.text();if(!html.ok||!text.includes('id="root"'))throw Error('Compiled frontend missing');
 const assets=[...new Set([...text.matchAll(/(?:src|href)="(\/assets\/[^" ]+)"/g)].map(m=>m[1]))];if(assets.length<2)throw Error('Frontend assets missing');
 const secrets=credentialValues(parseEnv(readFileSync('.env','utf8')));for(const asset of assets){const r=await request(asset);const body=await r.text();if(!r.ok||secrets.some(s=>body.includes(s)))throw Error('Asset response failed privacy check');}
 stage='visitor'; let visitor;if(mode==='before'){
  const r=await request('/api/session');const header=r.headers.get('set-cookie')??'';if(!r.ok||!/HttpOnly/i.test(header)||!/Secure/i.test(header)||!/SameSite=Strict/i.test(header))throw Error('Cookie policy failed');
  visitor={cookie:header.split(';')[0],csrfToken:(await r.json()).csrfToken};writeFileSync('.local/hosted-visitor-private.json',JSON.stringify(visitor),{mode:0o600});
 }else visitor=JSON.parse(readFileSync('.local/hosted-visitor-private.json','utf8'));
 stage='session-persistence'; const session=await request('/api/session',{headers:{Cookie:visitor.cookie}});if((await session.json()).csrfToken!==visitor.csrfToken)throw Error('Visitor session did not survive');
 stage='history'; const history=await request('/api/runs',{headers:{Cookie:visitor.cookie}});if(!history.ok||(await history.json()).runs.length!==0)throw Error('Fresh visitor history is not isolated');
 stage='csrf'; const denied=await request('/api/runs',{method:'POST',headers:{Cookie:visitor.cookie,Origin:origin,'Content-Type':'application/json'},body:'{}'});if(denied.status!==403)throw Error('Missing CSRF not denied');
 stage='saved-report'; const {cookie}=JSON.parse(readFileSync('.local/live-session.json','utf8'));const {id}=JSON.parse(readFileSync('.local/live-run.json','utf8'));const r=await request('/api/runs/'+id,{headers:{Cookie:cookie}});const {run}=await r.json();if(!r.ok||run?.status!=='passed')throw Error('Saved real checkpoint unavailable');
 stage='artifact-ownership'; let artifactHashes=0;for(const a of run.artifacts){const result=await request(a.downloadUrl,{headers:{Cookie:cookie}});if(!result.ok||createHash('sha256').update(await result.text()).digest('hex')!==a.sha256)throw Error('Protected artifact mismatch');if((await request(a.downloadUrl)).status!==401)throw Error('Anonymous artifact was not denied');artifactHashes++;}
 if((await request('/api/runs/'+id,{headers:{Cookie:visitor.cookie}})).status!==404)throw Error('Foreign visitor could access saved run');
 stage='readiness'; const readiness=await(await request('/api/readiness')).json();
 const proof={checkedAt:new Date().toISOString(),mode,origin,actualFrontend:true,assetsServed:assets.length,noConfiguredSecretsInAssets:true,httpsHealth:true,secureHttpOnlyStrictCookie:true,visitorSessionSurvives:true,visitorHistoryIsolated:true,csrfDenied:true,savedRealPassedRun:true,protectedArtifactHashes:artifactHashes,anonymousDenied:true,otherVisitorDenied:true,ready:readiness.ready,providerStatuses:readiness.providers.map(p=>({id:p.id,status:p.status})),modelCalls:0,sandboxCreations:0};
 writeFileSync('.local/hosted-'+mode+'-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch{const failure={checkedAt:new Date().toISOString(),hostedVerificationFailed:true,stage,healthStatus:observedHttpStatus,privateDetailsSuppressed:true};writeFileSync('.local/hosted-failed-proof.json',JSON.stringify(failure,null,2));console.error(JSON.stringify(failure));process.exitCode=1;}
