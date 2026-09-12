// Native sound IDs verified against Mojang bedrock-samples sound_definitions.json.
export const MINING_EFFECTS={
 dirt:{hit:'hit.gravel',break:'dig.gravel',pitch:1},
 stone:{hit:'hit.stone',break:'dig.stone',pitch:1},
 rock:{hit:'hit.deepslate',break:'dig.deepslate',pitch:.8},
 wood:{hit:'hit.wood',break:'dig.wood',pitch:1},
 iron:{hit:'hit.iron',break:'dig.chain',pitch:1},
 gold:{hit:'hit.anvil',break:'dig.nether_gold_ore',pitch:1.4},
 gem:{hit:'hit.amethyst_block',break:'break.amethyst_block',pitch:1.2},
 water:{hit:'liquid.water',break:'bucket.fill_water',pitch:1},
 lava:{hit:'liquid.lava',break:'bucket.fill_lava',pitch:.8},
 rainbow:{hit:'hit.amethyst_cluster',break:'break.amethyst_cluster',pitch:1.6}
};

export function swing(p){
 // A short, finite gesture: releasing the use button cannot leave a looping pose.
 p.playAnimation('animation.rush.pick_swing',{blendOutTime:.02,controller:'rush_mining',stopExpression:'query.anim_time >= 0.28'});
}

export function miningEffect(p,kind,q,broken,audible){
 const effect=MINING_EFFECTS[kind],phase=broken?'break':'hit';
 if(audible)p.playSound(effect[phase],{location:q,volume:broken?.55:.3,pitch:effect.pitch});
 // Move debris onto the visible face so intact blocks do not hide hit feedback.
 const point={x:q.x+.5,y:q.y+.5,z:q.z+.5},eye=p.getHeadLocation(),v={x:eye.x-point.x,y:eye.y-point.y,z:eye.z-point.z};
 const axis=['x','y','z'].sort((a,b)=>Math.abs(v[b])-Math.abs(v[a]))[0];point[axis]+=Math.sign(v[axis])*.53;
 p.dimension.spawnParticle('rush:'+kind+'_'+phase,point);
}
