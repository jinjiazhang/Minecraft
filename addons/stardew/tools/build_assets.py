"""Generate native-touch farm tools using Minecraft's built-in artwork."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def write(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
write(ROOT/'pack/manifest.json',{'format_version':2,'header':{'name':'星露谷 · 农场与鹈鹕镇','description':'标准农场、季节种植、钓鱼、出货与小镇生活','uuid':'bb57d576-3f63-485f-8ed6-d38614103473','version':[1,0,1],'min_engine_version':[1,26,30]},'modules':[{'type':'data','uuid':'b65d37bc-a20a-4c10-b5a0-9c0328607dba','version':[1,0,1]},{'type':'script','language':'javascript','uuid':'c4a2dc27-1416-49bd-b036-dca89e11e2cb','version':[1,0,1],'entry':'scripts/main.js'}],'dependencies':[{'module_name':'@minecraft/server','version':'2.1.0'},{'module_name':'@minecraft/server-ui','version':'2.0.0'}]})
for id,name,button,icon in [('journal','农场日记','打开日记','book_normal'),('hoe','锄头','开垦','wood_hoe'),('seeds','种子袋','播种','seeds_wheat'),('water','浇水壶','浇水','bucket_water'),('harvest','收获篮','收获','wheat'),('axe','斧头','砍伐','stone_axe'),('pick','镐','采矿','stone_pickaxe'),('rod','鱼竿','钓鱼 / 抬杆','fishing_rod_uncast')]:
    write(ROOT/f'pack/items/{id}.json',{'format_version':'1.26.30','minecraft:item':{'description':{'identifier':'valley:'+id,'menu_category':{'category':'equipment'}},'components':{'minecraft:display_name':{'value':name},'minecraft:icon':{'textures':{'default':icon}},'minecraft:max_stack_size':1,'minecraft:hand_equipped':True,'minecraft:interact_button':button,'minecraft:use_modifiers':{'use_duration':3600,'movement_modifier':1},'minecraft:food':{'nutrition':0,'saturation_modifier':0,'can_always_eat':True},'minecraft:use_animation':'none'}}})
print('Generated farm pack and eight touch tools')
