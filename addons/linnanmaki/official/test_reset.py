import hashlib,pathlib,tempfile,unittest,zipfile
from unittest.mock import patch
import reset_world
from reset_world import extract,PACK
from watch_reset import accepted
class Tests(unittest.TestCase):
    def test_restore_and_pack(self):
        import json
        with tempfile.TemporaryDirectory() as tmp:
            p=pathlib.Path(tmp);z=p/'sample.zip'
            with zipfile.ZipFile(z,'w') as f:
                f.writestr('Helsinki_3D/level.dat',b'fake-level-data')
                f.writestr('Helsinki_3D/db/CURRENT','MANIFEST-000001')
            h=hashlib.sha256(z.read_bytes()).hexdigest()
            w=extract(z,p/'out',h)
            self.assertEqual(json.loads((w/'world_behavior_packs.json').read_text()),PACK)
            self.assertEqual((w/'db/CURRENT').read_text(),'MANIFEST-000001')
            with self.assertRaises(ValueError):extract(z,p/'bad','wrong')
    def test_path_escape(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=pathlib.Path(tmp);z=p/'bad.zip'
            with zipfile.ZipFile(z,'w') as f:f.writestr('../outside','bad')
            with self.assertRaises(ValueError):extract(z,p/'out',hashlib.sha256(z.read_bytes()).hexdigest())
            self.assertFalse((p/'outside').exists())
    def test_log_auth_boundary(self):
        good='[2026-09-12 06:40:10:123 WARN] [Scripting] HELSINKI_RESET_REQUEST_V1'
        self.assertTrue(accepted(good))
        self.assertTrue(accepted(list((good+'\n\r').encode())))
        for bad in [None,{},['fake'],[999]]:self.assertFalse(accepted(bad))
        for bad in ['<player> '+good,good+' extra',good.replace('WARN','INFO'),'HELSINKI_RESET_REQUEST_V1']:
            self.assertFalse(accepted(bad))
    def transaction(self,healthy,game=False):
        from types import SimpleNamespace
        with tempfile.TemporaryDirectory() as tmp:
            root=pathlib.Path(tmp);old=root/'worlds/helsinki-official';old.mkdir(parents=True)
            (old/'player-change').write_text('keep on failure')
            (root/'server.properties').write_text('level-name=helsinki-official\n')
            if game:
                import json
                (root/'official-admin').mkdir()
                config={'behavior':PACK+[{'pack_id':'game','version':[1,0,0]}],'resource':[{'pack_id':'visual','version':[1,0,0]}]}
                (root/'official-admin/game-packs.json').write_text(json.dumps(config))
            def fake_extract(archive,stage):
                fresh=stage/'Helsinki_3D';fresh.mkdir();(fresh/'official').write_text('pristine');return fresh
            def run(args,**kwargs):
                return SimpleNamespace(returncode=1 if 'is-active' in args else 0,stdout='HELSINKI_SPAWN_READY {}\nDEADCITY_READY points=7' if healthy else '')
            with patch.object(reset_world,'ROOT',root),patch.object(reset_world,'extract',fake_extract),patch.object(reset_world.subprocess,'run',side_effect=run),patch.object(reset_world.time,'sleep'):
                if healthy:reset_world.main()
                else:
                    with self.assertRaises(RuntimeError):reset_world.main()
            self.assertEqual((old/'official').exists(),healthy)
            self.assertEqual((old/'player-change').exists(),not healthy)
            self.assertFalse(list((root/'worlds').glob('.official-reset-*')))
            if healthy and game:
                for kind in ('behavior','resource'):self.assertEqual(json.loads((old/f'world_{kind}_packs.json').read_text()),config[kind])
    def test_successful_switch(self):self.transaction(True)
    def test_startup_failure_rolls_back(self):self.transaction(False)
    def test_game_packs_survive_reset(self):self.transaction(True,True)
if __name__=='__main__':unittest.main()
