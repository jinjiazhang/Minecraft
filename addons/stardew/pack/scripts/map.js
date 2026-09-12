// Original block-built interpretation: farm west, town east, mountains north, beach south.
export const Y=200;
export const HOME={x:32.5,y:Y+1,z:27.5};
export const LOCATIONS=[['农舍 · 睡觉',32,24],['出货箱 · 隔夜结算',45,30],['皮埃尔杂货店',124,46],['木匠商店 · 罗宾',96,12],['星之果实餐吧',124,72],['社区中心',149,18],['矿洞入口',166,12],['海滩 · 钓鱼',148,139],['森林池塘',35,120]];
export function isPlot(x,z){return x>=16&&x<=49&&z>=40&&z<=69;}
export function commands(){
 const out=[];const fill=(a,b,c,d,e,f,id)=>out.push(`fill ${a} ${b} ${c} ${d} ${e} ${f} ${id}`);
 for(let x=0;x<192;x+=16)for(let z=0;z<160;z+=16){fill(x,199,z,x+15,199,z+15,'bedrock');fill(x,200,z,x+15,200,z+15,'grass_block');fill(x,201,z,x+15,220,z+15,'air');}
 fill(0,201,0,191,204,0,'oak_leaves');fill(0,201,159,191,204,159,'oak_leaves');fill(0,201,0,0,204,159,'oak_leaves');fill(191,201,0,191,204,159,'oak_leaves');
 fill(1,200,130,190,200,158,'sand');fill(1,200,143,190,200,158,'water');
 fill(88,200,2,90,200,138,'water');fill(91,200,106,178,200,109,'water');
 fill(29,200,29,33,200,126,'grass_path');fill(30,200,79,183,200,83,'grass_path');fill(114,200,24,118,200,140,'grass_path');fill(79,200,26,181,200,29,'grass_path');fill(116,200,46,165,200,49,'grass_path');fill(116,200,71,172,200,74,'grass_path');fill(87,200,79,91,200,83,'oak_planks');fill(114,200,105,118,200,110,'oak_planks');
 fill(17,200,100,27,200,112,'water');fill(28,200,119,43,200,127,'water');fill(134,200,3,151,200,12,'water');
 function house(x,z,w,d,wall,roof){
  fill(x,200,z,x+w,200,z+d,'oak_planks');fill(x,201,z,x+w,205,z+d,wall);fill(x+1,201,z+1,x+w-1,204,z+d-1,'air');
  fill(x-1,206,z-1,x+w+1,206,z+d+1,roof);for(let i=1;i<=3;i++)fill(x-1+i,206+i,z-1,x+w+1-i,206+i,z+d+1,roof);
  fill(x+2,202,z+d,x+3,203,z+d,'glass_pane');fill(x+w-3,202,z+d,x+w-2,203,z+d,'glass_pane');
  fill(x+Math.floor(w/2),201,z+d,x+Math.floor(w/2)+1,203,z+d,'air');fill(x+2,201,z+2,x+4,201,z+2,'bookshelf');fill(x+w-2,201,z+2,x+w-2,201,z+3,'crafting_table');fill(x+1,204,z+1,x+1,204,z+1,'sea_lantern');
 }
 house(22,12,19,16,'oak_planks','red_terracotta');fill(25,201,16,26,201,18,'red_wool');fill(45,201,30,46,201,31,'barrel');
 house(112,32,23,17,'smooth_sandstone','green_terracotta');house(111,60,24,15,'brick_block','red_terracotta');house(139,83,16,15,'yellow_terracotta','orange_terracotta');house(153,34,20,17,'white_terracotta','blue_terracotta');house(156,61,18,16,'brick_block','gray_terracotta');house(95,88,19,14,'white_terracotta','red_terracotta');house(140,13,23,14,'mossy_stone_bricks','green_terracotta');house(82,3,22,13,'oak_planks','orange_terracotta');house(46,96,17,14,'spruce_planks','brown_terracotta');house(139,124,20,14,'spruce_planks','gray_terracotta');
 fill(148,200,139,151,200,153,'oak_planks');
 fill(161,201,2,186,209,18,'stone');fill(166,201,10,171,204,18,'air');fill(166,201,10,166,201,10,'lantern');
 // Accessible mine room and ladder exit, same vertical plane as outdoors.
 fill(161,201,4,184,205,9,'air');fill(174,201,5,176,201,6,'copper_ore');fill(180,201,5,182,201,6,'iron_ore');fill(183,202,8,183,202,8,'sea_lantern');
 fill(15,200,39,50,200,70,'dirt');
 for(let x=6;x<77;x+=9)for(let z=88;z<128;z+=9){if((x>15&&x<45&&z>98)||(x>43&&x<67&&z<113))continue;fill(x,201,z,x,205,z,'oak_log');fill(x-2,205,z-2,x+2,207,z+2,'oak_leaves');}
 for(let x=7;x<70;x+=13)for(const z of [5,74]){fill(x,201,z,x,205,z,'oak_log');fill(x-2,205,z-2,x+2,207,z+2,'oak_leaves');}
 for(let x=101;x<180;x+=16)for(const z of [30,79,115]){fill(x,201,z,x,203,z,'oak_fence');fill(x,204,z,x,204,z,'sea_lantern');}
 for(let x=9;x<74;x+=8)for(let z=43;z<69;z+=8){if(isPlot(x,z))continue;fill(x,201,z,x,201,z,(x+z)%3?'oak_log':'cobblestone');}
 // Animal yard, fountain, cemetery and flower garden.
 fill(57,201,15,72,201,15,'oak_fence');fill(57,201,15,57,201,30,'oak_fence');fill(72,201,15,72,201,30,'oak_fence');fill(57,201,30,72,201,30,'oak_fence');
 fill(127,201,84,133,201,89,'stone_bricks');fill(128,201,85,132,201,88,'water');fill(130,202,86,130,204,86,'stone_bricks');
 for(let x=164;x<181;x+=4)fill(x,201,95,x,202,95,'stone_bricks');
 for(let x=143;x<161;x+=3)fill(x,201,58,x,201,58,'poppy');
 return out;
}
