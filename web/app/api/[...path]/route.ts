import { searchOffers, verifyJob, cachedJob } from '@/lib/server/offers';
import { config, json, assertOrigin, body, authenticate, db, requireOK, AppError, configured, limit, remote } from '@/lib/server/core';
import { authAction } from '@/lib/server/auth';
import { defaultProfile } from '@/lib/model';
import { validateProfile, validateFeedback } from '@/lib/validation';
export const dynamic='force-dynamic';
async function handle(req:Request){try{
 const c=await config();const path=new URL(req.url).pathname.replace(/^\/api\//,'');
 if(req.method!=='GET')assertOrigin(req,c);
 if(path==='status'&&req.method==='GET')return json({accounts:configured(c),offers:Boolean(c.FRANCE_TRAVAIL_CLIENT_ID&&c.FRANCE_TRAVAIL_CLIENT_SECRET),ai:Boolean(c.DEEPSEEK_API_KEY)});
 if(path.startsWith('auth/')&&req.method==='POST')return await authAction(req,c,path.slice(5),await body(req));
 if(path==='communes'&&req.method==='GET'){
  const postal=new URL(req.url).searchParams.get('postal')||'';if(!/^[0-9]{5}$/.test(postal))throw new AppError(400,'Entre un code postal à 5 chiffres.');
  if(configured(c))await limit(c,'communes-global',300,60);
  const r=await remote(`https://geo.api.gouv.fr/communes?codePostal=${postal}&fields=nom,code,centre&format=json`);await requireOK(r);return json(await r.json());
 }
 const u=await authenticate(req,c);
 if(path==='me'&&req.method==='GET')return json({email:u.email});
 await limit(c,`user:${u.id}`,120,60);
 if(path==='offers'&&req.method==='GET'){
  await limit(c,`search:${u.id}`,12,600);
  const r=await db(c,'profiles?select=preferences',u.token);await requireOK(r);const rows=await r.json() as {preferences:unknown}[];
  const p=validateProfile(rows[0]?.preferences||defaultProfile);return json(await searchOffers(c,p));
 }
 if(path.startsWith('offers/')&&req.method==='GET'){
  const id=path.slice(7);if(!/^[a-zA-Z0-9_-]{1,64}$/.test(id))throw new AppError(400,'Offre invalide.');await limit(c,`detail:${u.id}`,30,600);return json(await verifyJob(c,id));
 }
 if(path==='feedback'){
  if(req.method==='GET'){const r=await db(c,'feedback?select=job_id,verdict,reason,job,created_at&order=created_at.desc&limit=1000',u.token);await requireOK(r);return json(await r.json());}
  if(req.method==='POST'){const f=validateFeedback(await body(req));const job=await cachedJob(c,f.job_id);const r=await db(c,'feedback?on_conflict=user_id,job_id',u.token,{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify({...f,user_id:u.id,job,created_at:new Date().toISOString()})});await requireOK(r);return json({...f,job});}
  if(req.method==='DELETE'){const id=new URL(req.url).searchParams.get('id')||'';if(!/^[a-zA-Z0-9_-]{1,64}$/.test(id))throw new AppError(400,'Offre invalide.');const r=await db(c,`feedback?job_id=eq.${encodeURIComponent(id)}`,u.token,{method:'DELETE'});await requireOK(r);return json({ok:true});}
 }
 if(path==='profile'){
  if(req.method==='GET'){const r=await db(c,'profiles?select=preferences',u.token);await requireOK(r);const rows=await r.json() as {preferences:unknown}[];return json(rows.length?rows[0].preferences:defaultProfile);}
  if(req.method==='PUT'){const p=validateProfile(await body(req));const r=await db(c,'profiles?on_conflict=user_id',u.token,{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify({user_id:u.id,preferences:p,updated_at:new Date().toISOString()})});await requireOK(r);return json(p);}
 }
 throw new AppError(404,'Page introuvable.');
}catch(e){return json({error:e instanceof AppError?e.message:'Une erreur est survenue. Réessaie dans un instant.'},e instanceof AppError?e.status:500);}}
export const GET=handle;export const POST=handle;export const PUT=handle;export const DELETE=handle;
