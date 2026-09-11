"""Restore the official archive, retain management pack, never generate a blank world."""
import fcntl,hashlib,json,os,pathlib,shutil,subprocess,tempfile,time,zipfile
ROOT=pathlib.Path('/opt/bedrock')
SHA='c96f2b73343101c50cc6915ffda28c5d7bce8bb72c610543d0deaf79be657f8c'
PACK=[{'pack_id':'a4a49c55-b5ef-4d71-a98c-ccbb73b55dc6','version':[1,0,0]}]

def extract(archive,destination,expected=SHA):
    h=hashlib.sha256()
    with archive.open('rb') as f:
        for b in iter(lambda:f.read(1048576),b''):h.update(b)
    if h.hexdigest()!=expected:raise ValueError('Official archive checksum mismatch')
    with zipfile.ZipFile(archive) as z:
        for i in z.infolist():
            if not (destination/i.filename).resolve().is_relative_to(destination.resolve()):raise ValueError('Unsafe ZIP path')
            if (i.external_attr>>16)&0o170000==0o120000:raise ValueError('ZIP symlink rejected')
        if z.testzip() is not None:raise ValueError('Corrupt ZIP')
        z.extractall(destination)
    w=destination/'Helsinki_3D'
    if not (w/'db/CURRENT').is_file() or (w/'level.dat').stat().st_size<9:raise ValueError('Invalid Bedrock world')
    (w/'world_behavior_packs.json').write_text(json.dumps(PACK))
    (w/'world_resource_packs.json').write_text('[]')
    return w

def main():
    with (ROOT/'official-reset.lock').open('w') as lock:
        try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:return
        props=dict(l.split('=',1) for l in (ROOT/'server.properties').read_text().splitlines() if '=' in l and not l.startswith('#'))
        if props.get('level-name')!='helsinki-official':raise RuntimeError('Wrong active world')
        target=ROOT/'worlds/helsinki-official'
        if target.is_symlink() or target.resolve()!=target:raise RuntimeError('Unexpected world path')
        stage=pathlib.Path(tempfile.mkdtemp(prefix='.official-reset-',dir=ROOT/'worlds'))
        try:
            fresh=extract(ROOT/'official-source/Helsinki3D_MC_bedrock.zip',stage)
            subprocess.run(['chown','-R','minecraft:minecraft',str(fresh)],check=True)
            subprocess.run([str(ROOT/'cmd.sh'),'stop'],check=True,timeout=10)
            for _ in range(40):
                if subprocess.run(['systemctl','is-active','--quiet','bedrock']).returncode!=0:break
                time.sleep(1)
            else:raise RuntimeError('Graceful stop timed out; world untouched')
            old=stage/'previous'
            target.rename(old)
            try:
                fresh.rename(target)
                since=str(int(time.time()))
                subprocess.run(['systemctl','start','bedrock'],check=True)
                for _ in range(45):
                    logs=subprocess.run(['journalctl','-u','bedrock','--since','@'+since,'-o','cat','--no-pager'],capture_output=True,text=True,check=True).stdout
                    if 'HELSINKI_SPAWN_READY ' in logs:break
                    time.sleep(1)
                else:raise RuntimeError('Restored world did not reach spawn readiness')
            except Exception:
                # Retain the previous world if service startup itself fails.
                subprocess.run(['systemctl','stop','bedrock'],check=False)
                if target.exists():target.rename(stage/'failed')
                old.rename(target)
                subprocess.run(['systemctl','start','bedrock'],check=True)
                raise
            print('OFFICIAL_RESET_COMPLETE',flush=True)
        finally:
            # Verified private staging directory; no persistent backup is made.
            shutil.rmtree(stage)

if __name__=='__main__':main()
