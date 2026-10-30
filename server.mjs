import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { database } from './db.mjs';
const production=process.env.NODE_ENV==='production';
if(production && (!process.env.WEBSITE_SITE_NAME || !process.env.ADMIN_OBJECT_ID)) throw new Error('Production requires Azure App Service Easy Auth and ADMIN_OBJECT_ID');
const db=await database();
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const clean=(v,max=200)=>String(v??'').trim().slice(0,max);
function asset(input,id) {
  const tag=clean(input.tag,30).toUpperCase();
  if(!/^[A-Z0-9][A-Z0-9-]{0,29}$/.test(tag))throw fail('Asset tag must contain 1–30 letters, numbers, or hyphens.');
  if(!clean(input.model))throw fail('Model is required.');
  return {id,tag,model:clean(input.model),serial:clean(input.serial),location:clean(input.location),notes:clean(input.notes,2000),status:'Available',assignedTo:'',dueDate:''};
}
const files={'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/style.css':['style.css','text/css'],'/barcode.js':['barcode.js','text/javascript']};
export const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
  try {
    const url=new URL(req.url,'http://localhost');
    if(production && req.headers['x-ms-client-principal-id']!==process.env.ADMIN_OBJECT_ID)throw fail('Sign in with the authorized inventory manager account.',403);
    if(req.method==='GET' && files[url.pathname]) {const [f,type]=files[url.pathname];res.writeHead(200,{'Content-Type':type});return res.end(await readFile(fileURLToPath(new URL('./public/'+f,import.meta.url))));}
    if(url.pathname==='/api/state' && req.method==='GET')return send(200,await db.read());
    if(!url.pathname.startsWith('/api/'))throw fail('Not found',404);
    if(req.method!=='POST')throw fail('Method not allowed',405);
    if(req.headers['sec-fetch-site']==='cross-site')throw fail('Cross-site requests are blocked.',403);
    if(req.headers.origin){const expected=(production?'https':'http')+'://'+req.headers.host;if(req.headers.origin!==expected)throw fail('Invalid request origin.',403);}
    if(!req.headers['content-type']?.startsWith('application/json'))throw fail('JSON content required.',415);
    let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>1_000_000)throw fail('Request too large.',413);}
    let body;try{body=JSON.parse(raw);}catch{throw fail('Invalid JSON.');}
    const state=await db.read();if(body.revision!==state.revision)throw fail('Inventory changed. Refresh and try again.',409);
    const record=(a,action,details)=>state.events.unshift({id:crypto.randomUUID(),assetId:a.id,tag:a.tag,action,details,actor:production?req.headers['x-ms-client-principal-name']||'Manager':'Local manager',at:new Date().toISOString()});
    if(url.pathname==='/api/assets'){
      const a=asset(body.asset,crypto.randomUUID());
      if(state.assets.some(x=>x.tag===a.tag || (a.serial && x.serial.toLowerCase()===a.serial.toLowerCase())))throw fail('Asset tag or serial number already exists.',409);
      state.assets.push(a);record(a,'Added','PC added to inventory');
    }else if(url.pathname==='/api/import'){
      if(!Array.isArray(body.assets)||!body.assets.length||body.assets.length>1000)throw fail('Import 1–1000 PCs at a time.');
      for(const row of body.assets){const a=asset(row,crypto.randomUUID());if(state.assets.some(x=>x.tag===a.tag || (a.serial && x.serial.toLowerCase()===a.serial.toLowerCase())))throw fail('Duplicate tag or serial: '+a.tag,409);state.assets.push(a);record(a,'Imported','PC imported');}
    }else{
      const a=state.assets.find(x=>x.id===body.id);if(!a)throw fail('PC not found.',404);
      if(url.pathname==='/api/edit'){
        const updated=asset(body.asset,a.id);
        if(state.assets.some(x=>x.id!==a.id && (x.tag===updated.tag || (updated.serial && x.serial.toLowerCase()===updated.serial.toLowerCase()))))throw fail('Asset tag or serial already exists.',409);
        const before=JSON.stringify(a);Object.assign(a,{...updated,status:a.status,assignedTo:a.assignedTo,dueDate:a.dueDate});record(a,'Updated',before+' → '+JSON.stringify(a));
      }else if(url.pathname==='/api/checkout'){
        if(a.status!=='Available')throw fail('Only available PCs can be checked out.',409);
        const who=clean(body.assignedTo);if(!who)throw fail('Assigned user is required.');
        const due=clean(body.dueDate,10);if(due && (!/^\d{4}-\d{2}-\d{2}$/.test(due)||!Number.isFinite(Date.parse(due))||new Date(due).toISOString().slice(0,10)!==due))throw fail('Invalid due date.');
        a.assignedTo=who;a.status='Checked out';a.dueDate=due;a.location=clean(body.location)||a.location;record(a,'Checked out','Assigned to '+who+' at '+a.location+(due?' · due '+due:''));
      }else if(url.pathname==='/api/checkin'){
        if(a.status!=='Checked out')throw fail('PC is not checked out.',409);
        const previous=a.assignedTo;a.status='Available';a.assignedTo='';a.dueDate='';a.location=clean(body.location)||a.location;record(a,'Checked in','Returned by '+previous+' to '+a.location);
      }else if(url.pathname==='/api/status'){
        if(a.status==='Checked out')throw fail('Check in this PC before changing its status.',409);
        if(!['Available','Maintenance','Retired'].includes(body.status))throw fail('Invalid status.');
        a.status=body.status;record(a,'Status changed',a.status);
      }else throw fail('Not found',404);
    }
    const revision=state.revision;state.revision++;await db.write(state,revision);send(200,state);
  }catch(e){if(!e.status)console.error(e);send(e.status||500,{error:e.status?e.message:'Server error. Check application logs.'});}
});
server.listen(Number(process.env.PORT||3000),production?'0.0.0.0':'127.0.0.1',()=>console.log('PC Fleet listening on port '+(process.env.PORT||3000)));
async function shutdown(){server.close();await db.close();process.exit();}process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
