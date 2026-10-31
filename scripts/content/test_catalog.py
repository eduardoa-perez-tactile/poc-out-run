"""Full immutable catalog checks; no route/render/race acceptance implied."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

P=Path(__file__).parent
spec=importlib.util.spec_from_file_location('catalog_compiler',P/'convert-map.py')
compiler=importlib.util.module_from_spec(spec);spec.loader.exec_module(compiler)
spec=importlib.util.spec_from_file_location('catalog_numeric',P/'check-numeric-oracle.py')
numeric=importlib.util.module_from_spec(spec);spec.loader.exec_module(numeric)
# Plain-source independent inventory (hold factors/leave bug/end-exclusive groups).
# authored,total,swap,last,checkpoint,objects,property files,winners,max200
EXPECTED={4:(4420,6380,4581,6180,202,48,46,20989,1000),5:(4220,6180,4381,5980,202,53,41,9329,660),
6:(4190,6150,4351,5950,202,51,44,2121,120),7:(4520,6480,4681,6280,202,38,29,1832,167),
8:(3930,5890,4091,5690,202,35,29,7619,416),9:(4250,6210,4411,6010,202,33,27,4006,327),
10:(4080,6040,4241,5840,202,51,39,8365,494),11:(4260,6220,4421,6020,202,27,27,1801,136),
12:(4300,6260,4461,6060,202,41,32,8882,460),13:(4070,6030,4231,5830,202,40,33,4297,310),
14:(4720,6680,4881,6480,203,41,30,3053,276),15:(4370,6330,4531,6130,203,49,39,4107,339)}

class CatalogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixtures={i:json.loads((P/f'fixtures/{"goal" if i==16 else f"map{i:02}"}-source.json').read_text()) for i in range(4,17)}
        cls.data={i:compiler.compile_map(f,0,i) for i,f in cls.fixtures.items()}

    def changed(self,i,mutate):
        f=copy.deepcopy(self.fixtures[i]);mutate(f)
        return compiler.compile_map(f,0,i)

    def test_all_remaining_source_counts_and_local_metadata_preserve_true_density(self):
        for i,e in EXPECTED.items():
            with self.subTest(map=i):
                d=self.data[i]
                actual=tuple(d[k] for k in ('authoredCount','totalCount','swapLine','lastLine','checkpointLine'))
                actual+=(len(d['objects']),sum(o['hasProperties'] for o in d['objects']),len(d['placements']),d['maxWindowProps'])
                self.assertEqual(actual,e);self.assertEqual(d['id'],i)
                self.assertEqual(self.fixtures[i]['startPlacements'],[])
                self.assertTrue(all(x['kind']=='authored' for x in d['definitions']))
                for n,o in enumerate(d['objects'],1):
                    self.assertEqual(o['id'],n);self.assertEqual(o['sourcePath'],f'Resources/Maps/MapLevels/Map{i}/{n}.png')
                    self.assertEqual(o['sourceSizePx'],self.fixtures[i]['objects'][n-1]['sizePx'])
                    if not o['hasProperties']:
                        self.assertEqual(o['scale'],1);self.assertEqual(o['collisionWidthSourcePx'],o['sourceSizePx'][0])
                        self.assertEqual(o['pivotRight'],[0,1]);self.assertEqual(o['collisionPivotLeft'],[.5,1])
                self.assertTrue(all(1<=x['objectId']<=e[5] for x in d['definitions']))
        self.assertEqual(sum(len(self.data[i]['objects']) for i in EXPECTED),507)

    def test_all_new_relief_commands_match_independent_source_summary_and_boundaries(self):
        summary=json.loads((compiler.ROOT/'docs/reference/source-track-summary.json').read_text())['maps']
        for i in EXPECTED:
            d=self.data[i];cursor=0;commands=summary[i-1]['commands']
            self.assertEqual(len(d['commands']),len(commands))
            for a,e in zip(d['commands'],commands):
                self.assertEqual(a['sourceLine'],e['sourceLine']);self.assertEqual(a['effective'],e['sourceEffectiveEnterHoldLeave'])
                self.assertEqual(a['firstSegment'],cursor);cursor+=e['sourceSegmentCount']
            self.assertEqual(cursor,d['authoredCount'])
            self.assertFalse(d['segments'][cursor-1]['mirror']);self.assertTrue(d['segments'][cursor]['mirror'])
            self.assertEqual(d['segments'][d['swapLine']-1]['curve'],-2)
            self.assertTrue(d['segments'][d['swapLine']-1]['mirror'])
            self.assertFalse(d['segments'][-1]['mirror'])
            for a,b in zip(d['segments'],d['segments'][1:]):self.assertEqual(a['y1'],b['y0'])

    def test_prefix_winner_identity_checkpoint_provenance_and_map4_full_five_slots(self):
        for i,d in self.data.items():
            self.assertEqual(d['objectOffsets'][0],0);self.assertEqual(d['objectOffsets'][-1],len(d['placements']))
            self.assertEqual(len({x['id'] for x in d['placements']}),len(d['placements']))
            self.assertEqual(d['candidatePlacements'],len(d['placements'])+len(d['overwritten']))
            for row in range(d['totalCount']):
                a,b=d['objectOffsets'][row:row+2]
                for placement in d['placements'][a:b]:
                    self.assertEqual(placement['segment'],row);self.assertEqual(placement['id'],row*5+placement['slot'])
            if i!=16:
                cp=d['checkpointLine'];a,b=d['objectOffsets'][cp:cp+2]
                self.assertEqual([d['definitions'][p['definition']]['objectId'] for p in d['placements'][a:b]],[len(d['objects'])-1,len(d['objects'])])
                source_row=next(n for n,line in enumerate(self.fixtures[i]['mapText'].splitlines(),1) if line==f'LINE_CHECKPOINT: {cp}')
                self.assertEqual([d['definitions'][p['definition']]['sourceLine'] for p in d['placements'][a:b]],[source_row+1,source_row+2])
        d=self.data[4];offset=d['objectOffsets'];start=next(i for i in range(d['totalCount']-199) if offset[i+200]-offset[i]==1000)
        self.assertEqual(len(d['placements'][offset[start]:offset[start+200]]),1000)
        for row in range(start,start+200):self.assertEqual([p['slot'] for p in d['placements'][offset[row]:offset[row+1]]],[0,1,2,3,4])

    def test_complete_triangular_and_sequential_successors_without_runtime_activation(self):
        expected={4:(7,8,5),5:(8,9,6),6:(9,10,7),7:(11,12,8),8:(12,13,9),9:(13,14,10),10:(14,15,11),
                  11:(16,16,12),12:(16,16,13),13:(16,16,14),14:(16,16,15),15:(16,16,16),16:(-1,-1,-1)}
        for i,links in expected.items():self.assertEqual(tuple(self.data[i]['links'][k] for k in ('left','right','sequential')),links)

    def test_goal_uses_real_recipe_and_shared_assembler_not_fake_map_source(self):
        f=self.fixtures[16];d=self.data[16]
        self.assertNotIn('mapText',f);self.assertNotIn('mapPath',f);self.assertNotIn('startPlacements',f)
        self.assertEqual((d['authoredCount'],d['totalCount'],d['swapLine'],d['lastLine']),(1050,3010,1211,2810))
        self.assertEqual((len(d['definitions']),d['candidatePlacements'],len(d['overwritten']),len(d['placements']),d['maxWindowProps']),(938,941,558,383,187))
        self.assertEqual((d['timeSeconds'],d['checkpointLine'],d['terrain'],d['roadTerrain']),(80,-1,1,0))
        self.assertEqual(f['goalPolicy']['terrainProfile'],'goal-terrain-defaults-v1')
        self.assertEqual(d['palette'][0],[0,207,205,255]);self.assertEqual(d['palette'][1],[255,235,221,255])
        self.assertEqual(d['commands'],[{'sourceLine':244,'command':'STRAIGHT','arguments':[350,350,350,0,3],'firstSegment':0,'count':1050,'effective':[350,350,350]}])
        self.assertTrue(all(x['y0']==0 and x['y1']==0 and x['curve']==0 and x['gap']==0 for x in d['segments'][:1050]))
        self.assertEqual([o['sourcePath'] for o in d['objects']],[f'Resources/Maps/MapStartGoal/{i}.png' for i in range(1,46)])
        for row,slot,obj in [(504,1,1),(504,4,30),(505,1,45),(505,4,45),(506,1,44),(682,1,45),(682,4,45),(683,1,44)]:
            p=next(p for p in d['placements'] if p['segment']==row and p['slot']==slot)
            self.assertEqual(d['definitions'][p['definition']]['objectId'],obj)
        for pair in [((505,1),(682,1)),((505,4),(682,4)),((506,1),(683,1))]:
            ids=[next(p['definition'] for p in d['placements'] if (p['segment'],p['slot'])==key) for key in pair]
            self.assertEqual(ids[0],ids[1])
        self.assertEqual(compiler.encoded(d),compiler.encoded(compiler.compile_map(copy.deepcopy(f),0,16)))

    def test_new_source_validation_rejects_wrong_local_paths_bad_rows_slots_and_policy(self):
        for i in EXPECTED:
            changes=[lambda f:f.update(sourceCommit='0'*40),lambda f:f.update(mapPath='Resources/Maps/MapLevels/Map1/map.txt'),
                     lambda f:f.update(mapSha256='0'*64),lambda f:f['objects'].pop(),lambda f:f['objects'][0].update(id=0),
                     lambda f:f['objects'][0].update(sourcePath='Resources/Maps/MapStartGoal/1.png'),
                     lambda f:f['objects'][0].update(propertiesText='WIDTH_COLLISION: -1')]
            for change in changes:
                with self.subTest(map=i),self.assertRaises(ValueError):self.changed(i,change)
            def modify(text):
                f=copy.deepcopy(self.fixtures[i]);f['mapText']=text;f['mapSha256']=hashlib.sha256(text.encode()).hexdigest();return f
            for text in [self.fixtures[i]['mapText'].replace('LINE_CHECKPOINT:', 'LINE_CHECKPOINT::',1),
                         self.fixtures[i]['mapText'].replace('END_FILE','END_FILE extra',1),
                         self.fixtures[i]['mapText'].replace('SPRITE_NEAR_LEFT:','SPRITE_UNKNOWN:',1)]:
                with self.assertRaisesRegex(ValueError,rf'Map{i}/map.txt:\d+:1:'):compiler.compile_map(modify(text),0,i)
        for change in [lambda f:f['goalPolicy'].update(terrain=2),lambda f:f['goalPolicy'].update(checkpointLine=0),
                       lambda f:f['goalPolicy'].update(seed=1),lambda f:f['sourceRecipe']['biome'].update(text='fake')]:
            with self.assertRaises(ValueError):self.changed(16,change)
        for i in [0,17,-1,True,'16']:
            with self.assertRaisesRegex(ValueError,'unsupported map ID'):compiler.compile_map(self.fixtures[4],0,i)
        with self.assertRaisesRegex(ValueError,'goal has no map.txt'):compiler.map_path(16)
        with self.assertRaisesRegex(ValueError,'goal review profile'):compiler.compile_map(self.fixtures[16],1,16)

    def test_maps1_to3_serialization_is_exactly_unchanged(self):
        for i in (1,2,3):
            fixture=json.loads((P/f'fixtures/map{i:02}-source.json').read_text());data=compiler.compile_map(fixture,0,i)
            self.assertEqual(compiler.encoded(data).encode(),(compiler.ROOT/f'outrun/assets/data/biomes/map{i:02}.json').read_bytes())

    def test_full_new_numeric_capture_provenance_all_fields_and_declared_pair_operands(self):
        capture=json.loads((P/'fixtures/remaining-catalog-numeric.json').read_text())
        self.assertEqual(capture['sourceCommit'],compiler.PIN)
        self.assertEqual(capture['kernelSha256'],hashlib.sha256((compiler.ROOT/capture['kernel']).read_bytes()).hexdigest())
        self.assertEqual(capture['buildFlags'],['-std=c++17','-O0','-ffp-contract=off'])
        self.assertEqual(set(capture['maps']),set(map(str,range(4,17))))
        for i,d in self.data.items():
            f=self.fixtures[i];reference=capture['maps'][str(i)]
            commands=numeric.independent_commands(f)
            self.assertEqual(hashlib.sha256(commands.encode()).hexdigest(),reference['commandStreamSha256'])
            self.assertEqual(reference['totalRows'],d['totalCount']);self.assertEqual(reference['comparedFields'],d['totalCount']*4)
            if i==16:self.assertEqual(reference['sourceRecipeSha256'],{k:hashlib.sha256(f['sourceRecipe'][k]['text'].encode()).hexdigest() for k in ('logger','biome')})
            else:self.assertEqual(reference['sourceMapSha256'],hashlib.sha256(f['mapText'].encode()).hexdigest())
            pairs=numeric.declared_pairs(reference,i);self.assertEqual(len(pairs),reference['differingFields'])
            for (_,row,field),(ported,source) in pairs.items():self.assertEqual(d['segments'][row][field],ported);self.assertNotEqual(ported,source)
            # Captured tuple operand fingerprints are pinned below from independent
            # full-row C++ extraction, not generated as an expected value at test time.
            self.assertEqual(hashlib.sha256(json.dumps(reference['differences'],sort_keys=True,separators=(',',':')).encode()).hexdigest(),PAIR_HASHES[i])

# Filled from the independent all-row diagnostic capture; no numerical tolerance.
PAIR_HASHES={4: 'f36a037db142727373f75c99ad02726a2ef4774d80aab97b090513858b99c133', 5: '4dc588d4831b376e913dbf547f92f760e75574b3b5787526e0eb03de1037f415', 6: '4c02777b0691efa522273bf090cbff15172a317b0899e56f4e25c8f3b14dfd57', 7: 'd3d4137e0f0fd5a048aa371ee6744aa16a56f33426ee8cec18febbf164784386', 8: 'f8b3c8c7869d66dfd1b2a0a226a7f16fb60cc1228fecc4097eb7e30b0ab03624', 9: '1e3a3110249ca128578d9f8ea2c51fde244f78977cf4c6291f025c487320357e', 10: '23dfba4098ecb54cf0356c2f82b90926fcb9e2000569bbb662c64598838caa6e', 11: 'a3b005590eab223cfcc7e96e8531814db66a789c7f94a90b6a2bfd0e87c83bd6', 12: '2ab4cce67f4421ebc2285ad685203f51fc544517f05f0f20851e71d1aaf0a5b6', 13: '350413164199da8820218d9d33180d5873fe6dab4ee5e40637899f9f1bb137f8', 14: '7fab7ab8eec0d2082b935f283aee626104f04f97b5952e25624f60a276c623b2', 15: 'c8f7927875b192c17e8479212cd447b682b308b41e03c49935495f24440d2bb6', 16: '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'}
if __name__=='__main__':unittest.main()
