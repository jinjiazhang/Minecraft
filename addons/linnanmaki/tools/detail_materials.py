"""Measured half-metre shapes and a compact adaptive colour resource pack."""
import json
from pathlib import Path
import numpy as np
from PIL import Image

RP_UUID='80e6b767-badb-47e1-bb10-c5d26066bd62'


def lab(rgb):
    v=np.asarray(rgb,dtype=float)/255
    v=np.where(v>.04045,((v+.055)/1.055)**2.4,v/12.92)
    xyz=v@np.array([[.4124564,.3575761,.1804375],[.2126729,.7151522,.0721750],[.0193339,.1191920,.9503041]]).T
    xyz/=np.array([.95047,1,1.08883])
    f=np.where(xyz>.008856,np.cbrt(xyz),7.787*xyz+16/116)
    return np.stack((116*f[...,1]-16,500*(f[...,0]-f[...,1]),200*(f[...,1]-f[...,2])),axis=-1)


def nearest(rgb,palette):
    result=[]
    p=lab(palette)
    for i in range(0,len(rgb),4096):
        delta=lab(rgb[i:i+4096])[:,None,:]-p[None,:,:]
        result.append(np.sum(delta*delta,axis=2).argmin(1))
    return np.concatenate(result)


def adaptive_palette(rgb):
    # Deterministic median-cut clusters, then perceptual rather than RGB matching.
    sample=np.asarray(rgb[::max(1,len(rgb)//200000)],dtype=np.uint8)
    image=Image.fromarray(sample.reshape(-1,1,3)).quantize(colors=128,method=Image.Quantize.MEDIANCUT)
    return np.array(image.getpalette(),dtype=np.uint8).reshape(-1,3)[:128]


def shape(mask):
    """Octant bit index: 4*x+2*y+z; x/y/z grow east/up/south."""
    cubes=[]; positions=[]
    for x in range(2):
        for y in range(2):
            for z in range(2):
                if mask&(1<<(4*x+2*y+z)):
                    pos=[x*8-8,y*8,z*8-8]
                    positions.append(pos)
                    # Omit internal faces: two neighbouring half-cubes share a face.
                    faces={}
                    for name,(dx,dy,dz) in {'west':(-1,0,0),'east':(1,0,0),'down':(0,-1,0),'up':(0,1,0),'north':(0,0,-1),'south':(0,0,1)}.items():
                        a,b,c=x+dx,y+dy,z+dz
                        if not(0<=a<2 and 0<=b<2 and 0<=c<2 and mask&(1<<(4*a+2*b+c))):
                            faces[name]={'uv':[0,0],'uv_size':[8,8]}
                    cubes.append({'origin':pos,'size':[8,8,8],'uv':faces})
    points=np.array(positions)
    collision={'origin':points.min(0).tolist(),'size':(points.max(0)-points.min(0)+8).tolist()}
    return cubes,collision


def write_packs(bp,rp,palette):
    def save(path,obj):
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_text(json.dumps(obj,separators=(',',':')),encoding='utf-8')
    save(rp/'manifest.json',{'format_version':2,'header':{'name':'Linnanmäki · 半米细节材质','description':'City of Helsinki 2017 / CC BY 4.0. 0.5m geometry, 128 measured colours.','uuid':RP_UUID,'version':[0,2,0],'min_engine_version':[1,21,90]},'modules':[{'type':'resources','uuid':'ba7d70e2-53ee-4ced-93bd-d2949478d0c4','version':[0,2,0]}]})
    permutations=[]; geometries=[]
    for mask in range(1,256):
        cubes,collision=shape(mask)
        name=f'geometry.lintsi.half_{mask}'
        geometries.append({'description':{'identifier':name,'texture_width':16,'texture_height':16,'visible_bounds_width':2,'visible_bounds_height':2,'visible_bounds_offset':[0,.5,0]},'bones':[{'name':'surface','pivot':[0,0,0],'cubes':cubes}]})
        permutations.append({'condition':f"q.block_state('lintsi:mask_lo') == {mask%16} && q.block_state('lintsi:mask_hi') == {mask//16}",'components':{'minecraft:geometry':'minecraft:geometry.full_block' if mask==255 else name,'minecraft:collision_box':collision,'minecraft:selection_box':collision}})
    texture_data={}
    for i,color in enumerate(palette):
        texture=f'lintsi_color_{i}'
        p=rp/f'textures/blocks/{texture}.png'; p.parent.mkdir(parents=True,exist_ok=True)
        Image.new('RGB',(16,16),tuple(map(int,color))).save(p)
        texture_data[texture]={'textures':f'textures/blocks/{texture}'}
        permutations.append({'condition':f"q.block_state('lintsi:color_lo') == {i%16} && q.block_state('lintsi:color_hi') == {i//16}",'components':{'minecraft:material_instances':{'*':{'texture':texture,'render_method':'opaque','ambient_occlusion':False,'face_dimming':False}},'minecraft:map_color':'#'+''.join(f'{v:02x}' for v in color)}})
    save(rp/'models/blocks/half_shapes.geo.json',{'format_version':'1.12.0','minecraft:geometry':geometries})
    save(rp/'textures/terrain_texture.json',{'resource_pack_name':'lintsi_detail','texture_name':'atlas.terrain','padding':8,'num_mip_levels':4,'texture_data':texture_data})
    save(bp/'blocks/surface.json',{'format_version':'1.21.90','minecraft:block':{'description':{'identifier':'lintsi:surface','states':{'lintsi:mask_lo':list(range(16)),'lintsi:mask_hi':list(range(16)),'lintsi:color_lo':list(range(16)),'lintsi:color_hi':list(range(8))}},'components':{'minecraft:display_name':'Linnanmäki measured surface','minecraft:geometry':'minecraft:geometry.full_block','minecraft:material_instances':{'*':{'texture':'lintsi_color_0','render_method':'opaque','ambient_occlusion':False,'face_dimming':False}},'minecraft:destructible_by_mining':{'seconds_to_destroy':1},'minecraft:light_dampening':0},'permutations':permutations}})
