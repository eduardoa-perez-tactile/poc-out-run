"""Coordinator-invoked, reviewed-SHA, one-job GitHub runner. Default is read-only plan.
Never run this from unreviewed PR code. It is not an OS isolation boundary or an autoscaler.
"""
import argparse
import hashlib
import json
import os
import platform
import re
import secrets
import shutil
import signal
import subprocess
import tarfile
import tempfile
import time
import urllib.request
from pathlib import Path, PurePosixPath

REPO = 'eduardoa-perez-tactile/poc-out-run'
WORKFLOW = '.github/workflows/engine-validation.yml'

def gh_api(path, method='GET'):
    r = subprocess.run(['gh','api','--method',method,path], text=True, capture_output=True)
    if r.returncode:
        raise RuntimeError('GitHub API request failed: ' + method + ' ' + path)
    return json.loads(r.stdout) if r.stdout.strip() else None

def require(condition, message):
    if not condition:
        raise RuntimeError(message)

def pages(path, key):
    values = []
    page = 1
    while True:
        separator = '&' if '?' in path else '?'
        batch = gh_api(path + separator + 'per_page=100&page=' + str(page))[key]
        values.extend(batch)
        if len(batch) < 100:
            return values
        page += 1

def require_fork_boundary():
    policy = gh_api('repos/' + REPO + '/actions/permissions/fork-pr-contributor-approval')
    require(policy['approval_policy'] == 'all_external_contributors',
        'Require all_external_contributors approval before registering a developer-Mac runner; never approve external-fork execution')
    # A stricter future policy does not stop an already-approved external run.
    runs = pages('repos/' + REPO + '/actions/runs?event=pull_request','workflow_runs')
    require(not any(r.get('status') != 'completed' and
                    (r.get('head_repository') or {}).get('full_name') != REPO for r in runs),
        'An external-fork workflow is active; do not register the Mac runner')

def reviewed_job(args):
    pr = gh_api('repos/' + REPO + '/pulls/' + str(args.pr))
    require(pr['state'] == 'open', 'PR must be open')
    require(pr['head']['repo']['full_name'] == REPO, 'Forks cannot use this runner')
    require(pr['base']['ref'] in ('develop','main'), 'Unexpected PR base')
    require(pr['head']['sha'] == args.sha, 'PR head moved; review the new head')
    run = gh_api('repos/' + REPO + '/actions/runs/' + str(args.run_id))
    require(run['path'] == WORKFLOW, 'Unexpected workflow path')
    require(run['head_repository']['full_name'] == REPO, 'Unexpected workflow repository')
    require(run['event'] in ('pull_request','workflow_dispatch'), 'Unexpected workflow event')
    # The workflow trust step independently checks the live PR head. Require the API run SHA too.
    require(run['head_sha'] == args.sha, 'Workflow does not target the reviewed head')
    job = gh_api('repos/' + REPO + '/actions/jobs/' + str(args.job_id))
    require(job['run_id'] == args.run_id and job['name'] == 'engine-validation', 'Unexpected job')
    require(job['status'] == 'queued', 'Job must be queued before provisioning a runner')
    label = 'outrun-pr-{}-{}-run-{}-{}'.format(args.pr,args.sha,args.run_id,run['run_attempt'])
    require(job['labels'] == [label], 'Job labels do not match the exact run attempt')
    return label

def safe_extract(archive, directory):
    root = directory.resolve()
    with tarfile.open(archive,'r:gz') as tar:
        for member in tar.getmembers():
            # Reject traversal lexically before resolution: an earlier symlink can change
            # what `a/../file` means. Validate/extract sequentially against the evolving tree.
            member_path = PurePosixPath(member.name)
            require(member.name and not member_path.is_absolute() and '..' not in member_path.parts
                    and '\\' not in member.name, 'Archive path escapes runner directory')
            target = (root/member.name).resolve()
            require(target == root or root in target.parents, 'Archive path escapes runner directory')
            if member.issym() or member.islnk():
                link_path = PurePosixPath(member.linkname)
                require(member.linkname and not link_path.is_absolute()
                        and '\\' not in member.linkname, 'Archive link escapes runner directory')
                # Official Node bin links use ../lib/node_modules/.... Permit parent
                # components only in relative symlink targets, without ever walking
                # lexically above root. Member paths and hardlink paths stay strict.
                if member.issym():
                    parts = list(member_path.parent.parts)
                    for part in link_path.parts:
                        if part == '..':
                            require(parts, 'Archive link escapes runner directory')
                            parts.pop()
                        elif part != '.':
                            parts.append(part)
                    # Resolve from the destination's actual parent, not target.parent:
                    # target may follow an existing final symlink that extract replaces.
                    link = (root/member.name).parent.joinpath(member.linkname).resolve()
                else:
                    require('..' not in link_path.parts, 'Archive link escapes runner directory')
                    link = (root/member.linkname).resolve()
                require(link == root or root in link.parents, 'Archive link escapes runner directory')
            require(member.isfile() or member.isdir() or member.issym() or member.islnk(), 'Archive special entry rejected')
            if target == root:
                require(member.isdir(), 'Archive entry cannot replace runner directory')
                continue # A root-directory entry must not relax our private 0700 permissions.
            member.mode &= 0o755 # Never restore setuid/setgid or group/world write bits.
            tar.extract(member,root)
    # A later symlink can change an earlier link's resolution (b/../target
    # with b initially absent, followed by b -> .). Check the completed tree
    # before config.sh or any other extracted binary can be executed. Do not
    # follow directory symlinks while walking; validate each link itself.
    for parent, directories, files in os.walk(root,followlinks=False):
        for name in directories + files:
            path = Path(parent)/name
            if path.is_symlink():
                try:
                    resolved = path.resolve()
                except (OSError,RuntimeError) as error:
                    raise RuntimeError('Archive final link cannot resolve safely') from error
                require(resolved == root or root in resolved.parents,
                        'Archive final link escapes runner directory')

def child_env():
    # Deliberately do not forward API/admin tokens to the runner or job processes.
    keep = ('PATH','HOME','USER','LOGNAME','SHELL','TMPDIR','LANG','LC_ALL','RUSTUP_TOOLCHAIN')
    env = {key:os.environ[key] for key in keep if key in os.environ}
    for key in ('GAMEENGINE_ROOT','GAMEENGINE_HOST_WEB','GAMEENGINE_HOST','GAMEENGINE_HOST_HERMES',
                'GAMEENGINE_COOK','GAMEENGINE_HERMESC','GAMEENGINE_EMSDK','GAMEENGINE_SDK'):
        if key in os.environ:
            env[key] = os.environ[key]
    return env

def terminate(process):
    if process and process.poll() is None:
        os.killpg(process.pid,signal.SIGTERM)
        try: process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid,signal.SIGKILL)
            process.wait()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pr',type=int,required=True)
    parser.add_argument('--sha',required=True)
    parser.add_argument('--run-id',type=int,required=True)
    parser.add_argument('--job-id',type=int,required=True)
    parser.add_argument('--execute',action='store_true')
    parser.add_argument('--timeout',type=int,default=2100)
    parser.add_argument('--cache',type=Path,default=Path('/tmp/outrun-actions-runner-cache'))
    args = parser.parse_args()
    require(args.pr > 0 and args.run_id > 0 and args.job_id > 0 and args.timeout > 0, 'Positive identifiers and timeout required')
    require(re.fullmatch('[0-9a-f]{40}',args.sha), 'Exact 40-character reviewed SHA required')
    require(platform.system() == 'Darwin' and platform.machine() == 'arm64', 'This helper targets the trusted ARM64 Mac only')
    require_fork_boundary()
    label = reviewed_job(args)
    apps = gh_api('repos/' + REPO + '/actions/runners/downloads')
    app = next(a for a in apps if a['os'] == 'osx' and a['architecture'] == 'arm64')
    require(re.fullmatch('[0-9a-f]{64}',app.get('sha256_checksum','')), 'API package checksum required')
    require(re.fullmatch(r'actions-runner-osx-arm64-[0-9.]+\.tar\.gz',app['filename']), 'Unexpected package filename')
    require(app['download_url'].startswith('https://github.com/actions/runner/releases/download/'), 'Unexpected package origin')
    print(json.dumps({'mode':'execute' if args.execute else 'plan','repo':REPO,'sha':args.sha,'run':args.run_id,'job':args.job_id,'label':label,'package':app['filename'],'ephemeral':True}),flush=True)
    if not args.execute:
        return 0
    lock = Path('/tmp/outrun-engine-ci.lock')
    try:
        lock.mkdir(mode=0o700)
    except FileExistsError:
        raise RuntimeError('Another one-job runner holds /tmp/outrun-engine-ci.lock; inspect its PID before removing a stale lock')
    (lock/'pid').write_text(str(os.getpid()))
    try:
        return execute(args,app,label)
    finally:
        shutil.rmtree(lock)

def execute(args,app,label):
    # No service/launchctl installation. Cache contains only a verified public archive, never credentials.
    args.cache.mkdir(mode=0o700,parents=True,exist_ok=True)
    archive = args.cache/app['filename']
    if not archive.exists() or hashlib.sha256(archive.read_bytes()).hexdigest() != app['sha256_checksum']:
        temp_archive = args.cache/(app['filename']+'.download')
        urllib.request.urlretrieve(app['download_url'],temp_archive)
        require(hashlib.sha256(temp_archive.read_bytes()).hexdigest() == app['sha256_checksum'], 'Runner package checksum mismatch')
        temp_archive.replace(archive)
    runner_dir = Path(tempfile.mkdtemp(prefix='outrun-one-job-'))
    os.chmod(runner_dir,0o700)
    name = 'outrun-{}-{}'.format(args.run_id,secrets.token_hex(6))
    process = None
    cleanup_error = None
    token = ''
    try:
        safe_extract(archive,runner_dir)
        require_fork_boundary()
        reviewed_job(args) # Recheck immediately before registration.
        token = gh_api('repos/' + REPO + '/actions/runners/registration-token','POST')['token']
        env = child_env()
        env['HOME'] = str(runner_dir/'home')
        Path(env['HOME']).mkdir(mode=0o700)
        env['ACTIONS_RUNNER_INPUT_TOKEN'] = token
        # Token is environment-only: absent from command arguments, console and repository.
        result = subprocess.run([str(runner_dir/'config.sh'),'--unattended','--url','https://github.com/'+REPO,
            '--name',name,'--ephemeral','--disableupdate','--no-default-labels','--labels',label,'--work','_work'],
            cwd=runner_dir,env=env,text=True,capture_output=True,timeout=120)
        require(result.returncode == 0,'Runner configuration failed (output suppressed to protect credentials)')
        env.pop('ACTIONS_RUNNER_INPUT_TOKEN',None)
        token = ''
        process = subprocess.Popen([str(runner_dir/'run.sh'),'--once'],cwd=runner_dir,env=env,
            stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,start_new_session=True)
        deadline = time.monotonic()+args.timeout
        while True:
            try:
                output,_ = process.communicate(timeout=min(20,max(1,deadline-time.monotonic())))
                break
            except subprocess.TimeoutExpired:
                require(time.monotonic() < deadline,'One-job runner exceeded its deadline')
                print('Runner active for reviewed job ' + str(args.job_id),flush=True)
        require(process.returncode == 0,'Runner process failed; inspect GitHub job logs')
        for _ in range(15):
            result = gh_api('repos/' + REPO + '/actions/jobs/' + str(args.job_id))
            if result['status'] == 'completed':
                break
            time.sleep(2)
        require(result['status'] == 'completed' and result['conclusion'] == 'success','Exact engine job did not pass')
        print('PASS exact reviewed engine job ' + str(args.job_id),flush=True)
        return 0
    finally:
        terminate(process)
        # config.sh may have registered before a later local error; query our unique name even then.
        try:
            runners = pages('repos/' + REPO + '/actions/runners','runners')
            for runner in runners:
                if runner['name'] == name:
                    gh_api('repos/' + REPO + '/actions/runners/' + str(runner['id']),'DELETE')
            remaining = pages('repos/' + REPO + '/actions/runners','runners')
            require(not any(r['name'] == name for r in remaining),'Runner registration survived cleanup')
        except Exception as error:
            cleanup_error = error
        finally:
            token = ''
            # Includes .credentials, .credentials_rsaparams, .runner, worktree and runner diagnostics.
            shutil.rmtree(runner_dir,ignore_errors=False)
        if cleanup_error:
            raise RuntimeError('Runner credentials removed locally, but GitHub unregister verification failed') from cleanup_error

if __name__ == '__main__':
    def interrupted(_signum,_frame):
        raise RuntimeError('Runner interrupted; removing registration and local credentials')
    signal.signal(signal.SIGTERM,interrupted)
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        raise SystemExit(130)
    except Exception as error:
        # Never print raw child/API output, which could include registration credentials.
        print(str(error),file=__import__('sys').stderr)
        raise SystemExit(1)
