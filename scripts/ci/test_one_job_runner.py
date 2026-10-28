"""Offline policy and lifecycle checks. No API writes, downloads, runner or engine execution."""
import contextlib
import hashlib
import importlib.util
import io
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import types
import unittest
from unittest.mock import patch

MODULE_PATH = Path(__file__).with_name('one_job_runner.py')
spec = importlib.util.spec_from_file_location('one_job_runner', MODULE_PATH)
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)
SHA = 'a' * 40
LABEL = 'outrun-pr-7-{}-run-123-1'.format(SHA)

class TrustTests(unittest.TestCase):
    def setUp(self):
        self.args=types.SimpleNamespace(pr=7,sha=SHA,run_id=123,job_id=456)
        self.responses={
            'repos/'+runner.REPO+'/pulls/7': {'state':'open','head':{'repo':{'full_name':runner.REPO},'sha':SHA},'base':{'ref':'develop'}},
            'repos/'+runner.REPO+'/actions/runs/123': {'path':runner.WORKFLOW,'head_repository':{'full_name':runner.REPO},'event':'pull_request','head_sha':SHA,'run_attempt':1},
            'repos/'+runner.REPO+'/actions/jobs/456': {'run_id':123,'name':'engine-validation','status':'queued','labels':[LABEL]},
        }
    def check(self):
        with patch.object(runner,'gh_api',side_effect=lambda path,method='GET':self.responses[path]):
            return runner.reviewed_job(self.args)
    def test_exact_candidate_label(self):
        self.assertEqual(self.check(),LABEL)
    def test_fork_head_rejected(self):
        self.responses['repos/'+runner.REPO+'/pulls/7']['head']['repo']['full_name']='outside/fork'
        with self.assertRaisesRegex(RuntimeError,'Forks'):self.check()
    def test_moved_head_rejected(self):
        self.responses['repos/'+runner.REPO+'/pulls/7']['head']['sha']='b'*40
        with self.assertRaisesRegex(RuntimeError,'head moved'):self.check()
    def test_generic_job_cannot_consume_worker(self):
        self.responses['repos/'+runner.REPO+'/actions/jobs/456']['labels']=['self-hosted','gameengine']
        with self.assertRaisesRegex(RuntimeError,'labels'):self.check()
    def test_other_attempt_rejected(self):
        self.responses['repos/'+runner.REPO+'/actions/runs/123']['run_attempt']=2
        with self.assertRaisesRegex(RuntimeError,'labels'):self.check()
    def test_unexpected_workflow_rejected(self):
        self.responses['repos/'+runner.REPO+'/actions/runs/123']['path']='.github/workflows/other.yml'
        with self.assertRaisesRegex(RuntimeError,'workflow path'):self.check()
    def test_unexpected_base_rejected(self):
        self.responses['repos/'+runner.REPO+'/pulls/7']['base']['ref']='unrelated'
        with self.assertRaisesRegex(RuntimeError,'base'):self.check()
    def test_in_progress_job_cannot_get_second_worker(self):
        self.responses['repos/'+runner.REPO+'/actions/jobs/456']['status']='in_progress'
        with self.assertRaisesRegex(RuntimeError,'queued'):self.check()

class BoundaryTests(unittest.TestCase):
    def test_weak_fork_policy_fails_before_scanning_runs(self):
        with patch.object(runner,'gh_api',return_value={'approval_policy':'first_time_contributors'}), patch.object(runner,'pages') as pages:
            with self.assertRaisesRegex(RuntimeError,'all_external_contributors'):runner.require_fork_boundary()
            pages.assert_not_called()
    def test_active_fork_blocks_even_with_strong_policy(self):
        for status in ('queued','in_progress','waiting','pending','requested','unknown_future_status',None):
            with self.subTest(status=status), patch.object(runner,'gh_api',return_value={'approval_policy':'all_external_contributors'}), patch.object(runner,'pages',return_value=[{'status':status,'head_repository':{'full_name':'outside/fork'}}]) as pages:
                with self.assertRaisesRegex(RuntimeError,'external-fork'):runner.require_fork_boundary()
                pages.assert_called_once_with('repos/'+runner.REPO+'/actions/runs?event=pull_request','workflow_runs')
    def test_completed_fork_and_pending_same_repo_do_not_block(self):
        runs=[{'status':'completed','head_repository':{'full_name':'outside/fork'}},
              {'status':'pending','head_repository':{'full_name':runner.REPO}}]
        with patch.object(runner,'gh_api',return_value={'approval_policy':'all_external_contributors'}), patch.object(runner,'pages',return_value=runs):
            runner.require_fork_boundary()
    def test_nonterminal_deleted_head_repository_fails_closed(self):
        with patch.object(runner,'gh_api',return_value={'approval_policy':'all_external_contributors'}), patch.object(runner,'pages',return_value=[{'status':'requested','head_repository':None}]):
            with self.assertRaisesRegex(RuntimeError,'external-fork'):runner.require_fork_boundary()
    def test_auth_environment_not_forwarded(self):
        with patch.dict(os.environ,{'GH_TOKEN':'admin-secret','GITHUB_TOKEN':'job-secret','GAMEENGINE_ACCESS_TOKEN':'engine-secret','GAMEENGINE_ROOT':'/sdk','GAMEENGINE_HOST_WEB':'/wasm.js'}):
            env=runner.child_env()
        self.assertNotIn('GH_TOKEN',env);self.assertNotIn('GITHUB_TOKEN',env)
        self.assertNotIn('GAMEENGINE_ACCESS_TOKEN',env)
        self.assertEqual(env['GAMEENGINE_ROOT'],'/sdk')
    def test_archive_parent_path_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            archive=Path(d)/'bad.tar.gz'
            with tarfile.open(archive,'w:gz') as tar:
                info=tarfile.TarInfo('../escape');info.size=1;tar.addfile(info,io.BytesIO(b'x'))
            dest=Path(d)/'dest';dest.mkdir()
            with self.assertRaisesRegex(RuntimeError,'escapes'):runner.safe_extract(archive,dest)
            self.assertFalse((Path(d)/'escape').exists())
    def test_archive_external_symlink_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            archive=Path(d)/'bad.tar.gz'
            with tarfile.open(archive,'w:gz') as tar:
                info=tarfile.TarInfo('link');info.type=tarfile.SYMTYPE;info.linkname='/outside';tar.addfile(info)
            dest=Path(d)/'dest';dest.mkdir()
            with self.assertRaisesRegex(RuntimeError,'link escapes'):runner.safe_extract(archive,dest)
    def test_official_node_relative_bin_links_extract_and_resolve(self):
        with tempfile.TemporaryDirectory() as d:
            archive=Path(d)/'node-links.tar.gz'
            with tarfile.open(archive,'w:gz') as tar:
                for version in ('node20','node24'):
                    for name,script in [('corepack','corepack/dist/corepack.js'),('npm','npm/bin/npm-cli.js'),('npx','npm/bin/npx-cli.js')]:
                        content=(version+'/'+name).encode()
                        info=tarfile.TarInfo('./externals/'+version+'/lib/node_modules/'+script)
                        info.size=len(content);tar.addfile(info,io.BytesIO(content))
                        info=tarfile.TarInfo('./externals/'+version+'/bin/'+name)
                        info.type=tarfile.SYMTYPE;info.linkname='../lib/node_modules/'+script;tar.addfile(info)
            dest=Path(d)/'dest';dest.mkdir(mode=0o700)
            runner.safe_extract(archive,dest)
            for version in ('node20','node24'):
                for name in ('corepack','npm','npx'):
                    link=dest/'externals'/version/'bin'/name
                    self.assertTrue(link.is_symlink())
                    self.assertEqual(link.read_bytes(),(version+'/'+name).encode())
                    self.assertIn(dest.resolve(),link.resolve().parents)
    def test_archive_relative_symlink_cannot_walk_above_root(self):
        with tempfile.TemporaryDirectory() as d:
            archive=Path(d)/'bad.tar.gz'
            with tarfile.open(archive,'w:gz') as tar:
                info=tarfile.TarInfo('bin/link');info.type=tarfile.SYMTYPE
                info.linkname='../../escaped';tar.addfile(info)
            dest=Path(d)/'dest';dest.mkdir()
            with self.assertRaisesRegex(RuntimeError,'link escapes'):runner.safe_extract(archive,dest)
            self.assertFalse((dest/'bin/link').is_symlink())
    def test_archive_relative_link_resolves_against_existing_symlink_chain(self):
        with tempfile.TemporaryDirectory() as d:
            archive=Path(d)/'bad.tar.gz'
            with tarfile.open(archive,'w:gz') as tar:
                info=tarfile.TarInfo('a');info.type=tarfile.SYMTYPE;info.linkname='.';tar.addfile(info)
                info=tarfile.TarInfo('dir/link');info.type=tarfile.SYMTYPE
                info.linkname='../a/../escaped';tar.addfile(info)
            dest=Path(d)/'dest';dest.mkdir()
            with self.assertRaisesRegex(RuntimeError,'link escapes'):runner.safe_extract(archive,dest)
            self.assertTrue((dest/'a').is_symlink())
            self.assertFalse((dest/'dir/link').is_symlink())
            self.assertFalse((Path(d)/'escaped').exists())
    def test_archive_later_symlink_cannot_redirect_earlier_link_outside(self):
        with tempfile.TemporaryDirectory() as d:
            archive=Path(d)/'bad.tar.gz'
            with tarfile.open(archive,'w:gz') as tar:
                for name,target in [('config.sh','b/../outside-config'),('b','.')]:
                    info=tarfile.TarInfo(name);info.type=tarfile.SYMTYPE
                    info.linkname=target;tar.addfile(info)
            dest=Path(d)/'dest';dest.mkdir(mode=0o700)
            with self.assertRaisesRegex(RuntimeError,'final link escapes'):
                runner.safe_extract(archive,dest)
            self.assertTrue((dest/'config.sh').is_symlink())
            self.assertTrue((dest/'b').is_symlink())
            self.assertEqual((dest/'config.sh').resolve(),(Path(d)/'outside-config').resolve())
            self.assertFalse((Path(d)/'outside-config').exists())
    def test_archive_symlink_chain_cannot_change_parent_resolution(self):
        with tempfile.TemporaryDirectory() as d:
            archive=Path(d)/'bad.tar.gz'
            with tarfile.open(archive,'w:gz') as tar:
                for name,target in [('a','.'),('b','a')]:
                    info=tarfile.TarInfo(name);info.type=tarfile.SYMTYPE;info.linkname=target;tar.addfile(info)
                info=tarfile.TarInfo('b/../escaped');info.size=1;tar.addfile(info,io.BytesIO(b'x'))
            dest=Path(d)/'dest';dest.mkdir()
            with self.assertRaisesRegex(RuntimeError,'path escapes'):runner.safe_extract(archive,dest)
            self.assertTrue((dest/'a').is_symlink()) # Actual extraction, not only a mocked check.
            self.assertTrue((dest/'b').is_symlink())
            self.assertFalse((Path(d)/'escaped').exists())
            self.assertFalse((dest/'escaped').exists())
    def test_archive_absolute_member_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            archive=Path(d)/'bad.tar.gz';outside=Path(d)/'escaped'
            with tarfile.open(archive,'w:gz') as tar:
                info=tarfile.TarInfo(str(outside));info.size=1;tar.addfile(info,io.BytesIO(b'x'))
            dest=Path(d)/'dest';dest.mkdir()
            with self.assertRaisesRegex(RuntimeError,'path escapes'):runner.safe_extract(archive,dest)
            self.assertFalse(outside.exists())
    def test_archive_root_entry_keeps_directory_private(self):
        with tempfile.TemporaryDirectory() as d:
            archive=Path(d)/'root.tar.gz'
            with tarfile.open(archive,'w:gz') as tar:
                info=tarfile.TarInfo('.');info.type=tarfile.DIRTYPE;info.mode=0o777;tar.addfile(info)
            dest=Path(d)/'dest';dest.mkdir(mode=0o700)
            runner.safe_extract(archive,dest)
            self.assertEqual(dest.stat().st_mode & 0o777,0o700)

class LifecycleTests(unittest.TestCase):
    def execute_fake(self, conclusion='success', config_ok=True):
        with tempfile.TemporaryDirectory() as d:
            base=Path(d);cache=base/'cache';cache.mkdir()
            archive=cache/'actions-runner-osx-arm64-2.338.0.tar.gz'
            with tarfile.open(archive,'w:gz') as tar:
                for name in ('config.sh','run.sh'):
                    content=b'not executed';info=tarfile.TarInfo(name);info.size=len(content);tar.addfile(info,io.BytesIO(content))
            app={'filename':archive.name,'sha256_checksum':hashlib.sha256(archive.read_bytes()).hexdigest()}
            args=types.SimpleNamespace(cache=cache,run_id=123,job_id=456,timeout=20)
            directory=base/'worker';directory.mkdir()
            calls=[];removed=[];configured=[]
            name='outrun-123-fixed'
            def api(path,method='GET'):
                calls.append((method,path))
                if path.endswith('registration-token'):return {'token':'registration-secret'}
                if '/actions/jobs/' in path:return {'status':'completed','conclusion':conclusion}
                if method=='DELETE':removed.append(44);return None
                raise AssertionError('Unexpected API '+path)
            def configure(argv,**kwargs):
                configured.append((list(argv),dict(kwargs['env'])))
                (directory/'.credentials').write_text('temporary credentials')
                return subprocess.CompletedProcess(argv,0 if config_ok else 1,'hidden output','')
            fake_process=types.SimpleNamespace(pid=999999,returncode=0,poll=lambda:0,communicate=lambda timeout:('hidden output',None))
            def pages(path,key):return [] if removed else [{'id':44,'name':name}]
            with patch.object(runner.tempfile,'mkdtemp',return_value=str(directory)), patch.object(runner.secrets,'token_hex',return_value='fixed'), patch.object(runner,'reviewed_job',return_value=LABEL), patch.object(runner,'require_fork_boundary'), patch.object(runner,'gh_api',side_effect=api), patch.object(runner,'pages',side_effect=pages), patch.object(runner.subprocess,'run',side_effect=configure), patch.object(runner.subprocess,'Popen',return_value=fake_process), contextlib.redirect_stdout(io.StringIO()) as output:
                if conclusion=='success' and config_ok:
                    self.assertEqual(runner.execute(args,app,LABEL),0)
                else:
                    with self.assertRaises(RuntimeError):runner.execute(args,app,LABEL)
            self.assertFalse(directory.exists())
            self.assertEqual(removed,[44])
            argv,env=configured[0]
            self.assertNotIn('registration-secret',argv)
            self.assertEqual(env['ACTIONS_RUNNER_INPUT_TOKEN'],'registration-secret')
            self.assertNotIn('registration-secret',output.getvalue())
            self.assertIn('--ephemeral',argv);self.assertIn('--no-default-labels',argv)
            self.assertEqual(argv[argv.index('--labels')+1],LABEL)
            self.assertEqual(env['HOME'],str(directory/'home'))
            return calls
    def test_success_cleans_registration_and_credentials(self):self.execute_fake()
    def test_failed_game_job_still_cleans(self):self.execute_fake(conclusion='failure')
    def test_configuration_failure_still_cleans_partial_registration(self):self.execute_fake(config_ok=False)

class WorkflowTests(unittest.TestCase):
    def test_aggregator_requires_actual_success(self):
        text=(MODULE_PATH.parents[2]/'.github/workflows/engine-validation.yml').read_text()
        self.assertIn('if: always()\n    needs: [trust, engine-validation]',text)
        self.assertIn('"$TRUST_RESULT" != success',text);self.assertIn('"$ENGINE_RESULT" != success',text)
        self.assertIn('outrun-pr-${number}-${expected}-run-${context.runId}-${process.env.GITHUB_RUN_ATTEMPT}',text)
        self.assertIn('GAMEENGINE_HOST_WEB: ${{ vars.GAMEENGINE_HOST_WEB }}',text)

if __name__=='__main__':unittest.main()
