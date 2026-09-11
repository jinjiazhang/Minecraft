"""Convert four measured Helsinki mesh tiles to a 1 metre Bedrock surface sample.

This preserves scanned surfaces; it does not invent interiors, ride tracks or
solid terrain underneath roofs. L16 is a simplified source mesh, not a claim
of 20 cm output accuracy. Minecraft placement uses X=east, Z=south.
"""
import hashlib
import json
from pathlib import Path
import struct
import zipfile
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PALETTE = [
    ('black_concrete', (9,11,16)), ('gray_concrete',(55,58,62)),
    ('light_gray_concrete',(125,125,115)), ('white_concrete',(207,213,214)),
    ('brown_concrete',(96,59,31)), ('red_concrete',(142,32,32)),
    ('orange_concrete',(224,97,1)), ('yellow_concrete',(241,175,21)),
    ('green_concrete',(73,91,36)), ('lime_concrete',(94,168,24)),
    ('cyan_concrete',(21,119,136)), ('blue_concrete',(44,46,143)),
    ('light_blue_concrete',(36,137,199)), ('pink_concrete',(214,101,143)),
    ('terracotta',(152,94,67)), ('sandstone',(216,203,155))]


def string(s):
    b = s.encode('utf-8')
    return struct.pack('<H',len(b))+b


def tag(kind, name, payload):
    return bytes([kind])+string(name)+payload


def integer(name, n):
    return tag(3,name,struct.pack('<i',n))


def compound(name, payload):
    return tag(10,name,payload+b'\0')


def intlist(values):
    a = np.asarray(values,dtype='<i4').reshape(-1)
    return b'\x03'+struct.pack('<i',len(a))+a.tobytes()


def structure(size, indices):
    palette = b''.join(tag(8,'name',string('minecraft:'+name))+compound('states',b'')+integer('version',18168865)+b'\0' for name,_ in PALETTE)
    pal = compound('palette',compound('default',tag(9,'block_palette',b'\x0a'+struct.pack('<i',len(PALETTE))+palette)+compound('block_position_data',b'')))
    layers = tag(9,'block_indices',b'\x09'+struct.pack('<i',2)+intlist(indices)+intlist(np.full(indices.size,-1)))
    body = integer('format_version',1)+tag(9,'size',intlist(size))
    body += compound('structure',layers+tag(9,'entities',b'\x0a'+struct.pack('<i',0))+pal)
    body += tag(9,'structure_world_origin',intlist([0,0,0]))
    return compound('',body)


def load_obj(path):
    vertices, uvs, faces = [],[],[]
    textured = True
    for line in path.read_text().splitlines():
        s=line.split()
        if not s: continue
        if s[0]=='v': vertices.append(list(map(float,s[1:4])))
        elif s[0]=='vt': uvs.append(list(map(float,s[1:3])))
        elif s[0]=='usemtl': textured = not s[1].endswith('_untextured')
        elif s[0]=='f':
            pairs=[t.split('/') for t in s[1:]]
            for j in range(1,len(pairs)-1):
                tri=[pairs[0],pairs[j],pairs[j+1]]
                faces.append(([int(t[0])-1 for t in tri],[int(t[1])-1 if len(t)>1 and t[1] else -1 for t in tri],textured))
    return np.array(vertices),np.array(uvs),faces


def main():
    out=ROOT/'output'
    pack=out/'pack'
    (pack/'structures/lintsi').mkdir(parents=True,exist_ok=True)
    voxels={}
    top=np.full((500,500),-999.,dtype=float)
    photo=np.zeros((500,500,3),dtype=np.uint8)
    source=[]
    paths=sorted((ROOT/'assets/mesh').rglob('*_L16_000.obj'))
    if len(paths)!=4: raise RuntimeError('Expected four source tiles; fetch them first')
    for path in paths:
        vertices,uv,faces=load_obj(path)
        tex=np.array(Image.open(path.with_name(path.stem+'_0.jpg')).convert('RGB'))
        print(f'Voxelizing {path.name}: {len(faces)} triangles',flush=True)
        source.append({'file':str(path.relative_to(ROOT)), 'sha256':hashlib.sha256(path.read_bytes()).hexdigest(), 'vertices':len(vertices),'faces':len(faces),'min':vertices.min(0).tolist(),'max':vertices.max(0).tolist()})
        for vi,ti,textured in faces:
            v=vertices[vi]
            steps=max(1,int(np.ceil(max(np.linalg.norm(v[1]-v[0]),np.linalg.norm(v[2]-v[0]),np.linalg.norm(v[2]-v[1]))/.4)))
            # A dense barycentric surface sample keeps roof/bridge undersides open.
            a,b=np.triu_indices(steps+1)
            w=np.column_stack((1-b/steps,(b-a)/steps,a/steps))
            p=w@v
            coords=np.floor(np.column_stack((p[:,0]-6500,p[:,2]+64,7250-p[:,1]))).astype(int)
            valid=(coords[:,0]>=0)&(coords[:,0]<500)&(coords[:,2]>=0)&(coords[:,2]<500)&(coords[:,1]>=-64)&(coords[:,1]<320)
            coords=coords[valid]
            if not len(coords): continue
            if textured and min(ti)>=0:
                tuv=(w@uv[ti])[valid]
                tx=np.clip((tuv[:,0]*tex.shape[1]).astype(int),0,tex.shape[1]-1)
                ty=np.clip(((1-tuv[:,1])*tex.shape[0]).astype(int),0,tex.shape[0]-1)
                colors=tex[ty,tx]
            else: colors=np.full((len(coords),3),128,dtype=np.uint8)
            colors_f=colors.astype(float)
            dist=((colors_f[:,None,:]-np.array([c for _,c in PALETTE])[None,:,:])**2).sum(2)
            ids=dist.argmin(1)
            for (x,y,z),color,pid in zip(coords,colors,ids):
                voxels[(int(x),int(y),int(z))]=int(pid)
                if y>top[z,x]: top[z,x]=y; photo[z,x]=color
    buckets={}
    for pos,pid in voxels.items(): buckets.setdefault((pos[0]//32,pos[2]//32),[]).append((pos,pid))
    tiles=[]
    for (cx,cz),items in sorted(buckets.items()):
        low=min(p[1] for p,_ in items); high=max(p[1] for p,_ in items)
        sx=min(32,500-cx*32); sz=min(32,500-cz*32)
        blocks=np.full((sx,high-low+1,sz),-1,dtype='<i4')
        for (x,y,z),pid in items: blocks[x-cx*32,y-low,z-cz*32]=pid
        name=f'tile_{cx}_{cz}'
        (pack/f'structures/lintsi/{name}.mcstructure').write_bytes(structure(list(blocks.shape),blocks))
        tiles.append({'id':'lintsi:'+name,'x':20000+cx*32,'y':low,'z':20000+cz*32,'sx':sx,'sz':sz})
    (pack/'scripts').mkdir(exist_ok=True)
    (pack/'scripts/tiles.js').write_text('export const tiles = '+json.dumps(tiles)+';\nexport const settings = '+json.dumps({'key':'lintsi:sample_tile','arrival':{'x':20200.5,'y':191,'z':20200.5}})+';\n')
    for p in (ROOT/'pack').rglob('*'):
        if p.is_file():
            dest=pack/p.relative_to(ROOT/'pack'); dest.parent.mkdir(parents=True,exist_ok=True); dest.write_bytes(p.read_bytes())
    report={'status':'measured exterior surface sample, not completed park','source_year':2017,'source_lod':'L16','source_origin':[25490000,6668000,0],'source_srs_literal':'EPSG:3879+5773','vertical_datum_warning':'metadata uses 5773; city overview says N2000. Preserve source heights; absolute vertical datum not reconciled.','crop_easting':[25496500,25497000],'crop_northing':[6674750,6675250],'minecraft_bounds_xz':[20000,20500,20000,20500],'transform':'X=E-25496500+20000; Y=H+64; Z=6675250-N+20000; floor each','metres_per_block':1,'surface_voxels':len(voxels),'structure_tiles':len(tiles),'top_view_coverage':float((top>-999).mean()),'sources':source,'rides_playable':False}
    (out/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    preview=Image.new('RGB',(1000,1080),'#17202b')
    preview.paste(Image.fromarray(photo).resize((1000,1000)),(0,80))
    draw=ImageDraw.Draw(preview)
    draw.text((20,15),'LINNANMAKI | measured exterior sample | 500 x 500 m | NORTH UP',fill='white')
    draw.text((20,40),'City of Helsinki / CC BY 4.0 | 2017 mesh, L16 | NOT a completed playable park',fill='white')
    preview.save(out/'preview.png')
    with zipfile.ZipFile(out/'Linnanmaki-Survey-Sample.mcpack','w',zipfile.ZIP_DEFLATED) as z:
        for p in pack.rglob('*'):
            if p.is_file(): z.write(p,p.relative_to(pack).as_posix())
    print(json.dumps({k:v for k,v in report.items() if k!='sources'},indent=2))


if __name__=='__main__': main()
