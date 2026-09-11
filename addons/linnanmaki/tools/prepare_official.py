from pathlib import Path
import zipfile,json,hashlib
p=Path('/tmp/helsinki-official')
with zipfile.ZipFile(p/'official.zip') as z:
    entries=z.infolist()
    print('ZIP entries',len(entries),'expanded bytes',sum(i.file_size for i in entries),flush=True)
    print('World files',[i.filename for i in entries if i.filename.endswith(('level.dat','levelname.txt','.mcworld'))],flush=True)
    for i in entries:
        assert (p/'extracted'/i.filename).resolve().is_relative_to((p/'extracted').resolve())
        assert (i.external_attr>>16)&0o170000 != 0o120000
    assert z.testzip() is None
    z.extractall(p/'extracted')
for f in (p/'extracted').rglob('levelname.txt'):
    print(str(f),f.read_text(errors='replace'),flush=True)
h=hashlib.sha256()
with (p/'official.zip').open('rb') as f:
    for b in iter(lambda:f.read(1048576),b''):h.update(b)
(p/'source.json').write_text(json.dumps({'url':'https://3d.hel.ninja/data/minecraft_Helsinki/Helsinki3D_MC_bedrock.zip','sha256':h.hexdigest(),'bytes':(p/'official.zip').stat().st_size,'tls_verified':False,'zip_crc_valid':True},indent=2))
print((p/'source.json').read_text(),flush=True)
