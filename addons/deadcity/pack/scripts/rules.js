export const BASE={x:-6939.5,y:55,z:-6584.5};
export const LIMITS={minX:-7100,maxX:-6650,minZ:-6800,maxZ:-6400};
export const ROUND_SECONDS=1200;
export const WEAPONS=[
 {name:'生存手枪',damage:7,pellets:1,range:45,interval:9,mag:12,reload:32,reserve:72,cost:0},
 {name:'泵动霰弹枪',damage:5,pellets:6,range:24,interval:22,mag:6,reload:48,reserve:48,cost:90},
 {name:'冲锋枪',damage:7,pellets:1,range:42,interval:3,mag:30,reload:36,reserve:150,cost:180},
 {name:'突击步枪',damage:15,pellets:1,range:65,interval:5,mag:30,reload:36,reserve:150,cost:320},
 {name:'轻机枪',damage:16,pellets:1,range:60,interval:3,mag:60,reload:64,reserve:240,cost:550}
];
// Exterior supply sites; coordinates are checked against the official height map.
export const SITES=[
 {id:'c1',name:'旧街角补给',x:-6890,z:-6492,value:22},
 {id:'c2',name:'东侧物资站',x:-6800,z:-6500,value:26},
 {id:'c3',name:'南侧药品站',x:-6720,z:-6580,value:30},
 {id:'c4',name:'西侧零件站',x:-6800,z:-6680,value:26},
 {id:'c5',name:'北侧储备站',x:-7030,z:-6650,value:30}
];
export const EXITS=[{id:'e1',name:'东侧撤离点',x:-6740,z:-6447},{id:'e2',name:'西侧撤离点',x:-6740,z:-6740}];
export const TYPES=['walker','runner','screamer','armored'];
export function dist(a,b){return Math.hypot(a.x-b.x,a.z-b.z);}
export function inside(p){return p.x>=LIMITS.minX&&p.x<=LIMITS.maxX&&p.z>=LIMITS.minZ&&p.z<=LIMITS.maxZ;}
export function profile(raw){
 try{const a=JSON.parse(raw||'{}');return{scrap:Math.max(0,Math.min(1e7,Number(a.scrap)||0)),tier:Math.max(0,Math.min(4,Math.floor(Number(a.tier)||0))),wins:Math.max(0,Math.floor(Number(a.wins)||0))};}
 catch{return{scrap:0,tier:0,wins:0};}
}
export function newRaid(tier,now){const w=WEAPONS[tier];return{tier,start:now,ammo:w.mag,reserve:w.reserve,bag:0,kills:0,meds:2,lures:3,barriers:2,stamina:100,looted:[],reloadUntil:0,nextShot:0,extract:0,lastHit:0,noiseUntil:0,holding:false,search:0,site:'',boundary:0};}
export function collect(r,id){
 const s=SITES.find(s=>s.id===id);if(!s||r.looted.includes(id))return false;
 r.looted.push(id);r.bag+=s.value;r.reserve=Math.min(360,r.reserve+24);r.meds=Math.min(4,r.meds+1);return true;
}
export function settle(p,r,success){return success?{...p,scrap:p.scrap+r.bag+(r.looted.length>=3?40:0),wins:p.wins+1}:{...p};}
export function purchase(p){const t=p.tier+1;if(t>=WEAPONS.length||p.scrap<WEAPONS[t].cost)return null;return{...p,scrap:p.scrap-WEAPONS[t].cost,tier:t};}
export function reload(r,now){if(r.reloadUntil||r.ammo>=WEAPONS[r.tier].mag||r.reserve<=0)return false;r.reloadUntil=now+WEAPONS[r.tier].reload;return true;}
export function finishReload(r,now){if(!r.reloadUntil||now<r.reloadUntil)return;const n=Math.min(WEAPONS[r.tier].mag-r.ammo,r.reserve);r.ammo+=n;r.reserve-=n;r.reloadUntil=0;}
export function takeShot(r,now){finishReload(r,now);if(r.reloadUntil||now<r.nextShot||r.ammo<=0)return false;r.ammo--;r.nextShot=now+WEAPONS[r.tier].interval;r.noiseUntil=now+160;return true;}
export function detectionRadius(sneak,sprint){return sneak?7:sprint?28:18;}
export function extraction(r,eligible,hurt){r.extract=eligible&&!hurt?r.extract+1:0;return r.extract>=12;}
