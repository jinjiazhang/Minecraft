export const SEASONS=['春','夏','秋','冬'];
export const CROPS={parsnip:{name:'防风草',season:0,seed:20,sell:35,days:4,block:'carrots'},potato:{name:'土豆',season:0,seed:50,sell:80,days:6,block:'potatoes'},cauliflower:{name:'花椰菜',season:0,seed:80,sell:175,days:12,block:'beetroot'},melon:{name:'甜瓜',season:1,seed:80,sell:250,days:12,block:'carrots'},blueberry:{name:'蓝莓',season:1,seed:80,sell:50,days:13,regrow:4,yield:3,block:'beetroot'},pumpkin:{name:'南瓜',season:2,seed:100,sell:320,days:13,block:'potatoes'},cranberry:{name:'蔓越莓',season:2,seed:240,sell:75,days:7,regrow:5,yield:2,block:'beetroot'}};
export const GOODS={dirt:{name:'泥土',sell:1},amethyst:{name:'紫水晶',sell:100},diamond:{name:'钻石',sell:150},wood:{name:'木材',sell:2},stone:{name:'石头',sell:2},copper:{name:'铜矿石',sell:5},iron:{name:'铁矿石',sell:10},gold:{name:'金矿石',sell:25},fish:{name:'沙丁鱼',sell:40},carp:{name:'鲤鱼',sell:30},leek:{name:'韭葱',sell:60},egg:{name:'鸡蛋',sell:50},milk:{name:'牛奶',sell:125}};
export const NPCS=[['Lewis','刘易斯',128,91,'欢迎来到鹈鹕镇。爷爷一定希望看到农场重新焕发生机。','parsnip'],['Pierre','皮埃尔',124,48,'新鲜种子就在柜台，记得每天给作物浇水。','cauliflower'],['Robin','罗宾',96,12,'山里有不少木材。想养动物，就来找我建造鸡舍吧。','wood'],['Abigail','阿比盖尔',139,54,'我一直想去矿洞冒险。你找到什么有趣的东西了吗？','pumpkin'],['Willy','威利',149,132,'把浮标抛进水里，鱼儿咬钩后要稳住。','fish'],['Linus','莱纳斯',123,11,'这里的山林给了我需要的一切。','leek'],['Leah','莉亚',56,103,'森林的颜色每天都不一样。我正在寻找下一件作品的灵感。','leek'],['Gus','格斯',123,74,'忙完农活来坐坐吧，沙拉能让你恢复些体力。','milk']];
export const fresh=()=>({version:1,day:1,season:0,year:1,minute:360,rain:false,gold:500,plots:{},bag:{},seeds:{parsnip:15},shipping:{},friends:{},talked:{},gifts:{},bundle:[],coop:false,barn:false,chickens:0,cows:0,feed:false,harvests:0,quest:false,xp:{farming:0,fishing:0,mining:0,foraging:0},mine:1});
export function add(bag,id,n=1){bag[id]=(bag[id]||0)+n;if(bag[id]<=0)delete bag[id];}
export function price(id){return CROPS[id]?.sell??GOODS[id]?.sell??0;}
export function plant(s,key,id){const c=CROPS[id],p=s.plots[key];if(!p||p.crop||!c||c.season!==s.season||!(s.seeds[id]>0))return false;add(s.seeds,id,-1);p.crop=id;p.age=0;return true;}
export function harvest(s,key){const p=s.plots[key],c=CROPS[p?.crop];if(!c||p.age<c.days)return false;add(s.bag,p.crop,c.yield||1);s.harvests++;s.xp.farming+=8;if(c.regrow)p.age=c.days-c.regrow;else{delete p.crop;p.age=0;}return true;}
export function buySeeds(s,id,count=5){const c=CROPS[id];if(!c||c.season!==s.season||s.gold<c.seed*count||!Number.isInteger(count)||count<1)return false;s.gold-=c.seed*count;add(s.seeds,id,count);return true;}
export function ship(s,id,count=s.bag[id]){if(!Number.isInteger(count)||count<=0||!(s.bag[id]>=count))return false;add(s.shipping,id,count);add(s.bag,id,-count);return true;}
export function withdraw(s,id,count=s.shipping[id]){if(!Number.isInteger(count)||count<=0||!(s.shipping[id]>=count))return false;add(s.shipping,id,-count);add(s.bag,id,count);return true;}
export function nextDay(s,random=Math.random){
 let income=0;for(const [id,n]of Object.entries(s.shipping))income+=price(id)*n;s.gold+=income;s.shipping={};
 for(const p of Object.values(s.plots))if(p.crop&&p.water)p.age++;
 s.day++;if(s.day>28){s.day=1;s.season=(s.season+1)%4;if(s.season===0)s.year++;}
 s.minute=360;s.rain=s.season!==3&&random()<.2;s.talked={};s.gifts={};
 for(const p of Object.values(s.plots)){if(p.crop&&CROPS[p.crop].season!==s.season){delete p.crop;p.age=0;}p.water=s.rain;}
 if(s.feed){add(s.bag,'egg',s.chickens);add(s.bag,'milk',s.cows);}s.feed=false;
 return income;
}
export function talk(s,id){if(s.talked[id])return false;s.talked[id]=true;s.friends[id]=Math.min(2500,(s.friends[id]||0)+20);return true;}
export function gift(s,id,item){if(s.gifts[id]||!(s.bag[item]>0))return false;add(s.bag,item,-1);s.gifts[id]=true;const npc=NPCS.find(n=>n[0]===id);s.friends[id]=Math.min(2500,(s.friends[id]||0)+(npc?.[5]===item?80:20));return true;}
export function donate(s,id){if(!['parsnip','potato','cauliflower'].includes(id)||s.bundle.includes(id)||!(s.bag[id]>0))return false;add(s.bag,id,-1);s.bundle.push(id);if(s.bundle.length===3)s.gold+=1000;return true;}
