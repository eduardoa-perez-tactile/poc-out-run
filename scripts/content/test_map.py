import copy
import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch
P=Path(__file__).parent
spec=importlib.util.spec_from_file_location('map_compiler',P/'convert-map.py');compiler=importlib.util.module_from_spec(spec);spec.loader.exec_module(compiler)
FIXTURE=json.loads((P/'fixtures/map01-source.json').read_text())
class MapTests(unittest.TestCase):
    def compile(self,text=None,gradient=0):
        fixture=copy.deepcopy(FIXTURE)
        if text is not None:
            fixture['mapText']=text;fixture['mapSha256']=compiler.hashlib.sha256(text.encode()).hexdigest()
        return compiler.compile_map(fixture,gradient)
    def checkpoint_boundary_source(self,segment):
        lines=FIXTURE['mapText'].splitlines()
        self.assertEqual(lines.count('END_FILE'),1)
        end=lines.index('END_FILE')
        lines[end:end]=[f'LINE_CHECKPOINT: {segment}','SPRITE_CENTER: 46 0.25 0.0 0']
        # Return the checkpoint record's actual one-based source line.
        return '\n'.join(lines)+'\n',end+1
    def test_checkpoint_first_and_last_authored_segments_keep_placed_object_association(self):
        authored_count=self.compile()['authoredCount']
        for segment in [0,authored_count-1]:
            with self.subTest(segment=segment):
                source,checkpoint_row=self.checkpoint_boundary_source(segment)
                data=self.compile(source)
                self.assertEqual(data['checkpointLine'],segment)
                self.assertEqual(data['authoredCount'],authored_count)
                definition=next(d for d in data['definitions'] if d['sourceLine']==checkpoint_row+1)
                self.assertEqual(definition['kind'],'authored')
                self.assertEqual(definition['objectId'],46)
                self.assertEqual(definition['offsetX'],.25)
                self.assertEqual(data['objects'][definition['objectId']-1]['sourcePath'],
                                 'Resources/Maps/MapLevels/Map1/1.png')
                placements=[p for p in data['placements'] if p['definition']==definition['id']]
                self.assertEqual(placements,[{'id':segment*5+2,'segment':segment,
                                             'slot':2,'definition':definition['id']}])
                first,end=data['objectOffsets'][segment:segment+2]
                self.assertIn(placements[0],data['placements'][first:end])
    def test_checkpoint_negative_and_authored_end_exclusive_fail_with_exact_source_context(self):
        authored_count=self.compile()['authoredCount']
        for segment in [-1,authored_count]:
            with self.subTest(segment=segment):
                source,checkpoint_row=self.checkpoint_boundary_source(segment)
                with self.assertRaises(ValueError) as failure:
                    self.compile(source)
                self.assertEqual(str(failure.exception),
                                 f"{FIXTURE['mapPath']}:{checkpoint_row}:1: line out of range")
    def test_committed_output_is_byte_identical_and_complete(self):
        data=self.compile();self.assertEqual(compiler.encoded(data),compiler.OUTPUT.read_text())
        self.assertEqual((data['authoredCount'],data['totalCount'],data['swapLine'],data['lastLine']),(4123,6083,4284,5883))
        self.assertEqual(data['links'],{'left':2,'right':3,'sequential':2})
        self.assertEqual(data['checkpointLine'],-1)
        self.assertEqual((data['candidatePlacements'],len(data['placements']),len(data['overwritten'])),(2341,1475,866))
        self.assertEqual(data['maxWindowProps'],138)
    def test_hill_leave_bug_hold_factor_and_all_phase_boundaries_match_reference(self):
        data=self.compile();summary=json.loads((compiler.ROOT/'docs/reference/source-track-summary.json').read_text())['maps'][0]
        for actual,expected in zip(data['commands'],summary['commands']):
            self.assertEqual(actual['effective'],expected['sourceEffectiveEnterHoldLeave'])
            self.assertEqual(actual['sourceLine'],expected['sourceLine'])
        self.assertEqual(len(data['commands']),len(summary['commands']))
        for previous,current in zip(data['segments'],data['segments'][1:]):self.assertEqual(previous['y1'],current['y0'])
    def test_gap_truncates_each_increment_toward_zero_and_hill_does_not_reach_target(self):
        rows=[];compiler.expand(rows,100,100,100,0,0,False,0,1)
        compiler.expand(rows,100,100,100,0,0,False,1036,1);self.assertEqual(rows[-1]['gap'],900)
        compiler.expand(rows,100,100,100,0,0,False,0,1);self.assertEqual(rows[-1]['gap'],0)
        rows=[];compiler.expand(rows,1,1,1,0,0,False,1036,1)
        compiler.expand(rows,100,100,100,0,0,False,0,1);self.assertEqual(rows[-1]['gap'],136)
        rows=[];compiler.expand(rows,2,2,2,0,1,False,0,1)
        self.assertAlmostEqual(rows[-1]['y1'],139.951905,places=4);self.assertNotEqual(rows[-1]['y1'],150)
    def test_zero_length_phases_are_valid_but_empty_or_first_mirror_are_not(self):
        for phases in [(0,3,0),(3,0,0),(0,0,3)]:
            rows=[];compiler.expand(rows,*phases,1,0,False,0,1);self.assertEqual(len(rows),3)
        for phases,mirror in [((0,0,0),False),((1,1,1),True)]:
            with self.assertRaisesRegex(ValueError,'map.txt:1:1:'):compiler.expand([], *phases,0,0,mirror,0,1)
    def test_start_call_overwrite_is_preserved_not_invented_extra_slot(self):
        data=self.compile();events=[x for x in data['overwritten'] if x['segment']==308 and x['slot']==4]
        self.assertEqual(len(events),1);event=events[0]
        self.assertEqual(data['definitions'][event['previousDefinition']]['objectId'],27)
        self.assertEqual(data['definitions'][event['definition']]['objectId'],25)
    def test_groups_use_absolute_modulo_exclusive_end_and_last_write_wins(self):
        data=self.compile();source=FIXTURE['mapText']
        row=source.splitlines().index('GROUP_LINES: 380 440 5 10')+2
        definition=next(d for d in data['definitions'] if d['sourceLine']==row)
        self.assertEqual([p['segment'] for p in data['placements'] if p['definition']==definition['id']],[380,390,400,410,420,430])
        changed=source.replace('GROUP_LINES: 380 440 5 10','GROUP_LINES: 381 440 5 10')
        altered=self.compile(changed)
        original=sum(1 for p in data['placements'] if data['definitions'][p['definition']]['sourceLine']==row)
        modified=sum(1 for p in altered['placements'] if altered['definitions'][p['definition']]['sourceLine']==row)
        self.assertGreater(original,modified)
        self.assertEqual(len({p['id'] for p in data['placements']}),len(data['placements']))
        for i in range(data['totalCount']):
            a,b=data['objectOffsets'][i:i+2]
            self.assertTrue(all(p['segment']==i for p in data['placements'][a:b]))
    def test_object_defaults_id_offset_and_override_width_are_logical_source_metadata(self):
        data=self.compile();self.assertTrue(data['objects'][45]['sourcePath'].endswith('Map1/1.png'))
        self.assertTrue(data['objects'][70]['sourcePath'].endswith('Map1/26.png'))
        default=data['objects'][50];self.assertFalse(default['hasProperties']);self.assertEqual(default['collisionWidthSourcePx'],1000)
        self.assertEqual(default['pivotLeft'],[1,1]);self.assertEqual(default['collisionPivotRight'],[.5,1])
        override=data['objects'][48];self.assertEqual(override['collisionWidthSourcePx'],20)
    def test_malformed_map_records_fail_with_real_source_context(self):
        base=FIXTURE['mapText']
        for before,after in [('STRAIGHT: 100 100 100 0 8','STRAIGHT: 100 100 100 0 9'),('GROUP_LINES: 320 370 3 1','GROUP_LINES: 320 370 0 1'),('SPRITE_NEAR_LEFT: 49 -0.8 0.0 0','SPRITE_NEAR_LEFT: 72 -0.8 0.0 0'),('HILL_STRAIGHT: 5 5 5 50 7 28','HILL_STRAIGHT: 5 5 5 50 7 0'),('STRAIGHT: 20 20 20 0 8','UNKNOWN: 20 20 20 0 8'),('COLOR_BACKGROUND: 0 148 255 255','COLOR_BACKGROUND: 0 148 256 255'),('END_FILE','SPRITES'),('STRAIGHT: 20 20 20 0 8','STRAIGHT:: 20 20 20 0 8'),('SPRITE_NEAR_LEFT: 49 -0.8 0.0 0','SPRITE_NEAR_LEFT 49 -0.8 0.0 0')]:
            with self.subTest(after=after),self.assertRaisesRegex(ValueError,'map.txt:\\d+:1:'):self.compile(base.replace(before,after,1))
    def test_invalid_property_values_fail_and_missing_property_file_uses_defaults(self):
        obj=copy.deepcopy(FIXTURE['objects'][0])
        for text in ['SCALE: 0','COLLISION: 2','COLLISION: 1.0','SHOW_TERRAIN: 6','PIVOT_LEFT: nan 1','UNKNOWN: 1','WIDTH_COLLISION: -1']:
            obj['propertiesText']=text
            with self.subTest(text=text),self.assertRaisesRegex(ValueError,'.txt:1:1:'):compiler.properties(obj)
        obj['propertiesText']=None;self.assertEqual(compiler.properties(obj)['scale'],1)
    def test_recorded_extracted_cpp_numeric_samples(self):
        data=self.compile();oracle=json.loads((P/'fixtures/map01-numeric.json').read_text())
        self.assertEqual(oracle['sourceCommit'],compiler.PIN)
        for sample in oracle['samples']:
            row=data['segments'][sample['index']]
            compiler.compare_numeric_reference(sample['index'],row,sample)
            for key in ['y0','y1','curve','gap']:self.assertEqual(row[key],compiler.f32(row[key]))
    def test_numeric_oracle_exceptions_reject_two_ulps_or_excess_height(self):
        data=self.compile()
        oracle={s['index']:s for s in json.loads((P/'fixtures/map01-numeric.json').read_text())['samples']}
        expected=oracle[884];changed=dict(expected)
        bits=compiler.struct.unpack('<I',compiler.struct.pack('<f',expected['curve']))[0]
        changed['curve']=compiler.struct.unpack('<f',compiler.struct.pack('<I',bits+2))[0]
        with self.assertRaisesRegex(ValueError,'curve'):compiler.compare_numeric_reference(884,changed,expected)
        expected=oracle[437];changed=dict(expected);changed['y1']+=.002
        with self.assertRaisesRegex(ValueError,'height'):compiler.compare_numeric_reference(437,changed,expected)
        expected=oracle[0];changed=dict(expected);changed['y1']=.00001
        with self.assertRaisesRegex(ValueError,'exact height'):compiler.compare_numeric_reference(0,changed,expected)
    def test_missing_source_object_reports_path_and_line(self):
        with patch.object(compiler.subprocess,'check_output',side_effect=[compiler.PIN,'']):
            with self.assertRaisesRegex(ValueError,'MapStartGoal/1.png:1:1: missing'):
                compiler.source_fixture(Path('/unreadable'))
    def test_source_guards_reject_wrong_head_or_tracked_dirty_inputs(self):
        for responses in [['0'*40],[compiler.PIN,' M Resources/Maps/MapLevels/Map1/map.txt']]:
            with patch.object(compiler.subprocess,'check_output',side_effect=responses):
                with self.assertRaisesRegex(ValueError,'source:1:1:'):compiler.source_fixture(Path('/unreadable'))
    def test_gradient_profiles_are_explicit_reproducible_and_bound_geometry(self):
        for gradient in [-1,0,1]:
            data=self.compile(gradient=gradient);self.assertEqual(data['forkGradient'],gradient);self.assertEqual(len(data['segments']),6083)
        with self.assertRaisesRegex(ValueError,'gradient'):self.compile(gradient=2)
if __name__=='__main__':unittest.main()
