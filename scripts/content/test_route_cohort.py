"""Exact offline pooled-cohort integrity; this does not assert native heap budgets."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest

P=Path(__file__).parent
spec=importlib.util.spec_from_file_location('route_cohort_builder',P/'build-route-cohort.py')
builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)
compiler=builder.compiler
ROOT=builder.ROOT

class RouteCohortTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cohort=builder.build_route_cohort()

    def test_committed_cohort_is_deterministic_and_all48_full_profiles_are_exact(self):
        cohort=self.cohort
        self.assertEqual((cohort['$type'],cohort['format'],cohort['sourceCommit']),('SourceRouteCohort',builder.FORMAT,compiler.PIN))
        self.assertEqual(builder.OUTPUT.read_bytes(),compiler.encoded(cohort).encode())
        self.assertEqual(len(cohort['entries']),16)
        rows=cohort['rows'];keys=[builder.row_key(row)for row in rows]
        self.assertEqual(len(rows),90136);self.assertEqual(len(set(keys)),90136)
        references=set();logical_rows=0
        for map_id,entry in enumerate(cohort['entries'],1):
            stem='goal'if map_id==16 else f'map{map_id:02}'
            fixture=json.loads((P/f'fixtures/{stem}-source.json').read_text())
            raw=(ROOT/f'outrun/assets/data/biomes/{stem}.json').read_bytes();base=json.loads(raw)
            self.assertEqual(entry['baseAssetSha256'],hashlib.sha256(raw).hexdigest())
            self.assertEqual(entry['base'],{key:value for key,value in base.items()if key not in('$type','segments')})
            self.assertNotIn('segments',entry['base']);self.assertNotIn('$type',entry['base'])
            self.assertEqual(len(entry['baseRows']),base['totalCount'])
            self.assertEqual([p['gradient']for p in entry['profiles']],[-1,1])
            for gradient in(-1,0,1):
                selected=entry['baseRows'][:]
                if gradient:
                    tail=entry['profiles'][0 if gradient==-1 else 1]['tailRows']
                    self.assertEqual(len(tail),1960);selected[base['authoredCount']:]=tail
                for index in selected:
                    self.assertIs(type(index),int);self.assertGreaterEqual(index,0);self.assertLess(index,len(rows));references.add(index)
                expected=compiler.compile_route_profile(fixture,gradient,map_id)
                self.assertEqual({**entry['base'],'forkGradient':gradient},{key:value for key,value in expected.items()if key not in('$type','segments')})
                self.assertEqual([keys[index]for index in selected],[builder.row_key(row)for row in expected['segments']])
                logical_rows+=len(selected)
        self.assertEqual(logical_rows,292164);self.assertEqual(references,set(range(90136)))
        tails=json.loads((ROOT/'outrun/assets/data/routes/original-tail-profiles.json').read_text())
        self.assertEqual(cohort['sourceHashes'],tails['sourceHashes'])

    def test_row_identity_preserves_signed_zero_and_rejects_unrepresentable_fields(self):
        row={'y0':0,'y1':0.,'curve':0.,'gap':0.,'mirror':False,'light':0}
        self.assertEqual(builder.row_key(row),builder.row_key({**row,'y0':0.}))
        self.assertNotEqual(builder.row_key(row),builder.row_key({**row,'y0':-0.}))
        for change in ({'y1':float('nan')},{'gap':float('inf')},{'curve':True},{'mirror':0},{'light':False},{'extra':1}):
            with self.assertRaises(ValueError):builder.row_key({**row,**change})

    def test_corrupt_source_fixture_base_bytes_and_tail_codec_are_rejected(self):
        # First-map corruption fails before any later map is needed. Keep the test
        # independent of a complete duplicate source tree or mutable repo assets.
        with tempfile.TemporaryDirectory(prefix='route-cohort-negative-')as name:
            root=Path(name);fixture=root/'scripts/content/fixtures/map01-source.json';fixture.parent.mkdir(parents=True)
            shutil.copyfile(P/'fixtures/map01-source.json',fixture)
            asset=root/'outrun/assets/data/biomes/map01.json';asset.parent.mkdir(parents=True)
            shutil.copyfile(ROOT/'outrun/assets/data/biomes/map01.json',asset)
            data=json.loads(asset.read_text());data['segments'][0]['gap']+=1;asset.write_text(compiler.encoded(data))
            with self.assertRaisesRegex(ValueError,'gradient0 bytes changed'):builder.build_route_cohort(root)
        # Real compiler validates every fixture against its recorded input hash.
        fixture=json.loads((P/'fixtures/map01-source.json').read_text());changed=copy.deepcopy(fixture)
        changed['mapText']+='\n'
        with self.assertRaises(ValueError):compiler.compile_map(changed,0,1)
        original=builder.tail_builder.build_route_profiles
        try:
            # Isolate the committed-tail cross-check without recompiling the full
            # source cohort for a second time in this negative case.
            builder.tail_builder.build_route_profiles=lambda root,source: {'untrusted':'codec'}
            with self.assertRaisesRegex(ValueError,'tail codec differs'):builder.build_route_cohort()
        finally:builder.tail_builder.build_route_profiles=original

if __name__=='__main__':unittest.main()
