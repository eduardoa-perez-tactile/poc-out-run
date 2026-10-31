"""Whole-cohort source tail codec/oracle checks; no runtime or new race claim."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import unittest

P=Path(__file__).parent

def module(name,file):
    spec=importlib.util.spec_from_file_location(name,P/file);result=importlib.util.module_from_spec(spec);spec.loader.exec_module(result);return result

builder=module('route_builder','build-route-profiles.py');compiler=builder.compiler
numeric=module('route_numeric','check-numeric-oracle.py')
ROOT=compiler.ROOT

class RouteProfileTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixtures={i:json.loads((P/f'fixtures/{"goal"if i==16 else f"map{i:02}"}-source.json').read_text())for i in range(1,17)}
        cls.profiles={(i,g):compiler.compile_route_profile(f,g,i)for i,f in cls.fixtures.items()for g in(-1,0,1)}
        cls.compact=builder.build_route_profiles();cls.reference=json.loads((P/'fixtures/route-profiles-numeric.json').read_text())

    def test_all_zero_profiles_preserve_all_existing_serialized_biomes(self):
        for i in range(1,17):
            stem='goal'if i==16 else f'map{i:02}'
            self.assertEqual(compiler.encoded(self.profiles[i,0]).encode(),(ROOT/f'outrun/assets/data/biomes/{stem}.json').read_bytes())
        self.assertEqual(hashlib.sha256(compiler.encoded(self.profiles[1,0]).encode()).hexdigest(),'b7ee275ebd5bfe7dedbd0a4772715cac1b666f8c97639f72f5cc4ddb6a7ee510')
        with self.assertRaisesRegex(ValueError,'goal review profile requires gradient0'):compiler.compile_map(self.fixtures[16],1,16)

    def test_32_nonzero_compact_profiles_reconstruct_every_source_tail_without_body_duplication(self):
        self.assertEqual(self.compact['format'],builder.FORMAT);self.assertEqual([e['mapId']for e in self.compact['entries']],list(range(1,17)))
        checked=0
        for entry in self.compact['entries']:
            i=entry['mapId'];base=self.profiles[i,0];authored=base['authoredCount']
            self.assertNotIn('segments',entry);self.assertNotIn('objects',entry)
            self.assertEqual([p['gradient']for p in entry['profiles']],[-1,1])
            self.assertEqual((entry['authoredCount'],entry['totalCount'],entry['segmentLength']),(authored,base['totalCount'],150))
            for profile in entry['profiles']:
                g=profile['gradient'];variant=self.profiles[i,g];previous=base['segments'][authored-1]['y1']
                self.assertEqual(len(profile['y1Bits']),1960)
                self.assertEqual((profile['swapLine'],profile['lastLine']),(base['swapLine'],base['lastLine']))
                for key in base:
                    if key not in('segments','forkGradient'):self.assertEqual(variant[key],base[key])
                self.assertEqual(variant['segments'][:authored],base['segments'][:authored])
                for index,bits in enumerate(profile['y1Bits'],authored):
                    self.assertIs(type(bits),int);self.assertGreaterEqual(bits,0);self.assertLessEqual(bits,0xffffffff)
                    y1=struct.unpack('<f',struct.pack('<I',bits))[0]
                    self.assertEqual(variant['segments'][index],{**base['segments'][index],'y0':previous,'y1':y1});previous=y1;checked+=1
        self.assertEqual(checked,62720)
        # Source first hill does not reach an ideal mathematical +/-12000 endpoint.
        self.assertEqual(self.profiles[16,1]['segments'][-1]['y1'],11999.771484375)
        self.assertEqual(self.profiles[16,-1]['segments'][-1]['y1'],-11999.771484375)
        self.assertEqual((self.profiles[13,0]['authoredCount'],self.profiles[13,0]['lastLine']),(4070,5830))

    def test_source_fixture_is_not_mutated_and_invalid_route_enums_reject(self):
        fixture=copy.deepcopy(self.fixtures[16]);before=compiler.encoded(fixture)
        compiler.compile_route_profile(fixture,-1,16);self.assertEqual(compiler.encoded(fixture),before)
        for gradient in(True,False,-2,2,1.0,None):
            with self.assertRaises(ValueError):compiler.compile_route_profile(self.fixtures[1],gradient,1)
        for map_id in(True,0,17,1.0):
            with self.assertRaises(ValueError):compiler.compile_route_profile(self.fixtures[1],0,map_id)

    def test_packer_rejects_unrepresentable_metadata_geometry_and_discontinuity(self):
        base=self.profiles[1,0]
        mutations=[lambda d:d.update(lastLine=d['lastLine']-1),lambda d:d['segments'][0].update(y1=1),
            lambda d:d['segments'][-1].update(curve=1),lambda d:d['segments'][-1].update(gap=3),
            lambda d:d['segments'][-1].update(mirror=True),lambda d:d['segments'][-1].update(light=9),
            lambda d:d['segments'][d['authoredCount']].update(y0=0),lambda d:d['segments'][-1].update(y1=float('nan'))]
        for change in mutations:
            variant=copy.deepcopy(self.profiles[1,1]);change(variant)
            with self.assertRaises(ValueError):builder.tail_profile(base,variant,1)
        for g in(0,True,2):
            with self.assertRaises(ValueError):builder.tail_profile(base,self.profiles[1,1],g)

    def test_all48_independent_source_command_and_raw_cpp_row_provenance_exact(self):
        reference=self.reference
        self.assertEqual(reference['sourceCommit'],compiler.PIN)
        self.assertEqual(hashlib.sha256((ROOT/reference['kernel']).read_bytes()).hexdigest(),reference['kernelSha256'])
        self.assertEqual(reference['flags'],['-std=c++17','-O0','-ffp-contract=off'])
        self.assertEqual([(r['map'],r['gradient'])for r in reference['profiles']],[(i,g)for i in range(1,17)for g in(-1,0,1)])
        rows=pairs=tail_pairs=0
        for record in reference['profiles']:
            i,g=record['map'],record['gradient'];fixture=self.fixtures[i];data=self.profiles[i,g]
            stem='goal'if i==16 else f'map{i:02}'
            self.assertEqual(record['sourceFixtureSha256'],hashlib.sha256((P/f'fixtures/{stem}-source.json').read_bytes()).hexdigest())
            if i==16:self.assertEqual(record['sourceRecipeSha256'],{k:hashlib.sha256(fixture['sourceRecipe'][k]['text'].encode()).hexdigest()for k in('logger','biome')})
            else:self.assertEqual(record['sourceMapSha256'],hashlib.sha256(fixture['mapText'].encode()).hexdigest())
            commands=numeric.independent_commands(fixture,g)
            self.assertEqual(hashlib.sha256(commands.encode()).hexdigest(),record['commandStreamSha256'])
            self.assertEqual(commands.splitlines()[-6],f'10 300 50 -2 {g*80} 1 0')
            # Reconstruct the captured C++ stream from independently recorded source
            # values at declared pairs, every other field from the compiled source.
            # Its WHOLE raw stream SHA must match the actual extracted-kernel run.
            source={(p['row'],p['field']):p['source']for p in record['differences']}
            text=''.join(str(row)+' '+' '.join(format(source.get((row,k),value[k]),'.9g')for k in numeric.FIELDS)+'\n'for row,value in enumerate(data['segments']))
            self.assertEqual(hashlib.sha256(text.encode()).hexdigest(),record['rawCppRowsSha256'])
            self.assertEqual(numeric.validate_route_pairs(data,text,record),len(record['differences']))
            rows+=record['totalRows'];pairs+=len(record['differences']);tail_pairs+=sum(p['row']>=record['authoredRows']for p in record['differences'])
        self.assertEqual((rows,pairs,tail_pairs),(292164,549,60))

    def test_numeric_policy_rejects_duplicate_missing_changed_and_undeclared_pairs(self):
        record=self.reference['profiles'][0];data=self.profiles[1,-1]
        sources={(p['row'],p['field']):p['source']for p in record['differences']}
        text=''.join(str(i)+' '+' '.join(format(sources.get((i,k),r[k]),'.9g')for k in numeric.FIELDS)+'\n'for i,r in enumerate(data['segments']))
        for change in [lambda d:d['differences'].append(d['differences'][0]),lambda d:d['differences'].pop(),
                       lambda d:d['differences'][0].update(source=0),lambda d:d['differences'][0].update(ulp=True)]:
            changed=copy.deepcopy(record);change(changed)
            with self.assertRaises(ValueError):numeric.validate_route_pairs(data,text,changed)
        changed=copy.deepcopy(data);changed['segments'][0]['gap']=1
        with self.assertRaisesRegex(ValueError,'undeclared'):numeric.validate_route_pairs(changed,text,record)

if __name__=='__main__':unittest.main()
