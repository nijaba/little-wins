const http=require('http'),fs=require('fs'),crypto=require('crypto');
const {DatabaseSync}=require('node:sqlite');
const PARENT=process.env.PARENT_PIN||'1234',CHILD=process.env.CHILD_PIN||'0000',SECRET=process.env.SECRET||'change-me';
// Refuse to run with the placeholder PINs/secret from docker-compose.yml (e.g. if docker-compose.override.yml is missing).
// For local testing only, set ALLOW_DEFAULTS=1.
{const PH=['1234','0000','change-me','change-this-long-random-string'],bad=[];
 if(PH.includes(PARENT))bad.push('PARENT_PIN is a placeholder');if(PH.includes(CHILD))bad.push('CHILD_PIN is a placeholder');
 if(PARENT===CHILD)bad.push('PARENT_PIN and CHILD_PIN are the same');if(PH.includes(SECRET)||SECRET.length<16)bad.push('SECRET is a placeholder or shorter than 16 characters');
 if(bad.length&&process.env.ALLOW_DEFAULTS!=='1'){console.error('Refusing to start: '+bad.join('; ')+'.\nSet real values in docker-compose.override.yml (see docs/admin-guide.md).');process.exit(1)}}
const db=new DatabaseSync(process.env.DB||'/data/little-wins.db');
db.exec(`CREATE TABLE IF NOT EXISTS items(id INTEGER PRIMARY KEY,kind TEXT,name TEXT,note TEXT,pmin INT,pmax INT,sort INT);
CREATE TABLE IF NOT EXISTS entries(id INTEGER PRIMARY KEY,ts TEXT,day TEXT,item_id INT,kind TEXT,points INT,who TEXT,note TEXT,undone INT DEFAULT 0);
CREATE TABLE IF NOT EXISTS rewards(id INTEGER PRIMARY KEY,name TEXT,stars INT,points INT);`);
try{db.exec('ALTER TABLE items ADD COLUMN active INT DEFAULT 1')}catch{}
if(!db.prepare('SELECT 1 FROM items').get()){
 // Starter list for a new database; parents edit everything in Settings.
 const T=[['Morning routine done','per routine',5,5],['Help with a family chore','points per chore',5,15],['Tidy room','per day',10,10],['Homework 30 min','',10,10],['Reading 20 min','',5,5],['Kind words or a kind gesture','per occasion',5,10],['Practice an instrument or sport 15 min','',5,5],['Follow screen-time rules','per day',5,5],['Use a calming strategy','when upset',5,5]];
 const P=[['Hitting or hurting someone','per incident'],['Unkind or rude words','per incident'],['Breaking screen-time rules','per incident']];
 const C=['Morning routine','Kind words','Homework','Bedtime on time'];
 const ins=db.prepare('INSERT INTO items(kind,name,note,pmin,pmax,sort) VALUES(?,?,?,?,?,?)');let s=0;
 T.forEach(t=>ins.run('target',t[0],t[1],t[2],t[3],s++));P.forEach(p=>ins.run('penalty',p[0],p[1],50,50,s++));C.forEach(c=>ins.run('challenge',c,'',0,0,s++));
 const r=db.prepare('INSERT INTO rewards(name,stars,points) VALUES(?,?,?)');
 [['Pick the family movie',2,0],['Choose dinner',3,0],['Extra 30 min screen time',2,50],['Trip to the park',4,100],['New book',6,200],['A special day out',12,500]].forEach(x=>r.run(x[0],x[1],x[2]));}
try{db.exec('ALTER TABLE rewards ADD COLUMN sort INT')}catch{}
db.exec('CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT)');
const setting=k=>(db.prepare('SELECT value FROM settings WHERE key=?').get(k)||{}).value||'';
db.exec('UPDATE rewards SET sort=id WHERE sort IS NULL');
// Per-device sessions: the cookie holds a random token, the database only its SHA-256 hash.
// A parent can see and revoke each device in Settings. Sessions unused for a year are deleted.
db.exec('CREATE TABLE IF NOT EXISTS sessions(id INTEGER PRIMARY KEY,token_hash TEXT UNIQUE,role TEXT,device TEXT,created TEXT,last_seen TEXT)');
const sha=t=>crypto.createHash('sha256').update(t).digest('hex');
const deviceOf=req=>{const u=String(req.headers['user-agent']||'');return /iPad/.test(u)?'iPad':/iPhone/.test(u)?'iPhone':/Android/.test(u)?'Android':/Macintosh/.test(u)?'Mac':/Windows/.test(u)?'Windows':/Linux/.test(u)?'Linux':'Other'};
function newSession(role,req){const tok=crypto.randomBytes(32).toString('base64url'),now=new Date().toISOString();
 db.prepare('DELETE FROM sessions WHERE last_seen<?').run(new Date(Date.now()-365*864e5).toISOString());
 const id=Number(db.prepare('INSERT INTO sessions(token_hash,role,device,created,last_seen) VALUES(?,?,?,?,?)').run(sha(tok),role,deviceOf(req),now,now).lastInsertRowid);
 return{id,cookie:`t=${tok}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Strict`}}
function auth(req){const c=/(?:^|;\s*)t=([^;]*)/.exec(req.headers.cookie||'');if(!c)return null;const v=c[1];
 if(/^[\w-]{43}$/.test(v)){const s=db.prepare('SELECT * FROM sessions WHERE token_hash=?').get(sha(v));if(!s)return null;
  if(Date.now()-Date.parse(s.last_seen)>5*60e3)db.prepare('UPDATE sessions SET last_seen=? WHERE id=?').run(new Date().toISOString(),s.id);
  return{role:s.role,sid:s.id}}
 return null}
const today=()=>new Date().toLocaleDateString('en-CA');
const shift=(d,n)=>{const x=new Date(d+'T12:00:00');x.setDate(x.getDate()+n);return x.toLocaleDateString('en-CA')};
// A real calendar date in YYYY-MM-DD form (rejects 2026-02-30 etc.).
const validDay=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&shift(d,0)===d;
const monday=d=>{const x=new Date(d+'T12:00:00');x.setDate(x.getDate()-((x.getDay()+6)%7));return x.toLocaleDateString('en-CA')};
function state(role,sid,wv){
 const items=db.prepare('SELECT * FROM items WHERE active=1 ORDER BY sort').all();
 const en=db.prepare('SELECT e.*,i.name iname FROM entries e LEFT JOIN items i ON i.id=e.item_id WHERE undone=0 ORDER BY ts,id').all();
 let bal=0;for(const e of en)if(e.kind==='points')bal=Math.max(0,bal+e.points);
 const marks={};for(const e of en)if(e.kind==='mark')marks[e.item_id+'|'+e.day]=e.note;
 const wk={};for(const k in marks){const [id,day]=k.split('|');const w=id+'|'+monday(day);(wk[w]=wk[w]||{p:0,b:0}); if(marks[k]==='perfect')wk[w].p++; if(marks[k]==='bad')wk[w].b++;}
 // Week shown on the Week tab: ?week=<any day of it>, default this week. Past weeks go back to the first
 // week with entries, and always at least one week (so last Sunday can be fixed on Monday).
 const thisMon=monday(today()),first=db.prepare('SELECT MIN(day) d FROM entries').get().d;
 const minMon=[first&&validDay(first)?monday(first):thisMon,shift(thisMon,-7)].sort()[0];
 let mon=validDay(wv)?monday(wv):thisMon;if(mon>thisMon)mon=thisMon;if(mon<minMon)mon=minMon;
 let stars=0;const won={};for(const w in wk)if(wk[w].p>=2&&wk[w].b===0){stars++;if(w.split('|')[1]===mon)won[w.split('|')[0]]=1}
 const td=today(),warn={},mk={};for(const e of en){if(e.day===td&&e.kind==='warn')warn[e.item_id]=(warn[e.item_id]||0)+1;if(e.day===td&&e.kind==='mark')mk[e.item_id]=e.note}
 const hist=en.filter(e=>e.kind!=='mark'||role==='parent').slice(-60).reverse().filter(e=>role==='parent'||e.points>0).map(e=>({id:e.id,ts:e.ts,kind:e.kind,points:e.points,who:e.who,note:role==='parent'?e.note:'',name:e.iname}));
 const days=[...Array(7)].map((_,k)=>shift(mon,k)),wm={};
 items.filter(i=>i.kind==='challenge').forEach(i=>wm[i.id]=days.map(d=>marks[i.id+'|'+d]||null));
 return{childName:setting('child_name'),week:{days,lbl:['M','T','W','T','F','S','S'],marks:wm,start:mon,current:mon===thisMon,prev:mon>minMon?shift(mon,-7):null,next:mon<thisMon?shift(mon,7):null},role,balance:bal,stars,items:items.filter(i=>role==='parent'||i.kind!=='penalty'),rewards:db.prepare('SELECT * FROM rewards ORDER BY sort,id').all(),warn,mk,won,hist,today:td,devices:role==='parent'?db.prepare('SELECT id,role,device,created,last_seen FROM sessions ORDER BY last_seen DESC,id DESC').all().map(d=>({...d,me:d.id===sid})):undefined}}
// Global (not per-IP) throttle: behind a reverse proxy every request comes from the proxy's address. 5 free tries, then 30s, 60s, ... up to 15 min.
const lock={fails:0,until:0};
// Request bodies are tiny JSON; anything over 10 KB is refused (null) and the rest is discarded unread.
const MAX_BODY=10240;
const body=req=>new Promise(r=>{let b='',n=0;if(+req.headers['content-length']>MAX_BODY){req.resume();return r(null)}
 req.on('data',c=>{n+=c.length;if(n>MAX_BODY){req.removeAllListeners('data');req.resume();r(null)}else b+=c});
 req.on('end',()=>{if(n>MAX_BODY)return;try{r(JSON.parse(b||'{}'))}catch{r({})}})});
http.createServer(async(req,res)=>{try{
 let extra={};const send=(c,o,h={})=>{res.writeHead(c,{'Content-Type':'application/json',...extra,...h});res.end(JSON.stringify(o))};
 if(req.method==='GET'&&!req.url.startsWith('/api')){const f=req.url==='/'?'index.html':req.url.slice(1).split('?')[0];
  if(!/^[\w.-]+$/.test(f)||!fs.existsSync('public/'+f)){res.writeHead(404);return res.end()}
  res.writeHead(200,{'Content-Type':{html:'text/html',json:'application/json',png:'image/png',js:'text/javascript'}[f.split('.').pop()]||'text/plain'});return res.end(fs.readFileSync('public/'+f))}
 const url=new URL(req.url,'http://x'),path=url.pathname,wv=url.searchParams.get('week');
 const b=await body(req);if(b===null)return send(413,{error:'Request too large'},{Connection:'close'});
 if(path==='/api/login'){const now=Date.now();if(now<lock.until)return send(429,{error:`Too many wrong PINs. Try again in ${Math.ceil((lock.until-now)/1000)}s`});
  const role=b.pin===PARENT?'parent':b.pin===CHILD?'child':null;
  if(!role){lock.fails++;if(lock.fails>=5)lock.until=now+Math.min(15*60e3,30e3*2**(lock.fails-5));return send(401,{error:'Wrong PIN'})}
  lock.fails=0;
  return send(200,{role},{'Set-Cookie':newSession(role,req).cookie})}
 const a=auth(req);if(!a)return send(401,{error:'login'});const {role,sid}=a;
 if(path==='/api/state')return send(200,state(role,sid,wv));
 if(role!=='parent')return send(403,{error:'view only'});
 const n=(v,lo,hi)=>Math.max(lo,Math.min(hi,Math.round(+v)||0)),txt=v=>String(v||'').trim().slice(0,120);
 if(path==='/api/item/save'){const name=txt(b.name),note=txt(b.note);
  if(!name||!['target','penalty','challenge'].includes(b.kind))return send(400,{error:'A name is required'});
  let a=n(b.pmin,0,10000),z=n(b.pmax,0,10000);if(b.kind==='challenge')a=z=0;if(b.kind==='penalty'){a=Math.max(1,a);z=a}if(z<a)z=a;
  if(b.id)db.prepare('UPDATE items SET name=?,note=?,pmin=?,pmax=? WHERE id=? AND kind=?').run(name,note,a,z,n(b.id,0,1e9),b.kind);
  else db.prepare('INSERT INTO items(kind,name,note,pmin,pmax,sort,active) VALUES(?,?,?,?,?,?,1)').run(b.kind,name,note,a,z,db.prepare('SELECT COALESCE(MAX(sort),0)+1 s FROM items').get().s);
  return send(200,state(role,sid,wv))}
 if(path==='/api/item/move'||path==='/api/reward/move'){const r=path.includes('reward'),d=+b.dir<0?-1:1,T=r?'rewards':'items',id=n(b.id,0,1e9);
  const row=db.prepare(`SELECT * FROM ${T} WHERE id=?`).get(id);
  if(row){const L=r?db.prepare('SELECT id FROM rewards ORDER BY sort,id').all():db.prepare('SELECT id FROM items WHERE active=1 AND kind=? ORDER BY sort,id').all(row.kind);
   const i=L.findIndex(x=>x.id===id),j=i+d;
   if(i>=0&&j>=0&&j<L.length){L.splice(j,0,L.splice(i,1)[0]);L.forEach((x,k)=>db.prepare(`UPDATE ${T} SET sort=? WHERE id=?`).run(k+1,x.id))}}
  return send(200,state(role,sid,wv))}
 if(path==='/api/item/delete'){db.prepare('UPDATE items SET active=0 WHERE id=?').run(n(b.id,0,1e9));return send(200,state(role,sid,wv))}
 if(path==='/api/reward/save'){const name=txt(b.name);if(!name)return send(400,{error:'A name is required'});
  if(b.id)db.prepare('UPDATE rewards SET name=?,stars=?,points=? WHERE id=?').run(name,n(b.stars,0,1000),n(b.points,0,100000),n(b.id,0,1e9));
  else db.prepare('INSERT INTO rewards(name,stars,points,sort) VALUES(?,?,?,(SELECT COALESCE(MAX(sort),0)+1 FROM rewards))').run(name,n(b.stars,0,1000),n(b.points,0,100000));
  return send(200,state(role,sid,wv))}
 if(path==='/api/settings/save'){db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('child_name',String(b.child_name||'').trim().slice(0,40));return send(200,state(role,sid,wv))}
 if(path==='/api/session/revoke'){const id=n(b.id,0,1e9);db.prepare('DELETE FROM sessions WHERE id=?').run(id);
  if(id===sid)return send(401,{error:'login'},{'Set-Cookie':'t=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict'});return send(200,state(role,sid,wv))}
 if(path==='/api/reward/delete'){db.prepare('DELETE FROM rewards WHERE id=?').run(n(b.id,0,1e9));return send(200,state(role,sid,wv))}
 const who='Parent',ts=new Date().toISOString(),day=today();
 const it=db.prepare('SELECT * FROM items WHERE id=?').get(Number.isInteger(+b.item_id)&&b.item_id!=null?+b.item_id:-1);
 const add=(k,p,n,d=day)=>db.prepare('INSERT INTO entries(ts,day,item_id,kind,points,who,note) VALUES(?,?,?,?,?,?,?)').run(ts,d,b.item_id,k,p,who,n||'');
 if(path==='/api/add'&&it&&it.kind!=='challenge'){let p=it.kind==='penalty'?-it.pmin:Math.min(it.pmax,Math.max(it.pmin,+b.points||it.pmin));add('points',p,b.note)}
 else if(path==='/api/warn'&&it&&it.kind==='target')add('warn',0,b.note);
 else if(path==='/api/mark'&&it&&it.kind==='challenge'&&['perfect','ok','bad'].includes(b.mark)){let dd=day;if(b.day){if(!validDay(b.day)||b.day>day)return send(400,{error:'Invalid day'});dd=b.day}
  db.prepare("UPDATE entries SET undone=1 WHERE kind='mark' AND item_id=? AND day=?").run(b.item_id,dd);add('mark',0,b.mark,dd)}
 else if(path==='/api/undo')db.prepare('UPDATE entries SET undone=1 WHERE id=?').run(+b.id);
 else return send(400,{error:'bad request'});
 send(200,state(role,sid,wv))}catch(e){console.error(e);try{res.writeHead(500);res.end('{"error":"server error"}')}catch{}}}).listen(+process.env.PORT||3000,()=>console.log('up'));
