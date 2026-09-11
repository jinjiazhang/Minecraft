"""Find four-neighbour routes on measured Bedrock top surfaces (max 1-block step)."""
import json,heapq
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
heights={}
for line in (ROOT/'output/survey.log').read_text(encoding='utf-8').splitlines():
    if 'DEADCITY_HEIGHT ' in line:
        x,z,row=json.loads(line.split('DEADCITY_HEIGHT ',1)[1])
        for i,h in enumerate(row):
            if h>-100:heights[(x,z+i)]=h
if len(heights)!=451*401:raise RuntimeError(f'Incomplete survey: {len(heights)}/{451*401}')
start=(-6940,-6585)
targets={'c1':(-6890,-6492),'c2':(-6800,-6500),'c3':(-6720,-6580),'c4':(-6800,-6680),'c5':(-7030,-6650),'e1':(-6740,-6447),'e2':(-6740,-6740)}
def route(goal):
    q=[(0,start)];cost={start:0};parent={}
    while q:
        _,p=heapq.heappop(q)
        if p==goal:
            out=[p]
            while p!=start:p=parent[p];out.append(p)
            return out[::-1]
        for dx,dz in [(0,1),(0,-1),(1,0),(-1,0)]:
            n=(p[0]+dx,p[1]+dz)
            if n not in heights or abs(heights[n]-heights[p])>1:continue
            value=cost[p]+1+abs(heights[n]-heights[p])*.8
            if value<cost.get(n,float('inf')):
                cost[n]=value;parent[n]=p
                heapq.heappush(q,(value+abs(n[0]-goal[0])+abs(n[1]-goal[1]),n))
    return None
routes={}
for id,goal in targets.items():
    path=route(goal)
    if path is None:raise RuntimeError(f'Unreachable target {id} at {goal}')
    routes[id]=[[x,heights[x,z]+1,z] for x,z in path]
    print(id,'length',len(path),'ground',heights[goal])
(ROOT/'pack/scripts/routes.js').write_text('export const ROUTES='+json.dumps(routes,separators=(',',':'))+';\n',encoding='utf-8')
(ROOT/'output/route-report.json').write_text(json.dumps({'survey_points':len(heights),'routes':{k:len(v) for k,v in routes.items()},'maximum_ground_step':1},indent=2))
