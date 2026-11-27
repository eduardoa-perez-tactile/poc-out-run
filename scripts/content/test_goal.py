"""Goal recipe CPU proof: committed inputs, no SDK/upstream/Pillow required."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import types
import unittest

P=Path(__file__).parent
spec=importlib.util.spec_from_file_location('goal_recipe',P/'goal_recipe.py')
goal=importlib.util.module_from_spec(spec);spec.loader.exec_module(goal)
PIN='6882721c99bc79365f815f68d389bf5078129e68'
def need(condition,path,line,message):
    if not condition:raise ValueError(f'{path}:{line}:1: {message}')
def f32(value):return struct.unpack('<f',struct.pack('<f',value))[0]
COMPAT=types.SimpleNamespace(PIN=PIN,need=need,f32=f32)
FIXTURE=json.loads((P/'fixtures/goal-source.json').read_text())

class GoalTests(unittest.TestCase):
    def recipe(self,fixture=None):return goal.goal_recipe(FIXTURE if fixture is None else fixture,COMPAT)
    def test_complete_construction_order_and_reused_final_definitions(self):
        data=self.recipe();defs=data['definitions'];writes=data['writes']
        self.assertEqual(set(data),{'definitions','writes'})
        self.assertEqual(len(defs),938);self.assertEqual(len(writes),941)
        self.assertEqual([d['id'] for d in defs],list(range(938)))
        self.assertTrue(all(d['kind']=='goal' and 1<=d['objectId']<=45 for d in defs))
        self.assertEqual([(d['id'],d['objectId'],d['sourceLine']) for d in defs[-4:]],
                         [(934,1,1559),(935,45,1567),(936,45,1572),(937,44,1577)])
        self.assertEqual(writes[-7:],[
            {'segment':504,'slot':1,'definition':934},
            {'segment':505,'slot':1,'definition':936},{'segment':505,'slot':4,'definition':935},
            {'segment':506,'slot':1,'definition':937},
            {'segment':682,'slot':1,'definition':936},{'segment':682,'slot':4,'definition':935},
            {'segment':683,'slot':1,'definition':937}])
        self.assertEqual(defs[937]['offsetY'],f32(-1.6))
    def test_literal_source_crowd_overshoot_replacements_and_full_density(self):
        data=self.recipe();winners={};overwrites=0;visits670=0
        for w in data['writes']:
            self.assertTrue(0<=w['segment']<1050 and 0<=w['slot']<5)
            key=(w['segment'],w['slot']);overwrites+=key in winners;winners[key]=w['definition']
            visits670+=w['segment']==670 and w['slot']==0
        self.assertEqual((len(winners),overwrites),(383,558))
        # j starts250, reaches670 on iteration390, repeats to668 inclusive,
        # then the contraction loop writes670 once more: 280 total left writes.
        self.assertEqual(visits670,280)
        self.assertEqual(max(sum(a<=row<a+200 for row,slot in winners) for a in range(1050)),187)
        defs=data['definitions']
        self.assertEqual(defs[winners[504,1]]['objectId'],1)
        self.assertEqual(defs[winners[504,4]]['objectId'],30)
        self.assertEqual(defs[winners[670,0]]['sourceLine'],1540)
        self.assertEqual(defs[winners[670,0]]['offsetX'],-1.1099998950958252)
    def test_source_else_if_priority_keeps_cameramen_at_shared_multiple(self):
        data=self.recipe();defs=data['definitions']
        at520=[defs[w['definition']] for w in data['writes'] if w['segment']==520 and w['slot'] in (1,4)]
        self.assertEqual([d['objectId'] for d in at520],[25,26]) # 52 wins over65.
        self.assertFalse(any(c['context'].startswith('i=520:') for c in FIXTURE['randomCalls']))
        at330=[c for c in FIXTURE['randomCalls'] if c['context'].startswith('i=330:')]
        self.assertEqual([c['objectId'] for c in at330],[31,18])
    def test_portable_hash_samples_and_independent_cpp_literal_float_bits(self):
        calls=FIXTURE['randomCalls'];self.assertEqual(len(calls),51)
        # Independently compiled scalar C++ stages, -O0 -ffp-contract=off;
        # extracted arithmetic only, not original game execution.
        for index,n,bits,tokens in [
            (0,3831896,3205929213,['-0.57f','-0.65f']),
            (1,12007545,1060946778,['0.63f','0.78f']),
            (7,3850319,3206909801,['-0.61f','-0.77f']),
            (50,6040889,1057629378,['0.41f','0.77f'])]:
            self.assertEqual((calls[index]['unitInteger'],calls[index]['portedBits'],calls[index]['endpointTokens']),(n,bits,tokens))
        for index,call in enumerate(calls):
            payload=('outrun-goal-offsets/v1\n'+PIN+'\n0\n'+str(index)+'\n').encode('ascii')
            integer=int.from_bytes(hashlib.sha256(payload).digest()[:3],'big')
            self.assertEqual(call['index'],index);self.assertEqual(call['unitInteger'],integer)
            self.assertEqual(call['unitValue'],integer/2**24)
        self.assertEqual(hashlib.sha256(json.dumps(calls,sort_keys=True,separators=(',',':')).encode()).hexdigest(),
                         '39e5461a09b12c9871b7de07fa878d7bebb96e4c9e192c3b6ba0a75705aa509c')
        self.assertEqual(calls[0]['context'],'i=270:man1');self.assertEqual(calls[-1]['context'],'i=666:woman')
    def test_explicit_goal_only_terrain_adaptation_and_shared_provenance(self):
        policy=FIXTURE['goalPolicy'];self.assertEqual((policy['id'],policy['checkpointLine'],policy['terrain'],policy['roadTerrain']),(16,-1,1,0))
        self.assertEqual(policy['terrainProfile'],'goal-terrain-defaults-v1')
        self.assertEqual(policy['panoramas']['front']['sizePx'],[2048,256])
        self.assertEqual(policy['panoramas']['back']['sizePx'],[2182,256])
        self.assertEqual(len(FIXTURE['objects']),45)
        for i,obj in enumerate(FIXTURE['objects'],1):
            self.assertEqual(obj['sourcePath'],f'Resources/Maps/MapStartGoal/{i}.png')
        self.assertNotIn('mapText',FIXTURE);self.assertNotIn('mapPath',FIXTURE)
        self.assertEqual(FIXTURE['sourceRecipe']['logger']['firstLine'],1410)
        self.assertEqual(FIXTURE['sourceRecipe']['biome']['firstLine'],223)
    def test_mutated_recipe_with_rehashed_excerpt_is_rejected(self):
        fixture=copy.deepcopy(FIXTURE);entry=fixture['sourceRecipe']['logger']
        entry['text']=entry['text'].replace('j += 3','j += 2');entry['sha256']=hashlib.sha256(entry['text'].encode()).hexdigest()
        with self.assertRaisesRegex(ValueError,'src/Logger/Logger.cpp:1410:1: unsupported/mutated'):
            self.recipe(fixture)
    def test_malformed_pin_object_policy_provenance_and_random_records_fail(self):
        mutations=[
            lambda f:f.update(sourceCommit='0'*40),
            lambda f:f['implementationSources'].update({'src/Scene/Biome/Biome.h':'0'*64}),
            lambda f:f['objects'][0].update(id=2),
            lambda f:f['objects'][0].update(propertiesText='COLLISION: 0'),
            lambda f:f['sourceRecipe']['biome'].update(firstLine=224),
            lambda f:f['goalPolicy'].update(terrain=0),
            lambda f:f['goalPolicy'].update(seed=False),
            lambda f:f['goalPolicy']['panoramas']['front'].update(sha256='0'*64),
            lambda f:f['randomCalls'][0].update(endpointTokens=['-0.65f','-0.57f']),
            lambda f:f['randomCalls'][0].update(portedBits=3205929214),
            lambda f:f['randomCalls'][0].update(sourceLine=1511),
            lambda f:f['randomCalls'][0].update(unitValue=float('nan')),
            lambda f:f['objects'][0].update(sizePx=[float('nan'),1]),
            lambda f:f['randomCalls'].reverse(),
            lambda f:f['randomCalls'].pop(),
            lambda f:f['randomCalls'].append(copy.deepcopy(f['randomCalls'][0])),
        ]
        for index,mutate in enumerate(mutations):
            with self.subTest(index=index):
                fixture=copy.deepcopy(FIXTURE);mutate(fixture)
                with self.assertRaisesRegex(ValueError,r':\d+:1:'):
                    self.recipe(fixture)
    def test_repeated_materialization_has_no_mutable_output_alias_or_rng_state(self):
        first=self.recipe();before=copy.deepcopy(FIXTURE);first['definitions'][0]['offsetX']=100
        self.assertNotEqual(self.recipe()['definitions'][0]['offsetX'],100)
        self.assertEqual(FIXTURE,before)

if __name__=='__main__':unittest.main()
