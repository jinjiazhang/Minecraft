"""Build native Bedrock tools and a six-colored luminous rainbow ore; no external artwork."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
VERSION=[1,0,1]
BP='33be1044-feb9-4e37-a46d-8c1311205ff8'
RP='e903b1ed-8dba-4754-a898-118b189a07de'
def write(p,d):
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
write(ROOT/'pack/manifest.json',{'format_version':2,'header':{'name':'彩虹矿井 · 百万竞赛','description':'连续矿层 / 三个入口 / 挖矿卖矿 / 镐子升级 / 彩虹矿石夺冠','uuid':BP,'version':VERSION,'min_engine_version':[1,26,30]},'modules':[{'type':'data','uuid':'ad3dfd92-3a23-47d7-9e97-116db87d2999','version':VERSION},{'type':'script','language':'javascript','uuid':'7f94af9b-e2f2-43a0-ad12-753731f0109c','version':VERSION,'entry':'scripts/main.js'}],'dependencies':[{'module_name':'@minecraft/server','version':'2.1.0'},{'module_name':'@minecraft/server-ui','version':'2.0.0'},{'uuid':RP,'version':VERSION}]})
write(ROOT/'resource_pack/manifest.json',{'format_version':2,'header':{'name':'彩虹矿井 · 界面与矿石','description':'透明顶部状态栏 / 发光彩虹矿石','uuid':RP,'version':VERSION,'min_engine_version':[1,26,30]},'modules':[{'type':'resources','uuid':'afcf0110-12f2-4808-9a69-62e8dba23697','version':VERSION}]})
tools=[('pick_'+str(i),name,'采矿',icon) for i,(name,icon) in enumerate([('矿工木镐','wood_pickaxe'),('精钢镐','iron_pickaxe'),('金刚镐','diamond_pickaxe'),('扩幅矿镐','gold_pickaxe'),('重型破岩镐','netherite_pickaxe'),('彩虹勘探镐','netherite_pickaxe')])]+[('guide','矿工指南','指南','book_normal'),('return','回城器 · 站定3秒','回城','compass_item')]
atlas={}
for id,name,button,icon in tools:
    atlas['rush_'+id]={'textures':'textures/items/'+icon}
    write(ROOT/f'pack/items/{id}.json',{'format_version':'1.26.30','minecraft:item':{'description':{'identifier':'rush:'+id,'menu_category':{'category':'equipment'}},'components':{'minecraft:display_name':{'value':name},'minecraft:icon':{'textures':{'default':'rush_'+id}},'minecraft:glint':id=='pick_5','minecraft:max_stack_size':1,'minecraft:hand_equipped':id.startswith('pick_'),'minecraft:interact_button':button,'minecraft:use_modifiers':{'use_duration':3600,'movement_modifier':1},'minecraft:food':{'nutrition':0,'saturation_modifier':0,'can_always_eat':True},'minecraft:use_animation':'none'}}})
atlas['rush_rainbow_gem']={'textures':'textures/items/nether_star'}
write(ROOT/'resource_pack/textures/item_texture.json',{'resource_pack_name':'rainbow_rush','texture_name':'atlas.items','texture_data':atlas})
write(ROOT/'pack/items/rainbow_gem.json',{'format_version':'1.26.30','minecraft:item':{'description':{'identifier':'rush:rainbow_gem','menu_category':{'category':'items'}},'components':{'minecraft:display_name':{'value':'§d彩虹矿石 · 价值1,000,000金币'},'minecraft:icon':{'textures':{'default':'rush_rainbow_gem'}},'minecraft:glint':True,'minecraft:max_stack_size':1}}})
colors=['red','orange','yellow','lime','light_blue','purple']
terrain={'resource_pack_name':'rainbow_rush','texture_name':'atlas.terrain','padding':8,'num_mip_levels':4,'texture_data':{'rush_'+c:{'textures':'textures/blocks/concrete_'+c} for c in colors}}
write(ROOT/'resource_pack/textures/terrain_texture.json',terrain)
materials={'*':{'texture':'rush_purple','render_method':'opaque','ambient_occlusion':0,'face_dimming':False}}
for face,color in zip(['up','down','north','south','east','west'],colors):materials[face]={'texture':'rush_'+color,'render_method':'opaque','ambient_occlusion':0,'face_dimming':False}
write(ROOT/'pack/blocks/rainbow_ore.json',{'format_version':'1.26.30','minecraft:block':{'description':{'identifier':'rush:rainbow_ore','menu_category':{'category':'construction'}},'components':{'minecraft:display_name':'彩虹矿石','minecraft:geometry':'minecraft:geometry.full_block','minecraft:material_instances':materials,'minecraft:light_emission':15,'minecraft:destructible_by_mining':{'seconds_to_destroy':100},'minecraft:destructible_by_explosion':False,'minecraft:map_color':'#dc64ee'}}})
hud=json.loads((ROOT.parent/'stardew/resource_pack/ui/hud_screen.json').read_text(encoding='utf-8'))
write(ROOT/'resource_pack/ui/hud_screen.json',hud)
write(ROOT/'resource_pack/animations/mining.animation.json',{'format_version':'1.8.0','animations':{'animation.rush.pick_swing':{'loop':False,'animation_length':0.28,'bones':{'rightarm':{'rotation':{'0.0':[0,0,0],'0.07':[-55,-12,12],'0.14':[24,8,-10],'0.28':[0,0,0]}}}}}})
# Small textured fragments, with a larger burst only after successful collection.
# Reuse Mojang textures; these are geometry/particle definitions, not new bitmap art.
chip_colors={'dirt':'brown','stone':'light_gray','rock':'gray','wood':'brown','iron':'white','gold':'yellow','gem':'light_blue','water':'blue','lava':'orange','rainbow':'purple'}
for material,color in chip_colors.items():
    for phase,count in [('hit',4),('break',12)]:
        components={
            'minecraft:emitter_rate_instant':{'num_particles':count},
            'minecraft:emitter_lifetime_once':{'active_time':0.05},
            'minecraft:emitter_shape_sphere':{'radius':0.12,'direction':'outwards'},
            'minecraft:particle_lifetime_expression':{'max_lifetime':0.45 if phase=='hit' else 0.7},
            'minecraft:particle_initial_speed':1.2 if phase=='hit' else 2.1,
            'minecraft:particle_motion_dynamic':{'linear_acceleration':[0,-4,0],'linear_drag_coefficient':1},
            'minecraft:particle_appearance_billboard':{'size':[0.025,0.055] if material=='wood' else [0.04,0.04],'facing_camera_mode':'lookat_xyz','uv':{'texture_width':16,'texture_height':16,'uv':[0,0],'uv_size':[4,4]}}
        }
        if material in ('gem','lava','rainbow'):
            components['minecraft:particle_appearance_tinting']={'color':{'interpolant':'variable.particle_age / variable.particle_lifetime','gradient':{'0.0':'#FFFFFF','0.3':'#FFCC66' if material=='lava' else '#AAEEFF','1.0':'#FF5500' if material=='lava' else '#FF66DD'}}}
        write(ROOT/f'resource_pack/particles/{material}_{phase}.json',{'format_version':'1.10.0','particle_effect':{'description':{'identifier':f'rush:{material}_{phase}','basic_render_parameters':{'material':'particles_alpha','texture':'textures/blocks/concrete_'+color}},'components':components}})
print('Built rainbow rush: 8 tools, trophy, glowing block and transparent HUD')
