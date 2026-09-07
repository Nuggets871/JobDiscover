import { config, json, assertOrigin, body, authenticate, db, requireOK, AppError, configured, limit } from '@/lib/server/core';
import { authAction } from '@/lib/server/auth';
import { defaultProfile } from '@/lib/model';
import { validateProfile } from '@/lib/validation';
export const dynamic='force-dynamic';
async function handle(req:Request){try{
 const c=await config();const path=new URL(req.url).pathname.replace(/^\/api\//,'');
 if(req.method!=='GET')assertOrigin(req,c);
 if(path==='status'&&req.method==='GET')return json({accounts:configured(c),offers:Boolean(c.FRANCE_TRAVAIL_CLIENT_ID&&c.FRANCE_TRAVAIL_CLIENT_SECRET),ai:Boolean(c.DEEPSEEK_API_KEY)});
 if(path.startsWith('auth/')&&req.method==='POST')return await authAction(req,c,path.slice(5),await body(req));
 const u=await authenticate(req,c);
 if(path==='me'&&req.method==='GET')return json({email:u.email});
 await limit(c,`user:${u.id}`,120,60);
 if(path==='profile'){
  if(req.method==='GET'){const r=await db(c,'profiles?select=preferences',u.token);await requireOK(r);const rows=await r.json() as {preferences:unknown}[];return json(rows.length?rows[0].preferences:defaultProfile);}
  if(req.method==='PUT'){const p=validateProfile(await body(req));const r=await db(c,'profiles?on_conflict=user_id',u.token,{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify({user_id:u.id,preferences:p,updated_at:new Date().toISOString()})});await requireOK(r);return json(p);}
 }
 throw new AppError(404,'Page introuvable.');
}catch(e){return json({error:e instanceof AppError?e.message:'Une erreur est survenue. Réessaie dans un instant.'},e instanceof AppError?e.status:500);}}
export const GET=handle;export const POST=handle;export const PUT=handle;export const DELETE=handle;
