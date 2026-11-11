// DuckTrader HQ — living pixel office. Ducks are driven by real bot status (status.json).
(function(){
"use strict";
const T = 16, MW = 24, MH = 34;
const MAP = [
  "########################",
  "#,,,,,,,,,,,#==========#",
  "#,,,,,,,,,,,#==========#",
  "#,,,,,,,,,,,#==========#",
  "#,,,,,,,,,,,#==========#",
  "#,,,,,,,,,,,#==========#",
  "#,,,,,,,,,,,#==========#",
  "#####,,##########==#####",
  ...Array(14).fill("#......................#"),
  "#####::##########;;#####",
  "#:::::::::::#;;;;;;;;;;#",
  "#:::::::::::#;;;;;;;;;;#",
  "#:::::::::::#;;;;;;;;;;#",
  "#:::::::::::#;;;;;;;;;;#",
  "#::::::::::::;;;;;;;;;;#",
  "#::::::::::::;;;;;;;;;;#",
  "#:::::::::::#;;;;;;;;;;#",
  "#:::::::::::#;;;;;;;;;;#",
  "#:::::::::::#;;;;;;;;;;#",
  "#:::::::::::#;;;;;;;;;;#",
  "########################",
];
const DESKS = [[3,9],[10,9],[17,9],[3,12],[10,12],[17,12],[3,15],[10,15],[17,15],[3,18],[10,18],[17,18]];
const SPOT = {
  coffee:[2,24], fridge:[9,24], water:[10,31], mailbox:[14,2], printer:[16,2],
  racks:[[19,2],[20,2],[21,2],[22,2]],
  meetFront:[[4,2],[6,2],[8,2]], meetBack:[[4,5],[6,5],[8,5]],
  stoolFront:[[5,26],[6,26],[3,27],[8,28]], stoolBack:[[5,29],[6,29]],
  sofa:[[19,24],[20,24],[21,24],[22,24]], beanbag:[[14,28],[14,30]],
  window:[[2,8],[6,8],[15,8],[20,8],[1,12],[22,14],[1,17],[22,19]],
  chat:[[[11,8],[12,8]],[[3,25],[4,25]],[[16,27],[17,27]],[[13,6],[14,6]],[[8,30],[9,30]],[[7,21],[8,21]],[[15,20],[16,20]]],
};
const BLOCK = new Set();
const blk = (x0,y0,x1,y1) => { for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++) BLOCK.add(x+","+y); };
DESKS.forEach(([c,r]) => blk(c,r,c+1,r));
blk(3,1,9,1); blk(3,3,9,4);                       // whiteboard, meeting table
blk(19,1,22,1); blk(14,1,14,1); blk(16,1,16,1); blk(22,6,22,6); // racks, mailbox, printer, plant
blk(1,8,1,8); blk(22,8,22,8); blk(1,21,1,21); blk(22,21,22,21); // floor plants
blk(1,23,4,23); blk(9,23,10,23); blk(4,27,7,28); blk(11,31,11,31); // counter, fridge, snack table, cooler
blk(13,23,15,23); blk(19,23,22,23); blk(19,26,22,27); blk(19,32,21,32); blk(13,32,13,32); blk(22,32,22,32); // lounge
const walk = (x,y) => x>=0&&y>=0&&x<MW&&y<MH && MAP[y][x] !== "#" && !BLOCK.has(x+","+y);

function bfs(from, to){
  const key = p => p[0]+","+p[1], goal = key(to);
  if (key(from) === goal) return [];
  const prev = new Map([[key(from), null]]), q = [from];
  while (q.length){
    const cur = q.shift();
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const n = [cur[0]+dx, cur[1]+dy], k = key(n);
      if (prev.has(k) || (!walk(n[0],n[1]) && k !== goal)) continue;
      prev.set(k, cur);
      if (k === goal){ const path=[n]; let p=cur; while(p && key(p)!==key(from)){ path.unshift(p); p=prev.get(key(p)); } return path; }
      q.push(n);
    }
  }
  return null;
}

// ---------- palette & sprites ----------
const TIES = ["#d4af37","#3fb8c9","#9b6bff","#ff8fb1","#4f8cff","#ff9f43","#3fbf7f","#f4f1ea","#c0e85a","#b07cff","#ffd166","#7ad3ff"];
const FRONT = [
  "....KKK.....","...KKKK.....","..YYYYYYYY..",".YYYYYYYYYY.",".YYEYYYYEYY.",".YYYYOOYYYY.",
  ".YYYOOOOYYY.","..YYYYYYYY..","..KKSTTSKK..",".KKKSTTSKKK.","YKKKKTTKKKKY",".KKKKKKKKKK.","..KKK..KKK..","..OO....OO..",
];
const BACK = [
  "....KKK.....","...KKKK.....","..YYYYYYYY..",".YYYYYYYYYY.",".YYYYYYYYYY.",".YYYYYYYYYY.",
  ".YYYYYYYYYY.","..YyyyyyyY..","..KKKKKKKK..",".KKKKKKKKKK.","YKKKKKKKKKKY",".KKKKKKKKKK.",
];
const PCOL = { K:"#141414", Y:"#f2c230", y:"#e0ae22", O:"#f08a24", E:"#000", S:"#f4f1ea", "-":"#7a5a10" };
const SPR = new Map();
function drawSprite(ctx, rows, x, y, tie, opts={}){
  const key = (rows===BACK?"B":"F")+tie+JSON.stringify(opts);
  let c = SPR.get(key);
  if (!c){ c=document.createElement("canvas"); c.width=12; c.height=14; paintSprite(c.getContext("2d"), rows, 0, 0, tie, opts); SPR.set(key,c); }
  ctx.drawImage(c, x, y);
}
function paintSprite(ctx, rows, x, y, tie, opts={}){
  for (let r=0;r<rows.length;r++){
    if (opts.maxRow!=null && r>opts.maxRow) break;
    let row = rows[r];
    if (opts.walk && r===13) row = opts.walk===1 ? "..OO.....OO." : ".OO....OO...";
    if (opts.closed && r===4) row = ".YY-YYYY-YY.";
    if (opts.type && r===10) row = opts.type===1 ? ".KKKKKKKKKK." : "YKKKKKKKKKKY";
    for (let c=0;c<12;c++){
      const ch=row[c]; if (ch===".") continue;
      ctx.fillStyle = ch==="T" ? tie : PCOL[ch]; ctx.fillRect(x+c, y+r, 1, 1);
    }
  }
  if (opts.type===1){ ctx.fillStyle=PCOL.Y; ctx.fillRect(x+1,y+9,1,1); ctx.fillRect(x+10,y+9,1,1); }
}

// ---------- background ----------
function buildBG(){
  const c = document.createElement("canvas"); c.width=MW*T; c.height=MH*T;
  const g = c.getContext("2d"); const R=(x,y,w,h,col)=>{g.fillStyle=col;g.fillRect(x,y,w,h);};
  for (let ty=0;ty<MH;ty++) for (let tx=0;tx<MW;tx++){
    const ch=MAP[ty][tx], x=tx*T, y=ty*T;
    if (ch==="."){ R(x,y,T,T,"#3a2e24"); for(let k=0;k<4;k++){ R(x,y+k*4+3,T,1,"#30261e"); R(x+((tx+k*3+ty)%4)*4,y+k*4,1,3,"#30261e"); } }
    else if (ch===","){ R(x,y,T,T,"#1f2c36"); if((tx+ty)%2===0) R(x+7,y+7,2,2,"#263644"); }
    else if (ch===":"){ R(x,y,T,T,((tx+ty)%2)?"#2c2f36":"#24272c"); }
    else if (ch===";"){ R(x,y,T,T,"#3a2a30"); R(x+(tx%2)*8,y+(ty%2)*8,2,2,"#45323a"); }
    else if (ch==="="){ R(x,y,T,T,"#1f2328"); R(x,y,T,1,"#2a2f36"); R(x,y,1,T,"#2a2f36"); }
    else { R(x,y,T,T,"#141518"); const below = MAP[ty+1] && MAP[ty+1][tx]; if (below && below!=="#"){ R(x,y+8,T,8,"#2a2d34"); R(x,y+8,T,1,"#3a3e47"); R(x,y+15,T,1,"#1b1d22"); } }
  }
  // trims: gold baseboard line on trading floor top wall
  R(T, 7*T+15, 22*T, 1, "#6b5414");
  // windows (sky colour painted live, here frames)
  const WIN = [[2,0],[7,0],[14,0],[18,0]];
  WIN.forEach(([tx,ty])=>{ R(tx*T, ty*T+6, 2*T, 9, "#0d0e10"); });
  // meeting room: whiteboard + table + chairs
  R(3*T+2,T-4,7*T-4,13,"#d9dde3"); R(3*T+2,T+8,7*T-4,2,"#9aa0aa");
  R(3*T,3*T+3,7*T,26,"#5a4632"); R(3*T+1,3*T+4,7*T-2,23,"#6b5338"); R(3*T,3*T+28,7*T,2,"#3e3022");
  for (const [x,y] of [...SPOT.meetFront,...SPOT.meetBack]){ R(x*T+3,y*T+5,10,8,"#2c3a46"); R(x*T+3,y*T+(y===2?3:12),10,3,"#384a5a"); }
  // server room: racks, mailbox, printer, plant
  for (let i=19;i<=22;i++){ R(i*T+1,T-6,14,21,"#0c0d10"); R(i*T+2,T-5,12,19,"#1c2026"); for(let k=0;k<5;k++) R(i*T+3,T-3+k*4,10,2,"#272c34"); }
  R(14*T+2,T-2,12,16,"#2b3640"); R(14*T+3,T+1,10,3,"#0d0e10"); R(14*T+5,T+7,6,5,"#d4af37"); // Telegram mailbox
  R(16*T+1,T,14,12,"#9aa0aa"); R(16*T+3,T+2,10,3,"#2a2f38"); R(16*T+4,T-2,8,3,"#f4f1ea");
  // plants
  const plant=(tx,ty)=>{ const x=tx*T,y=ty*T; R(x+4,y+9,8,6,"#7a4b2a"); R(x+3,y+1,10,9,"#2f7d4a"); R(x+5,y,6,4,"#3fa060"); R(x+2,y+5,3,3,"#3fa060"); R(x+11,y+4,3,3,"#2f7d4a"); };
  [[22,6],[1,8],[22,8],[1,21],[22,21],[13,32],[22,32]].forEach(p=>plant(...p));
  // pantry: counter with coffee machine + sink, fridge, snack table, stools, cooler
  R(T,23*T,4*T,14,"#5b6170"); R(T,23*T+12,4*T,4,"#3f4450");
  R(2*T+3,23*T-6,10,14,"#1a1a1a"); R(2*T+5,23*T-3,6,4,"#d4af37"); R(2*T+6,23*T+4,4,3,"#f4f1ea"); // coffee machine
  R(4*T+2,23*T+3,12,6,"#9fb4c4"); // sink
  R(9*T+1,23*T-10,30,26,"#c9ced6"); R(9*T+1,23*T+2,30,1,"#8b9099"); R(9*T+26,23*T-6,2,6,"#8b9099"); R(9*T+26,23*T+5,2,6,"#8b9099");
  R(4*T,27*T+2,4*T,28,"#6b5338"); R(4*T+1,27*T+3,4*T-2,25,"#7d6242"); R(4*T+12,27*T+10,6,6,"#f2c230"); R(4*T+40,27*T+12,8,5,"#e5484d55");
  for (const [x,y] of [...SPOT.stoolFront,...SPOT.stoolBack]){ R(x*T+4,y*T+6,8,8,"#7a4b2a"); R(x*T+5,y*T+7,6,6,"#94603a"); }
  R(11*T+3,31*T-6,10,20,"#cfe6f5"); R(11*T+4,31*T-5,8,8,"#7ab8e0"); R(11*T+3,31*T+12,10,2,"#8b9099");
  // lounge: bookshelf, sofa, coffee table, TV, beanbags, rug
  R(13*T,23*T-6,3*T,22,"#4a3825"); for(let k=0;k<3;k++){ R(13*T+2,23*T-4+k*6,3*T-4,5,"#2b2018"); for(let b=0;b<9;b++) R(13*T+3+b*5,23*T-4+k*6,3,5,["#d4af37","#3fb8c9","#9b6bff","#e5484d","#f4f1ea"][(b+k)%5]); }
  R(16*T+8,25*T,7*T-8,7*T,"#43303a"); R(16*T+10,25*T+2,7*T-12,7*T-4,"#4c3742");
  R(19*T,23*T+2,4*T,14,"#6c2f3c"); R(19*T,24*T,4*T,12,"#7d3a48"); R(19*T-3,23*T+4,4,24,"#5a2632"); R(23*T-1,23*T+4,4,24,"#5a2632");
  R(19*T+2,26*T+2,4*T-4,28,"#5a4632"); R(19*T+3,26*T+3,4*T-6,25,"#6b5338"); R(19*T+10,26*T+10,8,8,"#f4f1ea");
  R(19*T,32*T,3*T,12,"#0d0e10"); R(19*T+2,32*T+1,3*T-4,9,"#1e2a3a"); R(20*T+4,32*T+12,8,3,"#333");
  for (const [x,y] of SPOT.beanbag){ R(x*T+1,y*T+4,14,11,"#2f6f8f"); R(x*T+3,y*T+5,10,6,"#3b88ad"); }
  // desks
  DESKS.forEach(([cx,cy],i)=>{
    const x=cx*T, y=cy*T;
    R(x+1,y+2,2*T-2,13,"#6b5236"); R(x+1,y+13,2*T-2,3,"#4a3825"); R(x+2,y+15,3,3,"#3e3022"); R(x+2*T-5,y+15,3,3,"#3e3022");
    R(x+9,y-7,14,11,"#2a2f38"); R(x+14,y+4,4,2,"#2a2f38"); R(x+5,y+8,8,3,"#9aa0aa"); R(x+22,y+8,3,3,"#d4af37");
    R(x+10,(cy+1)*T+5,12,9,"#30343c"); R(x+11,(cy+1)*T+12,10,3,"#262930"); // chair
  });
  // meeting room clock
  R(11*T+2,2,12,12,"#f4f1ea"); R(11*T+7,4,2,5,"#141414"); R(11*T+7,8,4,1,"#141414");
  return c;
}

// ---------- world state ----------
const Office = { bots:[], ducks:[], seats:new Map(), syncs:new Map(), lastData:null, sel:null, t:0, recent:[] };
const LINES = {
  "ducktrader-alerts":["Mag 7 scan tonight 👀","Any bull flags? 🚩","Watching the triggers"],
  "ducktrader-breadth":["Archiving every stock 📚","Breadth check 🌡️","S5TH update soon"],
  "ducktrader-200ema":["Who's under the 200 EMA?","Counting the laggards 📉"],
  "ducktrader-horses":["Five horses ready 🐎","Saddling up 🐎"],
  "ducktrader-hne":["Hammer… engulfing… ⚔️","天地双剑 scanning"],
  "ducktrader-options":["Scorecard Sunday 📊","Checking my calls 🎯"],
  "ducktrader-sectors":["Where did the money go? 🔄","Sector rotation Friday"],
  "ducktrader-yields":["See you next month 🏦","Yields are monthly, chill"],
  "ducktrader-ig-bot":["Next Reel 06:07 📸","Carousel at 18:07","Road to 1M 🚀"],
  "ducktrader-drama-bot":["Zero to Duck ep 2? 🎬","Dex needs a script"],
  "ducktrader-fpl":["Captain pick? ⚽","Transfers deadline!"],
};
const SMALL = ["Coffee first ☕","Green screens 🟢","Who took my snack?","Nice view 🌆","Ship it 🚀","Quack.","Stay hydrated 💧","LGTM 👍","Back to work soon","Did you see that candle?"];
const DEPS = { "ducktrader-breadth":["ducktrader-200ema","ducktrader-horses","ducktrader-hne"], "ducktrader-alerts":["ducktrader-options","ducktrader-ig-bot"] };
const pick = a => a[Math.floor(Math.random()*a.length)];
const rnd = (a,b) => a + Math.random()*(b-a);

function ago(iso){ const s=(Date.now()-Date.parse(iso))/1000; if(s<60)return "just now"; if(s<3600)return Math.floor(s/60)+"m ago"; if(s<86400)return Math.floor(s/3600)+"h ago"; return Math.floor(s/86400)+"d ago"; }
function until(iso){ let s=(Date.parse(iso)-Date.now())/1000; if(s<=0)return "now"; const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60); return (d?d+"d ":"")+(d||h?h+"h ":"")+m+"m"; }
const short = (s,n=22) => (s||"").length>n ? s.slice(0,n-1)+"…" : (s||"");

function makeDuck(bot, i){
  const [c,r] = DESKS[i];
  return { bot, i, desk:[c,r], chair:[c,r+1], beside:[c+2,r+1], tie:TIES[i%TIES.length],
    tx:c, ty:r+1, x:(c+1)*T, y:(r+1)*T+12, path:[], task:null, si:0, pose:"back", wait:0,
    bubble:null, bubbleT:0, carry:null, phase:0, busy:null, cool:0 };
}
function lineFor(d){
  const b = d.bot, opts = [...(LINES[b.repo]||[]), ...SMALL];
  if (b.next_run) opts.push("Back on shift in "+until(b.next_run), "Next run in "+until(b.next_run));
  if (b.last_run && b.state==="ok") opts.push("Last run ✓ "+ago(b.last_run.started_at));
  return pick(opts);
}

// seats
function reserve(d, spot){ const k=spot.join(","); const o=Office.seats.get(k); if(o && o!==d) return false; Office.seats.set(k,d); d.seat=k; return true; }
function release(d){ if(d.seat && Office.seats.get(d.seat)===d) Office.seats.delete(d.seat); d.seat=null; }
function freeSpot(list){ const f = list.filter(s => !Office.seats.has(s.join(","))); return f.length ? pick(f) : null; }

function setTask(d, name, steps){ release(d); d.task={name,steps}; d.si=0; d.path=null; d.wait=0; d.carry=d.carry && name==="deliver" ? d.carry : null; }
function say(d, text, ms=2600){ d.bubble=text; d.bubbleT=performance.now()+ms; }

// ---------- task builders ----------
const goSeat = (spot, pose, ms, extra={}) => [{go:spot, seat:true}, {pose, ms, ...extra}];
function idleTask(d){
  const b = d.bot, longNap = !b.next_run || (Date.parse(b.next_run)-Date.now()) > 3*3600e3;
  const opts = [
    ["coffee",4],["fridge",2],["water",2],["meeting",2],["window",2],["desk",3],["beanbag",1],["sofa",longNap?3:1],["printer",1]
  ];
  let tot = opts.reduce((s,o)=>s+o[1],0), r=Math.random()*tot, act="desk";
  for (const [a,w] of opts){ if((r-=w)<0){ act=a; break; } }
  let s;
  switch(act){
    case "coffee": { const st=freeSpot([...SPOT.stoolFront,...SPOT.sofa]); s=[{go:SPOT.coffee},{pose:"front",ms:2200,say:"☕"},{carry:"☕"}]; if(st){ s.push({go:st,seat:true},{pose:"sit",ms:rnd(6e3,11e3),sayLine:true}); } s.push({carry:null}); break; }
    case "fridge": { const st=freeSpot(SPOT.stoolBack.concat(SPOT.stoolFront)); s=[{go:SPOT.fridge},{pose:"front",ms:1800,say:pick(["🥪","🍩","🧃","🍱"])},{carry:"🥪"}]; if(st){ s.push({go:st,seat:true},{pose:SPOT.stoolBack.some(p=>p+""===st+"")?"backsit":"sit",ms:rnd(6e3,10e3)}); } s.push({carry:null}); break; }
    case "water": s=[{go:SPOT.water},{pose:"front",ms:2500,say:"💧"}]; break;
    case "meeting": { const front=Math.random()<.5, st=freeSpot(front?SPOT.meetFront:SPOT.meetBack)||freeSpot(SPOT.meetFront); s=st?goSeat(st,SPOT.meetBack.some(p=>p+""===st+"")?"backsit":"sit",rnd(7e3,12e3),{sayLine:true}):[{go:[6,6]},{pose:"front",ms:3e3}]; break; }
    case "window": s=[{go:pick(SPOT.window)},{pose:"front",ms:rnd(3e3,6e3),sayLine:Math.random()<.5}]; break;
    case "beanbag": { const st=freeSpot(SPOT.beanbag); s=st?goSeat(st,"sit",rnd(8e3,14e3)):[{go:[16,29]},{pose:"front",ms:3e3}]; break; }
    case "sofa": { const st=freeSpot(SPOT.sofa); s=st?goSeat(st,longNap?"sleep":"sit",rnd(12e3,22e3)):[{go:[17,25]},{pose:"front",ms:3e3}]; break; }
    case "printer": s=[{go:SPOT.printer},{pose:"back",ms:2500,say:"🖨️"},{carry:"📄"},{go:d.chair},{pose:"desk",ms:2500},{carry:null}]; break;
    default: s=[{go:d.chair},{pose:"desk",ms:rnd(6e3,12e3)}];
  }
  setTask(d, "idle:"+act, s);
}
function workTask(d){ setTask(d,"work",[{go:d.chair},{say:pick(["Showtime! ⏰","On it 💻","Running "+short(d.bot.running?.[0]?.workflow||"",14)])},{pose:"desk",typing:true,until:()=>d.bot.state!=="running"}]); }
function failTask(d){
  const wf = short(d.bot.failing?.[0]?.workflow||"my run",16);
  setTask(d,"fail",[{go:d.chair},{say:"😣 "+wf+" failed"},{pose:"desk",ms:4000},{go:d.beside},{pose:"front",ms:2500,say:pick(["Need help!","Where did it break?","Red again…"])},{go:d.chair},{pose:"desk",ms:5000}]);
}
function lostTask(d){ const st=pick(SPOT.racks); setTask(d,"lost",[{go:st},{pose:"back",ms:3000,say:"Can't see my repo 🤔"},{pose:"back",ms:5000}]); }

function deliver(d, run){
  const deps = (DEPS[d.bot.repo]||[]).map(r=>Office.ducks.find(x=>x.bot.repo===r)).filter(Boolean);
  const done = "✅ "+short(run.workflow||"Run",16)+" "+(Date.now()-Date.parse(run.updated_at||run.started_at) < 120e3 ? "done" : ago(run.updated_at||run.started_at));
  const s=[{go:d.chair},{pose:"desk",ms:1600,say:done},{carry:deps.length?"📁":"✉️"}];
  deps.forEach((r,k)=>{
    const key="h"+d.i+"-"+r.i+"-"+Date.now();
    if (r.bot.state==="running"){ s.push({go:r.beside},{pose:"front",ms:1800,say:"Left data on your desk 📁"}); return; }
    s.push({go:r.beside},{sync:key,n:2},{pose:"front",ms:2000,say:"Fresh market data 📁"});
    setTask(r,"receive",[{go:r.chair},{sync:key,n:2},{pose:"front",ms:500},{pose:"front",ms:2000,say:pick(["Thanks! 🙏","Got it 👌","Perfect timing"])},{pose:"desk",ms:3000}]);
  });
  s.push({carry:"✉️"},{go:SPOT.mailbox},{pose:"back",ms:2200,say:d.bot.repo==="ducktrader-ig-bot"?"📸 Off to Instagram":"📨 Sent to Telegram"},{carry:null});
  setTask(d,"deliver",s);
}
function helpTask(h, f){
  const key="help"+h.i+"-"+Date.now();
  setTask(h,"help",[{go:[f.beside[0],f.beside[1]]},{sync:key,n:2,timeout:12e3},{pose:"front",ms:2400,say:"Let me check the log 🔍"},{pose:"front",ms:2400,say:"Tap your desk for the error"}]);
  setTask(f,"helped",[{go:f.chair},{sync:key,n:2,timeout:12e3},{pose:"desk",ms:2400},{pose:"desk",ms:2400,say:"Thanks… 🙏"}]);
  h.cool = performance.now()+45e3;
}
function chatTask(a, b){
  const pair = pick(SPOT.chat), key="c"+a.i+"-"+b.i+"-"+Date.now();
  const n = 2+Math.floor(Math.random()*2), sa=[{go:pair[0]},{sync:key,n:2,timeout:15e3}], sb=[{go:pair[1]},{sync:key,n:2,timeout:15e3}];
  for (let k=0;k<n;k++){ sa.push({pose:"front",ms:2400,sayLine:k%2===0,face:1}); sb.push({pose:"front",ms:2400,sayLine:k%2===1,face:-1}); }
  setTask(a,"chat",sa); setTask(b,"chat",sb);
}

// ---------- step runner ----------
function runDuck(d, now, dt){
  if (!d.task) return;
  const st = d.task.steps[d.si];
  if (!st){ release(d); d.task=null; return; }
  const next = () => { d.si++; d.path=null; d.wait=0; };
  if (st.go){
    if (!d.path){ d.path = bfs([d.tx,d.ty], st.go) || []; if (st.seat) reserve(d, st.go); d.pose="walk"; }
    if (!d.path.length){ d.x = d.tx*T+8; d.y = d.ty*T+12; next(); return; }
    const [nx,ny] = d.path[0], gx=nx*T+8, gy=ny*T+12, sp=dt*0.04;
    const dx=gx-d.x, dy=gy-d.y, dist=Math.hypot(dx,dy);
    d.pose="walk"; d.phase += dt;
    if (dist<=sp){ d.x=gx; d.y=gy; d.tx=nx; d.ty=ny; d.path.shift(); }
    else { d.x+=dx/dist*sp; d.y+=dy/dist*sp; }
    return;
  }
  if (st.carry!==undefined){ d.carry=st.carry; next(); return; }
  if (st.sync){
    let set = Office.syncs.get(st.sync); if(!set){ set=new Set(); Office.syncs.set(st.sync,set); }
    set.add(d); d.pose = d.pose==="walk" ? "front" : d.pose;
    if (!d.wait) d.wait = now + (st.timeout||25e3);
    if (set.size>=st.n || now>d.wait) next();
    return;
  }
  if (st.pose){
    if (!d.wait){ d.wait = now + (st.ms||1e9); d.pose=st.pose; d.typing=!!st.typing;
      if (st.say) say(d, st.say, Math.min(st.ms||2600, 2600));
      if (st.sayLine) say(d, lineFor(d), 2400);
      if (st.pose==="desk"){ d.x=(d.chair[0]+1)*T; d.y=d.chair[1]*T+12; }
    }
    if ((st.until && st.until()) || (!st.until && now>=d.wait)){ d.typing=false; next(); }
    return;
  }
  next();
}

// ---------- director ----------
function direct(now){
  const free = Office.ducks.filter(d=>!d.task);
  for (const d of Office.ducks){
    const s=d.bot.state;
    if (s==="running" && d.task?.name!=="work" && d.task?.name!=="deliver") workTask(d);
    else if (!d.task){
      if (s==="failed") failTask(d);
      else if (s==="unknown") lostTask(d);
    }
  }
  // helpers for failed ducks
  for (const f of Office.ducks.filter(d=>d.bot.state==="failed" && d.task?.name==="fail" && d.si>=3)){
    const h = Office.ducks.find(d=>!d.task && d.bot.state==="ok" && now>d.cool);
    if (h && Math.random()<0.25) helpTask(h,f);
  }
  // chats
  const idle = Office.ducks.filter(d=>!d.task && ["ok","idle"].includes(d.bot.state));
  if (idle.length>=2 && Math.random()<0.3){ const a=idle.splice(Math.floor(Math.random()*idle.length),1)[0], b=pick(idle); chatTask(a,b); }
  for (const d of Office.ducks.filter(d=>!d.task && ["ok","idle"].includes(d.bot.state))) idleTask(d);
  // replay the latest real finished run now and then
  if (now > (Office.nextReplay||0)){
    Office.nextReplay = now + rnd(90e3,150e3);
    const cand = Office.ducks.filter(d=>d.bot.last_run && d.bot.last_run.status==="completed" && d.bot.state==="ok" && d.task?.name?.startsWith("idle"))
      .sort((a,b)=>Date.parse(b.bot.last_run.started_at)-Date.parse(a.bot.last_run.started_at));
    if (cand.length) deliver(cand[Math.floor(Math.random()*Math.min(3,cand.length))], cand[0].bot.last_run.workflow ? cand[0].bot.last_run : cand[0].bot.last_run);
  }
  // clean old syncs
  if (Office.syncs.size>40) Office.syncs.clear();
}

// ---------- data in ----------
Office.setData = function(data){
  const prev = Office.lastData; Office.lastData = data;
  data.bots.slice(0,DESKS.length).forEach((b,i)=>{
    let d = Office.ducks[i];
    if (!d){ d = makeDuck(b,i); Office.ducks[i]=d; }
    const old = d.bot; d.bot = b;
    if (prev && old && old.repo===b.repo){
      const newRun = b.last_run && (!old.last_run || b.last_run.id!==old.last_run.id) && b.last_run.status==="completed";
      if ((old.state==="running" && b.state!=="running") || newRun){ if (b.last_run) deliver(d, b.last_run); }
      if (b.state==="running" && old.state!=="running") workTask(d);
    }
  });
  Office.ducks.length = Math.min(Office.ducks.length, data.bots.length);
  if (!prev) Office.nextReplay = performance.now()+4000;
};

// ---------- rendering ----------
let BG=null, cv, ctx, SCALE=1, CSSW=0;
function resize(){
  const wrap = cv.parentElement; CSSW = Math.min(wrap.clientWidth, 720);
  const s = CSSW/(MW*T), dpr = Math.min(window.devicePixelRatio||1, 3);
  cv.style.width = CSSW+"px"; cv.style.height = (MH*T*s)+"px";
  cv.width = Math.round(CSSW*dpr); cv.height = Math.round(MH*T*s*dpr); SCALE = s*dpr;
}
function sgtHour(){ const p = new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Singapore",hour:"numeric",minute:"numeric",hour12:false}).formatToParts(new Date()); return +p.find(x=>x.type==="hour").value + (+p.find(x=>x.type==="minute").value)/60; }
function sky(h){ if(h>=7&&h<17) return "#6fb7e8"; if(h>=17&&h<19) return "#e9925a"; if(h>=6&&h<7) return "#c9a0d8"; return "#0f1a3a"; }

function bubble(text, x, y){
  ctx.font = "500 5.2px Oswald, sans-serif";
  const w = Math.ceil(ctx.measureText(text).width)+6, h=9;
  let bx = Math.round(x - w/2); bx = Math.max(1, Math.min(MW*T-w-1, bx));
  const by = Math.round(y - h);
  ctx.fillStyle="#f4f1ea"; ctx.fillRect(bx,by,w,h); ctx.fillRect(bx-1,by+1,w+2,h-2);
  ctx.fillRect(Math.round(x)-1,by+h,3,2);
  ctx.fillStyle="#141414"; ctx.fillText(text, bx+3, by+6.6);
}
function drawScreen(d, now){
  const [cx,cy] = d.desk, x=cx*T+10, y=cy*T-6, s=d.bot.state, blink = Math.floor(now/400)%2;
  const bg = {running:"#2b2610",ok:"#0f2419",failed:"#2a0f12",idle:"#0b0c0e",unknown:"#15171b"}[s]||"#0b0c0e";
  ctx.fillStyle=bg; ctx.fillRect(x,y,12,9);
  if (s==="running"){ ctx.fillStyle="#f3c33b"; for(let k=0;k<4;k++){ const w=((Math.floor(now/250)+k*3)%7)+3; ctx.fillRect(x+1,y+1+k*2,w,1);} }
  else if (s==="ok"){ ctx.fillStyle="#3fbf7f"; [[2,5],[3,6],[4,7],[5,6],[6,5],[7,4],[8,3],[9,2]].forEach(([a,b])=>ctx.fillRect(x+a,y+b,1,1)); }
  else if (s==="failed"){ if(blink){ ctx.fillStyle="#e5484d"; ctx.fillRect(x+5,y+1,2,5); ctx.fillRect(x+5,y+7,2,1);} }
  else if (s==="unknown"){ ctx.fillStyle="#8b8f98"; ctx.fillRect(x+4,y+1,4,1); ctx.fillRect(x+7,y+2,1,2); ctx.fillRect(x+5,y+4,2,1); ctx.fillRect(x+5,y+6,1,1); }
  else { ctx.fillStyle="#2a3550"; const t=(now/60)%40; ctx.fillRect(x+1+Math.abs((t%20)-10)/1.1,y+1+Math.abs(((t*0.7)%14)-7)/1.1,2,2); }
  // name plate on desk front
  ctx.font="5px sans-serif"; ctx.fillText(d.bot.icon||"🦆", cx*T+2, cy*T+12);
}
function drawDuck(d, now){
  const x = Math.round(d.x), y = Math.round(d.y), p=d.pose;
  const sel = Office.sel===d;
  ctx.fillStyle="#0000004d"; ctx.fillRect(x-5,y+1,10,2); ctx.fillRect(x-4,y,8,4);
  if (sel){ ctx.fillStyle="#d4af37"; ctx.fillRect(x-7,y+2,14,1); ctx.fillRect(x-6,y+3,12,1); }
  const sx = x-6, Z=1.4;
  ctx.save(); ctx.translate(x,y); ctx.scale(Z,Z); ctx.translate(-x,-y);
  if (p==="desk" || p==="back" || p==="backsit"){
    const sy = p==="desk" ? y-13 : y-12;
    drawSprite(ctx, BACK, sx, sy, d.tie, { type: d.typing ? (Math.floor(now/140)%2)+1 : 0 });
  } else if (p==="sit" || p==="sleep"){
    drawSprite(ctx, FRONT, sx, y-13, d.tie, { maxRow:11, closed: p==="sleep" });
    if (p==="sleep"){ ctx.font="600 5px Oswald, sans-serif"; ctx.fillStyle="#f3d36b"; const k=(now/700)%3; ctx.globalAlpha=1-k/3; ctx.fillText("z",x+5+k*2,y-13-k*3); ctx.globalAlpha=1; }
  } else {
    const walking = p==="walk", bob = walking && Math.floor(d.phase/130)%2 ? -1 : 0;
    drawSprite(ctx, FRONT, sx, y-14+bob, d.tie, { walk: walking ? (Math.floor(d.phase/130)%2)+1 : 0, closed: Math.floor((now+d.i*700)/120)%35===0 });
  }
  ctx.restore();
  if (d.carry){ ctx.font="7px sans-serif"; ctx.fillText(d.carry, x+5, y-4); }
  // status marker
  const s=d.bot.state;
  if (s==="failed" && Math.floor(now/500)%2){ ctx.fillStyle="#e5484d"; ctx.fillRect(x-1,y-30,2,5); ctx.fillRect(x-1,y-24,2,1); }
  if (s==="unknown"){ ctx.fillStyle="#8b8f98"; ctx.font="600 6px Oswald"; ctx.fillText("?",x-1,y-23); }
  // label
  ctx.font = (sel?"600 ":"500 ")+"4.4px Oswald, sans-serif";
  const label = d.bot.name, w = ctx.measureText(label).width;
  ctx.fillStyle = "#000000a0"; ctx.fillRect(Math.round(x-w/2-1.5), y+4, Math.ceil(w+3), 6);
  ctx.fillStyle = sel ? "#f3d36b" : "#e8e4da"; ctx.fillText(label, x-w/2, y+8.6);
}
function frame(now){
  const dt = Math.min(50, now-(Office.t||now)); Office.t=now;
  if (Office.lastData){
    if (!Office.nextDirect || now>Office.nextDirect){ direct(now); Office.nextDirect = now+600; }
    Office.ducks.forEach(d=>runDuck(d, now, dt));
  }
  ctx.setTransform(SCALE,0,0,SCALE,0,0); ctx.imageSmoothingEnabled=false;
  ctx.drawImage(BG,0,0);
  const h = sgtHour(), skyc = sky(h);
  [[2,0],[7,0],[14,0],[18,0]].forEach(([tx,ty])=>{ ctx.fillStyle=skyc; ctx.fillRect(tx*T+1,ty*T+7,2*T-2,7); ctx.fillStyle="#0d0e10"; ctx.fillRect(tx*T+T-1,ty*T+7,2,7); if(h<6||h>=19){ ctx.fillStyle="#f4f1ea"; ctx.fillRect(tx*T+5+(tx%3),ty*T+9,1,1); ctx.fillRect(tx*T+20-(tx%4),ty*T+11,1,1);} });
  // whiteboard
  if (Office.lastData){
    const bots=Office.lastData.bots, runs=bots.reduce((s,b)=>s+(b.runs_24h||0),0), good=bots.filter(b=>b.state==="ok").length, help=bots.filter(b=>b.state==="failed").length, work=bots.filter(b=>b.state==="running").length;
    ctx.fillStyle="#141414"; ctx.font="600 5.4px Oswald, sans-serif"; ctx.fillText("TODAY", 3*T+5, T+2);
    ctx.font="500 4.6px Oswald, sans-serif"; ctx.fillStyle="#2a2f38"; ctx.fillText(runs+" runs / 24h", 3*T+28, T+2);
    ctx.fillStyle="#2b8a5c"; ctx.fillText(good+" good", 3*T+65, T+2);
    ctx.fillStyle="#b8860b"; ctx.fillText(work+" working", 3*T+5, T+7.5);
    ctx.fillStyle=help?"#c2373b":"#2a2f38"; ctx.fillText(help+" need help", 3*T+40, T+7.5);
  }
  // server LEDs
  for (let i=19;i<=22;i++) for(let k=0;k<5;k++){ const on = (Math.sin(now/300+i*7+k*3)>0.2); ctx.fillStyle = on ? (k%2?"#3fbf7f":"#d4af37") : "#272c34"; ctx.fillRect(i*T+11,T-3+k*4,1,1); ctx.fillRect(i*T+9,T-3+k*4,1,1); }
  // TV
  ctx.fillStyle = `hsl(${(now/40)%360},35%,30%)`; ctx.fillRect(19*T+3,32*T+2,3*T-6,7);
  Office.ducks.forEach(d=>drawScreen(d, now));
  // night lighting
  const night = h>=19||h<6 ? 0.42 : h>=17 ? 0.15 : h<7 ? 0.25 : 0;
  const sorted = [...Office.ducks].sort((a,b)=>a.y-b.y);
  sorted.forEach(d=>drawDuck(d, now));
  if (night){
    ctx.fillStyle=`rgba(8,12,35,${night})`; ctx.fillRect(0,0,MW*T,MH*T);
    ctx.globalCompositeOperation="lighter";
    Office.ducks.forEach(d=>{ const [cx,cy]=d.desk; const c={running:"243,195,59",ok:"63,191,127",failed:"229,72,77"}[d.bot.state]; if(!c) return; const g=ctx.createRadialGradient(cx*T+16,cy*T-2,1,cx*T+16,cy*T-2,22); g.addColorStop(0,`rgba(${c},.28)`); g.addColorStop(1,"rgba(0,0,0,0)"); ctx.fillStyle=g; ctx.fillRect(cx*T-8,cy*T-26,48,48); });
    [[2,23],[9,23],[20,25],[6,4]].forEach(([tx,ty])=>{ const g=ctx.createRadialGradient(tx*T+8,ty*T+8,2,tx*T+8,ty*T+8,40); g.addColorStop(0,"rgba(255,210,120,.22)"); g.addColorStop(1,"rgba(0,0,0,0)"); ctx.fillStyle=g; ctx.fillRect(tx*T-40,ty*T-40,96,96); });
    ctx.globalCompositeOperation="source-over";
  }
  // bubbles on top
  sorted.forEach(d=>{ if (d.bubble && now<d.bubbleT){ const top = d.pose==="desk"||d.pose==="sit"||d.pose==="sleep"||d.pose==="backsit" ? d.y-20 : d.y-22; bubble(d.bubble, d.x, top - (d.bot.state==="failed"?7:0)); } });
  // room labels
  ctx.font="600 5px Oswald, sans-serif"; ctx.fillStyle="#d4af37b0";
  [["MEETING ROOM",1.2,6.8],["SERVER · MAILROOM",13.2,6.8],["TRADING FLOOR",1.2,8.6],["PANTRY",1.2,32.8],["LOUNGE",14.2,32.8]].forEach(([t,x,y])=>ctx.fillText(t,x*T,y*T));
  requestAnimationFrame(frame);
}

Office.start = function(canvas, onPick){
  cv = canvas; ctx = cv.getContext("2d"); BG = buildBG(); resize();
  window.addEventListener("resize", resize);
  cv.addEventListener("click", e=>{
    const r = cv.getBoundingClientRect(), k = (MW*T)/r.width;
    const mx = (e.clientX-r.left)*k, my = (e.clientY-r.top)*k;
    let best=null, bd=14;
    for (const d of Office.ducks){ const dd=Math.hypot(d.x-mx, d.y-8-my); if(dd<bd){bd=dd;best=d;} }
    if (!best){ const tx=Math.floor(mx/T), ty=Math.floor(my/T); best = Office.ducks.find(d=>(tx===d.desk[0]||tx===d.desk[0]+1)&&(ty===d.desk[1]||ty===d.desk[1]-1)); }
    if (best){ Office.sel=best; say(best, lineFor(best), 2600); onPick(best.bot); }
  });
  requestAnimationFrame(frame);
};
window.Office = Office; Office._deliver = deliver;

})();
