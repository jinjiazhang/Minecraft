"""Offline geometry comparison, not a Minecraft screenshot."""
import numpy as np
from PIL import Image,ImageDraw
from build_sample import ROOT,PALETTE
from detail_materials import nearest


def render(cells,size,bounds):
    image=Image.new('RGB',(800,700),'#18212c');draw=ImageDraw.Draw(image)
    lo,hi=bounds
    scale=min(760/(hi[0]-lo[0]),660/(hi[1]-lo[1]))
    mid=(lo+hi)/2
    def project(x,y,z):return (400+(x-z-mid[0])*scale,350+((x+z)*.5-y-mid[1])*scale)
    for x,y,z,r,g,b in sorted(cells,key=lambda a:a[0]+a[1]+a[2]):
        color=(r,g,b)
        faces=[([(x,y+size,z),(x+size,y+size,z),(x+size,y+size,z+size),(x,y+size,z+size)],1),
               ([(x,y,z+size),(x+size,y,z+size),(x+size,y+size,z+size),(x,y+size,z+size)],.86),
               ([(x+size,y,z),(x+size,y,z+size),(x+size,y+size,z+size),(x+size,y+size,z)],.94)]
        for points,factor in faces:draw.polygon([project(*p) for p in points],fill=tuple(int(v*factor) for v in color))
    return image


def main():
    a=np.load(ROOT/'output/detail/render.npz')
    p=a['positions'];mask=a['masks'];colors=a['palette'][a['ids']]
    # Same high-detail source crop for both discretizations, isolating grid size.
    take=(p[:,0]>=125)&(p[:,0]<165)&(p[:,2]>=110)&(p[:,2]<150)
    p=p[take];mask=mask[take];colors=colors[take]
    base=float(p[:,1].min());old=np.array([c for _,c in PALETTE]);oldcolors=old[nearest(a['colors'][take],old)]
    coarse=[];fine=[]
    for (x,y,z),m,c,oc in zip(p,mask,colors,oldcolors):
        x=float(x)-145;y=float(y)-base;z=float(z)-130
        coarse.append((x,y,z,*map(int,oc)))
        for dx in range(2):
            for dy in range(2):
                for dz in range(2):
                    if int(m)&(1<<(4*dx+2*dy+dz)):
                        fine.append((x+dx*.5,y+dy*.5,z+dz*.5,*map(int,c)))
    result=Image.new('RGB',(1600,770),'#18212c')
    corners=np.array([(x+dx-z-dz,(x+dx+z+dz)*.5-y-dy) for x,y,z,*_ in coarse for dx in [0,1] for dy in [0,1] for dz in [0,1]])
    bounds=(corners.min(0),corners.max(0))
    result.paste(render(coarse,1,bounds),(0,70));result.paste(render(fine,.5,bounds),(800,70))
    d=ImageDraw.Draw(result)
    d.text((24,18),'1 metre cubes / 16 colours',fill='white');d.text((824,18),'0.5 metre shapes / 128 colours / same 1:1 scale',fill='white')
    d.text((24,43),'Offline geometry comparison from the same L18 crop; not a Minecraft screenshot.',fill='#c3cbd5')
    result.save(ROOT/'output/detail/geometry-comparison.png')


if __name__=='__main__':main()
