"""Catalog graph and provenance errors are rejected before asset loading."""
import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch

SPEC=importlib.util.spec_from_file_location('catalog_index',Path(__file__).with_name('build-catalog.py'))
catalog=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(catalog)

class CatalogIndexTests(unittest.TestCase):
    def changed(self,suffix,mutate):
        read=Path.read_text
        def intercepted(path,*args,**kwargs):
            text=read(path,*args,**kwargs)
            if path.as_posix().endswith(suffix):
                value=json.loads(text);mutate(value);return json.dumps(value)
            return text
        return patch.object(Path,'read_text',intercepted)

    def test_complete_graph_and_explicit_goal_adaptations(self):
        data=catalog.build_catalog();entries=data['entries']
        self.assertEqual([e['id'] for e in entries],list(range(1,17)))
        self.assertEqual(entries[0]['links'],{'left':2,'right':3,'sequential':2})
        self.assertEqual([e['links'] for e in entries[10:15]],
                         [{'left':16,'right':16,'sequential':i+1} for i in range(11,16)])
        self.assertEqual([e['id'] for e in entries if not e['hasCheckpoint']],[1,16])
        self.assertEqual([e['id'] for e in entries if e['terminal']],[16])
        self.assertEqual(entries[-1]['links'],{'left':-1,'right':-1,'sequential':-1})
        self.assertEqual(data['goalPolicy']['terrainProfile'],'goal-terrain-defaults-v1')

    def test_broken_last_stage_edge_and_goal_checkpoint_are_rejected(self):
        with self.changed('/biomes/map15.json',lambda d:d['links'].update(left=17)):
            with self.assertRaisesRegex(ValueError,'map15.json:1:1: source graph mismatch'):catalog.build_catalog()
        with self.changed('/biomes/goal.json',lambda d:d.update(checkpointLine=0)):
            with self.assertRaisesRegex(ValueError,'goal.json:1:1: checkpoint semantics mismatch'):catalog.build_catalog()

    def test_boolean_seed_and_stale_fixture_provenance_are_rejected(self):
        with self.changed('/fixtures/goal-source.json',lambda d:d['goalPolicy'].update(seed=False)):
            with self.assertRaisesRegex(ValueError,'integer policy fields'):catalog.build_catalog()
        with self.changed('/fixtures/goal-source.json',lambda d:d['implementationSources'].update({'src/Game/Game.cpp':'0'*64})):
            with self.assertRaisesRegex(ValueError,'goal fixture changed since'):catalog.build_catalog()

if __name__=='__main__':unittest.main()
