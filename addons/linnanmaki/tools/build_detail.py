"""L18 surfaces -> half-metre custom shapes; original 1:1 park distances retained."""
import hashlib
import json
from pathlib import Path
import struct
import zipfile
import numpy as np
from PIL import Image, ImageDraw
from build_sample import ROOT, PALETTE, load_obj, tag, string, integer, compound, intlist
from detail_materials import adaptive_palette, nearest, lab, write_packs, RP_UUID

OUT=ROOT/'output/detail'


def bilinear(tex,uv):
    x=np.clip(uv[:,0]*tex.shape[1]-.5,0,tex.shape[1]-1)
    y=np.clip((1-uv[:,1])*tex.shape[0]-.5,0,tex.shape[0]-1)
    x0=x.astype(int); y0=y.astype(int)
    x1=np.minimum(x0+1,tex.shape[1]-1); y1=np.minimum(y0+1,tex.shape[0]-1)
    a=(x-x0)[:,None]; b=(y-y0)[:,None]
    return (tex[y0,x0]*(1-a)+tex[y0,x1]*a)*(1-b)+(tex[y1,x0]*(1-a)+tex[y1,x1]*a)*b


def samples(paths):
    signature=hashlib.sha256(b'half-v2-step.24-average-bilinear')
    for p in paths:
        signature.update(p.read_bytes()); signature.update(p.with_name(p.stem+'_0.jpg').read_bytes())
    signature=signature.hexdigest()
    cache=OUT/'samples.npz'
    if cache.exists():
        a=np.load(cache)
        if str(a['signature'])==signature:
            return a['positions'],a['masks'],a['colors'],signature
    buckets={}
    for index,path in enumerate(paths):
        vertices,uv,faces=load_obj(path)
        tex=np.array(Image.open(path.with_name(path.stem+'_0.jpg')).convert('RGB'),dtype=float)
        points=[]; values=[]
        for vi,ti,textured in faces:
            v=vertices[vi]
            steps=max(1,int(np.ceil(max(np.linalg.norm(v[1]-v[0]),np.linalg.norm(v[2]-v[0]),np.linalg.norm(v[2]-v[1]))/.24)))
            a,b=np.triu_indices(steps+1)
            w=np.column_stack((1-b/steps,(b-a)/steps,a/steps))
            p=w@v
            cells=np.floor(np.column_stack((p[:,0]-6500,p[:,2]+64,7250-p[:,1]))*2).astype(np.int32)
            valid=(cells[:,0]>=0)&(cells[:,0]<1000)&(cells[:,2]>=0)&(cells[:,2]<1000)&(cells[:,1]>=0)&(cells[:,1]<640)
            if not valid.any(): continue
            points.append(cells[valid])
            values.append(bilinear(tex,(w@uv[ti])[valid]) if textured and min(ti)>=0 else np.full((int(valid.sum()),3),128.))
        cells=np.concatenate(points); colors=np.concatenate(values)
        # Average every contributing face before assigning a material, avoiding last-face wins.
        unique,inverse,count=np.unique(cells,axis=0,return_inverse=True,return_counts=True)
        means=np.column_stack([np.bincount(inverse,weights=colors[:,c])/count for c in range(3)])
        for (x,y,z),color in zip(unique,means):
            key=(int(x//2),int(y//2),int(z//2)); bit=1<<int((x%2)*4+(y%2)*2+z%2)
            if key in buckets:
                item=buckets[key];item[0]|=bit;item[1]+=color;item[2]+=1
            else: buckets[key]=[bit,color.copy(),1]
        print(f'Sampled {index+1}/64: {path.name}',flush=True)
    positions=np.array(list(buckets),dtype=np.int32)
    masks=np.array([v[0] for v in buckets.values()],dtype=np.uint8)
    colors=np.array([v[1]/v[2] for v in buckets.values()],dtype=np.uint8)
    np.savez_compressed(cache,positions=positions,masks=masks,colors=colors,signature=signature)
    return positions,masks,colors,signature


def detail_structure(size,indices,palette):
    entries=[]
    for mask,color in palette:
        states=compound('states',integer('lintsi:mask_lo',int(mask)%16)+integer('lintsi:mask_hi',int(mask)//16)+integer('lintsi:color_lo',int(color)%16)+integer('lintsi:color_hi',int(color)//16))
        entries.append(tag(8,'name',string('lintsi:surface'))+states+integer('version',18168865)+b'\0')
    pal=compound('palette',compound('default',tag(9,'block_palette',b'\x0a'+struct.pack('<i',len(entries))+b''.join(entries))+compound('block_position_data',b'')))
    layers=tag(9,'block_indices',b'\x09'+struct.pack('<i',2)+intlist(indices)+intlist(np.full(indices.size,-1)))
    return compound('',integer('format_version',1)+tag(9,'size',intlist(size))+compound('structure',layers+tag(9,'entities',b'\x0a'+struct.pack('<i',0))+pal)+tag(9,'structure_world_origin',intlist([0,0,0])))


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    paths=sorted((ROOT/'assets/mesh').rglob('*_L18_*.obj'))
    if len(paths)!=64: raise RuntimeError(f'Expected 64 L18 OBJ tiles, found {len(paths)}')
    pos,masks,colors,signature=samples(paths)
    palette=adaptive_palette(colors); ids=nearest(colors,palette)
    bp=OUT/'pack';rp=OUT/'resource_pack'
    (bp/'structures/lintsi').mkdir(parents=True,exist_ok=True)
    write_packs(bp,rp,palette)
    group=pos[:,0]//32*16+pos[:,2]//32
    tiles=[]
    for g in range(256):
        take=group==g; p=pos[take]; pairs=np.column_stack((masks[take],ids[take]))
        unique,inverse=np.unique(pairs,axis=0,return_inverse=True)
        cx,cz=divmod(g,16); low=int(p[:,1].min());high=int(p[:,1].max())
        sx=min(32,500-cx*32);sz=min(32,500-cz*32)
        blocks=np.full((sx,high-low+1,sz),-1,dtype='<i4')
        blocks[p[:,0]-cx*32,p[:,1]-low,p[:,2]-cz*32]=inverse
        name=f'detail_{cx}_{cz}'
        (bp/f'structures/lintsi/{name}.mcstructure').write_bytes(detail_structure(blocks.shape,blocks,unique))
        tiles.append({'id':'lintsi:'+name,'x':22000+cx*32,'y':low,'z':22000+cz*32,'sx':sx,'sz':sz})
    for path in (ROOT/'pack').rglob('*'):
        if path.is_file():
            target=bp/path.relative_to(ROOT/'pack');target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(path.read_bytes())
    settings={'key':'lintsi:detail_v2_tile','arrival':{'x':22200.5,'y':191,'z':22200.5}}
    (bp/'scripts/tiles.js').write_text('export const tiles = '+json.dumps(tiles)+';\nexport const settings = '+json.dumps(settings)+';\n')
    manifest=json.loads((bp/'manifest.json').read_text(encoding='utf-8'))
    manifest['header'].update(name='Linnanmäki · 半米细节版',description='L18 / 0.5m shapes / 128 measured colours / 1:1 scale',version=[0,2,0])
    for m in manifest['modules']:m['version']=[0,2,0]
    manifest['dependencies'].append({'uuid':RP_UUID,'version':[0,2,0]})
    (bp/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    attribution=(bp/'ATTRIBUTION.txt').read_text().replace('selected L16 mesh tiles','selected L18 mesh tiles').replace('onto 1 metre Minecraft blocks','onto 0.5 metre subcells inside 1 metre Minecraft blocks')
    (bp/'ATTRIBUTION.txt').write_text(attribution)
    (rp/'ATTRIBUTION.txt').write_text(attribution)
    old=np.array([c for _,c in PALETTE]);old_ids=nearest(colors,old)
    old_error=float(np.linalg.norm(lab(colors)-lab(old[old_ids]),axis=1).mean())
    error=float(np.linalg.norm(lab(colors)-lab(palette[ids]),axis=1).mean())
    report={'source_year':2017,'source_lod':'L18','source_mesh_count':64,'source_signature':signature,'metres_per_world_block':1,'geometry_cell_metres':.5,'color_count':128,'world_blocks':len(pos),'partial_blocks':int((masks!=255).sum()),'shape_states':256,'total_state_combinations':32768,'structure_tiles':256,'mean_CIE76_error_16_colors':old_error,'mean_CIE76_error_128_colors':error,'error_reduction':1-error/old_error,'comparison_note':'Both palettes matched in Lab to the same averaged source colours; not a comparison to unshadowed real-world paint.','minecraft_bounds_xz':[22000,22500,22000,22500],'collision_note':'Each partial block uses the bounding box of occupied subcells, not eight separate collision boxes.','client_visual_validation':False,'rides_playable':False}
    (OUT/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    np.savez_compressed(OUT/'render.npz',positions=pos,masks=masks,colors=colors,palette=palette,ids=ids)
    image=Image.new('RGB',(1500,560),'#17202b');draw=ImageDraw.Draw(image)
    for i,(name,c) in enumerate([('Source colours (averaged)',colors),('Old 16 colours (Lab match)',old[old_ids]),('New 128 colours',palette[ids])]):
        top=np.full((500,500),-999);rgb=np.zeros((500,500,3),dtype=np.uint8)
        for (x,y,z),color in zip(pos,c):
            if y>top[z,x]:top[z,x]=y;rgb[z,x]=color
        image.paste(Image.fromarray(rgb),(i*500,60));draw.text((i*500+12,18),name,fill='white')
    image.save(OUT/'color-comparison.png')
    with zipfile.ZipFile(OUT/'Linnanmaki-Detail.mcaddon','w',zipfile.ZIP_DEFLATED) as z:
        for folder in [bp,rp]:
            for p in folder.rglob('*'):
                if p.is_file():z.write(p,p.relative_to(OUT).as_posix())
    print(json.dumps(report,indent=2),flush=True)


if __name__=='__main__':main()
