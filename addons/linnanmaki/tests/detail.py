import sys
from pathlib import Path
import unittest
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from detail_materials import shape,lab,nearest
from build_detail import bilinear


class DetailTests(unittest.TestCase):
    def test_half_cells_preserve_all_occupancy_masks(self):
        for mask in range(1,256):
            cubes,collision=shape(mask)
            reconstructed=0
            for c in cubes:
                x=(c['origin'][0]+8)//8;y=c['origin'][1]//8;z=(c['origin'][2]+8)//8
                reconstructed |= 1<<(4*x+2*y+z)
                self.assertEqual(c['size'],[8,8,8])
            self.assertEqual(mask,reconstructed)
            self.assertTrue(all(0<n<=16 for n in collision['size']))

    def test_adjacent_cells_remove_hidden_faces(self):
        cubes,_=shape(3)
        self.assertNotIn('south',cubes[0]['uv'])
        self.assertNotIn('north',cubes[1]['uv'])
        cubes,_=shape(255)
        self.assertEqual(sum(len(c['uv']) for c in cubes),24)

    def test_bilinear_uses_pixel_centres_and_obj_v_direction(self):
        tex=np.array([[[255,0,0],[0,255,0]],[[0,0,255],[255,255,255]]],dtype=float)
        result=bilinear(tex,np.array([[.25,.75],[.75,.25],[.5,.5]]))
        np.testing.assert_allclose(result,[[255,0,0],[255,255,255],[127.5,127.5,127.5]])

    def test_lab_reference_and_identity(self):
        np.testing.assert_allclose(lab([[0,0,0],[255,255,255]])[:,0],[0,100],atol=.001)
        palette=np.array([[23,54,96],[122,65,36],[21,89,53]])
        np.testing.assert_array_equal(nearest(palette,palette),[0,1,2])


if __name__=='__main__':unittest.main()
