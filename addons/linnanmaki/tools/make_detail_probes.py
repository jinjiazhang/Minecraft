"""Generate console checks from actual exported colour/shape states."""
import json
import numpy as np
from build_sample import ROOT

out=ROOT/'output/detail';a=np.load(out/'render.npz')
positions=a['positions'];masks=a['masks'];colors=a['ids']
commands=['#!/usr/bin/env bash','set -euo pipefail','cmd=/opt/bedrock/cmd.sh']
probes=[]
for i,(cx,cz) in enumerate([(10,10),(240,240),(490,490)]):
    take=np.where((positions[:,0]==cx)&(positions[:,2]==cz))[0]
    pick=take[np.argmax(positions[take,1])]
    x,y,z=map(int,positions[pick]);x+=22000;z+=22000
    mask=int(masks[pick]);color=int(colors[pick])
    states={'lintsi:mask_lo':mask%16,'lintsi:mask_hi':mask//16,'lintsi:color_lo':color%16,'lintsi:color_hi':color//16}
    probes.append({'x':x,'y':y,'z':z,'states':states})
    commands.append(f'"$cmd" tickingarea add circle {x} {y} {z} 1 lintsi_probe_{i} true')
commands.append('"$cmd" tickingarea add circle 20013 89 20016 1 lintsi_probe_old true')
commands.append('sleep 3')
for p in probes:
    state='['+','.join(json.dumps(k)+'='+str(v) for k,v in p['states'].items())+']'
    commands.append(f'"$cmd" testforblock {p["x"]} {p["y"]} {p["z"]} lintsi:surface \'{state}\'')
commands += ['"$cmd" testforblock 22200 190 22200 glass','"$cmd" testforblock 20013 89 20016 black_concrete','"$cmd" scriptevent lintsi:status check','sleep 2']
for i in range(3):commands.append(f'"$cmd" tickingarea remove lintsi_probe_{i}')
commands.append('"$cmd" tickingarea remove lintsi_probe_old')
commands += ['sleep 1',"journalctl -u bedrock --since '20 seconds ago' --no-pager"]
(out/'verify-detail.sh').write_text('\n'.join(commands)+'\n',encoding='utf-8',newline='\n')
(out/'probes.json').write_text(json.dumps(probes,indent=2))
print(json.dumps(probes))
