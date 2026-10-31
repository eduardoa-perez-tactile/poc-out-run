"""Map2/3 source compatibility data, not live route/render acceptance."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import unittest
from unittest.mock import patch

P=Path(__file__).parent
spec=importlib.util.spec_from_file_location('maps_compiler',P/'convert-map.py')
compiler=importlib.util.module_from_spec(spec);spec.loader.exec_module(compiler)
spec_numeric=importlib.util.spec_from_file_location('numeric_checker',P/'check-numeric-oracle.py')
numeric=importlib.util.module_from_spec(spec_numeric);spec_numeric.loader.exec_module(numeric)
FIXTURES={i:json.loads((P/f'fixtures/map{i:02}-source.json').read_text()) for i in (2,3)}

class MapsTests(unittest.TestCase):
    def compile(self,i,text=None,fixture=None,gradient=0):
        f=copy.deepcopy(FIXTURES[i] if fixture is None else fixture)
        if text is not None:f['mapText']=text;f['mapSha256']=hashlib.sha256(text.encode()).hexdigest()
        return compiler.compile_map(f,gradient,i)

    def test_exact_source_inventory_density_graph_and_provenance(self):
        expected={2:(4605,6565,4766,6365,196,4491,3692,799,237,36,30,170,4,5,3),
                  3:(4920,6880,5081,6680,148,4153,3702,451,396,39,29,160,5,6,4)}
        hashes={2:'57440fafc25c8513979b94d340fad6d3993a3f6255b2b356c54d90e0d128812b',
                3:'43ece1d375b9958551f2d3be1b450637a4ea79a9c4938903cbd59453a244e634'}
        for i,e in expected.items():
            with self.subTest(map=i):
                d=self.compile(i)
                actual=tuple(d[k] for k in ('authoredCount','totalCount','swapLine','lastLine'))
                actual+=(len(d['definitions']),d['candidatePlacements'],len(d['placements']),len(d['overwritten']),d['maxWindowProps'],len(d['objects']),sum(o['hasProperties'] for o in d['objects']),d['timeSeconds'])
                actual+=tuple(d['links'][k] for k in ('left','right','sequential'))
                self.assertEqual(actual,e)
                self.assertEqual(d['id'],i);self.assertEqual(d['checkpointLine'],203)
                self.assertEqual((d['terrain'],d['roadTerrain']),(2,0))
                self.assertEqual(d['sourceHashes'][FIXTURES[i]['mapPath']],hashes[i])
                self.assertEqual(FIXTURES[i]['startPlacements'],[])
                self.assertTrue(all(x['kind']=='authored' for x in d['definitions']))
                self.assertEqual(set(x['objectId'] for x in d['definitions']),set(range(1,e[9]+1)))
                self.assertEqual(compiler.encoded(d),compiler.encoded(self.compile(i)))

    def test_map1_default_api_fixture_and_output_bytes_are_preserved(self):
        f=json.loads(compiler.FIXTURE.read_text());d=compiler.compile_map(f,0)
        self.assertEqual(compiler.encoded(d).encode(),compiler.OUTPUT.read_bytes())
        self.assertEqual(hashlib.sha256(compiler.encoded(d).encode()).hexdigest(),'b7ee275ebd5bfe7dedbd0a4772715cac1b666f8c97639f72f5cc4ddb6a7ee510')
        self.assertEqual(compiler.encoded(d),compiler.encoded(compiler.compile_map(f,0,1)))

    def test_checkpoint_prefix_winners_and_end_exclusive_groups(self):
        for i,objects,line in [(2,[35,36],53),(3,[38,39],51)]:
            d=self.compile(i);a,b=d['objectOffsets'][203:205];p=d['placements'][a:b]
            self.assertEqual([x['id'] for x in p],[1016,1019])
            self.assertEqual([d['definitions'][x['definition']]['objectId'] for x in p],objects)
            self.assertEqual([d['definitions'][x['definition']]['sourceLine'] for x in p],[line+1,line+2])
            self.assertEqual(len({(x['segment'],x['slot']) for x in d['placements']}),len(d['placements']))
            for row in range(d['totalCount']):
                a,b=d['objectOffsets'][row:row+2]
                self.assertTrue(all(x['segment']==row for x in d['placements'][a:b]))
            self.assertEqual(d['objectOffsets'][-1],len(d['placements']))
            # First source group is [210,300) / [210,400), not inclusive at its end.
            first=d['definitions'][2];emitted=[x['segment'] for x in d['placements'] if x['definition']==first['id']]
            self.assertEqual(emitted,[220,230,250,260,280,290] if i==2 else [220,230,250,280,290,320,340,350,370,380])
            self.assertTrue(any(x['segment']==210 and x['previousDefinition']==2 for x in d['overwritten']))
            self.assertLess(max(emitted),300 if i==2 else 400)
            for x in d['placements']:self.assertEqual(x['id'],x['segment']*5+x['slot'])

    def test_local_object_defaults_and_asymmetric_checkpoint_pivots(self):
        for i,last in [(2,36),(3,39)]:
            d=self.compile(i);default=d['objects'][0]
            self.assertEqual(default['sourcePath'],f'Resources/Maps/MapLevels/Map{i}/1.png')
            self.assertFalse(default['hasProperties']);self.assertEqual(default['sourceSizePx'],[40,128])
            self.assertEqual((default['collisionWidthSourcePx'],default['scale'],default['showTerrain']),(40,1,0))
            self.assertEqual(default['pivotLeft'],[1,1]);self.assertEqual(default['collisionPivotRight'],[.5,1])
            for o in d['objects'][-2:]:
                self.assertEqual(o['scale'],compiler.f32(.65));self.assertEqual(o['collisionWidthSourcePx'],14)
                self.assertEqual(o['collisionPivotLeft'],[compiler.f32(.064),1])
            self.assertEqual(d['objects'][-2]['collisionPivotRight'],[compiler.f32(.64 if i==2 else .936),1])
            self.assertEqual(d['objects'][-1]['collisionPivotRight'],[compiler.f32(.936),1])
            self.assertEqual(d['objects'][-1]['id'],last)

    def test_source_relief_phase_boundaries_and_palettes(self):
        summary=json.loads((compiler.ROOT/'docs/reference/source-track-summary.json').read_text())
        for i in (2,3):
            d=self.compile(i);expected=summary['maps'][i-1]['commands']
            self.assertEqual(len(d['commands']),len(expected))
            cursor=0
            for a,e in zip(d['commands'],expected):
                self.assertEqual(a['sourceLine'],e['sourceLine']);self.assertEqual(a['effective'],e['sourceEffectiveEnterHoldLeave'])
                self.assertEqual(a['firstSegment'],cursor);cursor+=e['sourceSegmentCount']
            self.assertEqual(cursor,d['authoredCount'])
            self.assertEqual(d['palette'][0],[0,128,246,255] if i==2 else [126,228,239,255])
            self.assertEqual(d['palette'][3],[105,71,67,255] if i==2 else [68,68,68,255])
            for a,b in zip(d['segments'],d['segments'][1:]):self.assertEqual(a['y1'],b['y0'])

    def test_independent_extracted_cpp_samples_are_exact_without_map1_exceptions(self):
        # Existing numeric-oracle.cpp extracted Biome.cpp347-365/423-480, built
        # clang++ -O0 -ffp-contract=off. Command streams parsed independently from
        # pinned source, not compiler output. Capture /tmp/outrun67-numeric-report.json.
        samples={2:{320:[0,0,-.375,0],1435:[0,0,0,1030],1465:[470.17626953125,502.40478515625,0,1030],
                    1495:[1818.607177734375,1875,0,1030],1614:[7497.7158203125,7499.4287109375,0,1030],
                    4604:[23997.30078125,23998.84375,0,130],4605:[23998.84375,23998.84375,0,198],
                    4765:[23998.84375,23998.84375,-2,11078],6564:[23998.84375,23998.84375,0,110]},
                 3:{380:[0,0,-.375,0],1870:[0,0,0,1985],1890:[66.31046295166016,73.41519165039062,0,2085],
                    1910:[272.7754821777344,286.4744873046875,0,2185],2069:[2999.259765625,2999.81494140625,0,2980],
                    4919:[8999.4453125,8999.4453125,0,30],4920:[8999.4453125,8999.4453125,0,98],
                    5080:[8999.4453125,8999.4453125,-2,10978],6879:[8999.4453125,8999.4453125,0,10]}}
        for i,rows in samples.items():
            d=self.compile(i)
            for row,expected in rows.items():
                with self.subTest(map=i,row=row):self.assertEqual([d['segments'][row][k] for k in ('y0','y1','curve','gap')],expected)

    def test_full_numeric_capture_provenance_and_all_25_exact_pairs(self):
        capture=json.loads((P/'fixtures/maps23-numeric.json').read_text())
        self.assertEqual(capture['sourceCommit'],compiler.PIN)
        self.assertEqual(capture['kernelSha256'],hashlib.sha256((compiler.ROOT/capture['kernel']).read_bytes()).hexdigest())
        self.assertEqual(capture['buildFlags'],['-std=c++17','-O0','-ffp-contract=off'])
        # Exact differing coordinates from the ALL-row extracted C++ capture.
        # No claim that checking captured pairs here runs that optional binary.
        expected={2:{(922,'curve'),(1484,'y1'),(1485,'y0'),(1825,'y1'),(1826,'y0'),
                     (2008,'y1'),(2009,'y0'),(2015,'y1'),(2016,'y0'),(2194,'y1'),(2195,'y0'),
                     (2868,'y1'),(2869,'y0'),(2889,'y1'),(2890,'y0'),(2912,'y1'),(2913,'y0'),(4427,'y1'),(4428,'y0')},
                  3:{(1958,'y1'),(1959,'y0'),(4032,'y1'),(4033,'y0'),(4172,'y1'),(4173,'y0')}}
        for i in (2,3):
            reference=capture['maps'][str(i)];fixture=FIXTURES[i];data=self.compile(i)
            self.assertEqual(hashlib.sha256(fixture['mapText'].encode()).hexdigest(),reference['sourceMapSha256'])
            # Independently parse COMMITTED source text, not compiler command/row output.
            self.assertEqual(hashlib.sha256(numeric.independent_commands(fixture).encode()).hexdigest(),reference['commandStreamSha256'])
            # Fingerprints of the separately captured exact tuple VALUES protect
            # both source and port operands against accidental fixture widening.
            pair_hashes={2:'a436e397c9c7f0b6f8a4467246a782ca525200d1e0a926a553bc5fae6dac48bb',
                         3:'38c9adb37543bd775000a8d49f8d20d03f14d4e166f697efc1432a0de030ff66'}
            self.assertEqual(hashlib.sha256(json.dumps(reference['differences'],sort_keys=True,separators=(',',':')).encode()).hexdigest(),pair_hashes[i])
            pairs=numeric.declared_pairs(reference,i)
            self.assertEqual({(row,field) for mid,row,field in pairs},expected[i])
            self.assertEqual(len(pairs),reference['differingFields'])
            self.assertEqual(data['totalCount'],reference['totalRows'])
            for (mid,row,field),(ported,source) in pairs.items():
                self.assertEqual(data['segments'][row][field],ported)
                self.assertEqual(source,compiler.f32(source));self.assertNotEqual(ported,source)
            altered=copy.deepcopy(fixture);altered['mapText']=altered['mapText'].replace('STRAIGHT:','CURVE_LEFT:',1)
            with self.assertRaises((ValueError,IndexError)):numeric.independent_commands(altered)

    def test_exact_numeric_checker_rejects_missing_duplicate_unexpected_and_changed_pairs(self):
        # Independent literal diagnostic rows, not source generated from ported rows.
        data={'totalCount':2,'segments':[{'y0':0,'y1':0,'curve':0,'gap':0},
                                        {'y0':0,'y1':0,'curve':.25,'gap':0}]}
        rows='0 0 0 0 0\n1 0 0 0.25000003 0\n'
        reference={'differences':[{'map':2,'row':1,'field':'curve','ported':.25,'source':0.2500000298023224}]}
        self.assertEqual(numeric.compare_map_rows(data,rows,reference,2),1)
        for changed in [ {'differences':[]},
                         {'differences':reference['differences']*2},
                         {'differences':[dict(reference['differences'][0],row=2)]},
                         {'differences':[dict(reference['differences'][0],source=.2500000596046448)]},
                         {'differences':[dict(reference['differences'][0],map=3)]} ]:
            with self.assertRaises(ValueError):numeric.compare_map_rows(data,rows,changed,2)
        for changed_rows in [rows.replace('0 0 0 0 0','0 0 1 0 0'),rows.replace('0.25000003','.25'),rows.splitlines()[0],rows.replace('1 0 0','0 0 0')]:
            with self.assertRaises(ValueError):numeric.compare_map_rows(data,changed_rows,reference,2)

    def test_ids_pin_hash_paths_catalog_and_start_recipe_fail_visibly(self):
        for i in (2,3):
            for change,pattern in [
                (lambda f:f.update(sourceCommit='0'*40),'wrong source commit'),
                (lambda f:f.update(mapPath='Resources/Maps/MapLevels/Map1/map.txt'),'source hash/path'),
                (lambda f:f.update(mapSha256='0'*64),'source hash/path'),
                (lambda f:f['objects'].pop(),'localobjects'),
                (lambda f:f['objects'][0].update(id=2),'ID/path'),
                (lambda f:f['objects'][0].update(sourcePath='Resources/Maps/MapStartGoal/1.png'),'ID/path'),
                (lambda f:f['objects'][0].update(propertiesPath='/tmp/wrong.txt'),'property path'),
                (lambda f:f['objects'][0].update(sha256='wrong'),'PNG metadata'),
                (lambda f:f['objects'][0].update(sizePx=[0,128]),'PNG metadata'),
                (lambda f:f['objects'][0].update(sizePx=[40,128,1]),'PNG metadata'),
                (lambda f:f['objects'][0].update(propertiesText=False),'optional property text'),
                (lambda f:f['implementationSources'].update({'src/Game/Game.cpp':'x'}),'implementation source hashes'),
                (lambda f:f.update(startPlacements=[{}]),'start placements')]:
                f=copy.deepcopy(FIXTURES[i]);change(f)
                with self.subTest(map=i,pattern=pattern),self.assertRaisesRegex(ValueError,pattern):self.compile(i,fixture=f)
        for i in [0,4,-1,True,'2']:
            with self.assertRaisesRegex(ValueError,'unsupported map ID'):compiler.compile_map(FIXTURES[2],0,i)
        with self.assertRaisesRegex(ValueError,'source hash/path'):compiler.compile_map(FIXTURES[2],0,3)

    def test_map_syntax_bounds_slots_and_property_errors_have_source_context(self):
        for i,first in [(2,'35'),(3,'38')]:
            base=FIXTURES[i]['mapText'];marker=f'SPRITE_NEAR_LEFT: {first} -0.4 0.0 0'
            for before,after in [(marker,marker.replace(first,str(len(FIXTURES[i]['objects'])+1),1)),
                                 ('LINE_CHECKPOINT: 203','LINE_CHECKPOINT: -1'),
                                 ('LINE_CHECKPOINT: 203',f'LINE_CHECKPOINT: {4605 if i==2 else 4920}'),
                                 (marker,marker+'\n'+marker),('END_FILE','SPRITES'),
                                 ('STRAIGHT:', 'UNKNOWN:'),('LINE_CHECKPOINT: 203','LINE_CHECKPOINT: 203 1'),
                                 ('LINE_CHECKPOINT: 203','LINE_CHECKPOINT: 1000001'),
                                 (marker,marker.replace('-0.4','nan'))]:
                with self.subTest(map=i,after=after),self.assertRaisesRegex(ValueError,rf'Map{i}/map.txt:\d+:1:'):
                    self.compile(i,base.replace(before,after,1))
            f=copy.deepcopy(FIXTURES[i]);f['objects'][0]['propertiesText']='SCALE: 0'
            with self.assertRaisesRegex(ValueError,rf'Map{i}/1.txt:1:1:'):self.compile(i,fixture=f)
        with self.assertRaisesRegex(ValueError,'Map3/map.txt:1:1: segment bound'):
            compiler.expand([],20001,0,0,0,0,False,0,1,FIXTURES[3]['mapPath'])

    def test_map1_retains_256_guard_but_dense_new_data_preserves_all_five_slots(self):
        for i in (1,2,3):
            f=json.loads(compiler.FIXTURE.read_text()) if i==1 else copy.deepcopy(FIXTURES[i])
            # Author 1000 unique winners in a real 200-row interval, replacing
            # source sprite section only; this is a deliberately dense DATA test.
            f['mapText']=f['mapText'].split('SPRITES')[0]+'SPRITES\nGROUP_LINES: 210 410 1 1\n'+''.join(f'SPRITE_{slot}: 1 0.0 0.0 0\n' for slot in compiler.SLOTS)+'END_FILE\n'
            f['mapSha256']=hashlib.sha256(f['mapText'].encode()).hexdigest()
            if i==1:
                with self.assertRaisesRegex(ValueError,'visible diagnostic pool bound exceeded'):compiler.compile_map(f,0)
            else:
                d=self.compile(i,fixture=f);self.assertEqual(d['maxWindowProps'],1000);self.assertEqual(len(d['placements']),1000)

    def test_png_crc_and_missing_local_source_report_actual_path(self):
        # A complete minimal PNG envelope is enough for metadata; corrupt CRC
        # must fail rather than silently accepting its dimensions.
        def chunk(tag,data):return struct.pack('>I',len(data))+tag+data+struct.pack('>I',compiler.zlib.crc32(tag+data)&0xffffffff)
        png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>II5B',40,128,8,6,0,0,0))+chunk(b'IEND',b'')
        self.assertEqual(compiler.png_size(png,'Map2/1.png'),[40,128])
        changed=bytearray(png);changed[20]^=1
        with self.assertRaisesRegex(ValueError,'Map2/1.png:1:1: PNG CRC'):compiler.png_size(changed,'Map2/1.png')
        for i in (2,3):
            with patch.object(compiler.subprocess,'check_output',side_effect=[compiler.PIN,'']):
                with self.assertRaisesRegex(ValueError,rf'Map{i}/1.png:1:1: missing'):compiler.source_fixture(Path('/unreadable'),i)

if __name__=='__main__':unittest.main()
