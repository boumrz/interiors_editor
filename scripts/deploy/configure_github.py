#!/usr/bin/env python3
"""One-time setup using the owner's existing SSH and GitHub CLI credentials."""
import argparse
import json
from pathlib import Path
import re
import shlex
import shutil
import subprocess
import tempfile


def run(arguments, **kwargs):
    return subprocess.run(arguments, check=True, **kwargs)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--admin-key", type=Path, default=Path.home() / ".ssh/interiors_editor_server_20261108_ed25519")
    arguments = parser.parse_args()
    for command in ("gh", "ssh", "ssh-keygen"):
        if not shutil.which(command):
            raise SystemExit(f"Required command is missing: {command}")
    if not arguments.admin_key.is_file():
        raise SystemExit("Existing administrator SSH key is missing")
    repository, host = "boumrz/interiors_editor", "147.45.133.75"
    run(["gh", "auth", "status"])
    # Read only the owner's previously trusted host key. Never trust a CI keyscan.
    hosts = run(["ssh-keygen", "-F", host], capture_output=True, text=True).stdout
    hosts = "\n".join(line for line in hosts.splitlines() if line and not line.startswith("#")) + "\n"
    if not hosts.strip():
        raise SystemExit("Trusted SSH host key is missing; establish verified administrator SSH first")
    ssh = ["ssh", "-o", "BatchMode=yes", "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=yes",
           "-o", "ConnectTimeout=15", "-i", str(arguments.admin_key), f"root@{host}"]
    run(ssh + ["test -L /opt/interiors-editor/frontend/current && nginx -t && systemctl is-active nginx interiors-catalog"])
    script_root = Path(__file__).resolve().parent
    with tempfile.TemporaryDirectory(prefix="interiors-github-key-") as directory:
        key = Path(directory) / "deploy_ed25519"
        run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-C", "interiors-github-frontend", "-f", str(key)])
        scripts = ("frontend.py", "receiver.py", "project_release.py", "catalog_activate.py", "catalog_package.py")
        source = json.dumps({name: (script_root / name).read_text() for name in scripts}).encode()
        # Stage the complete administrative code together. A running receiver
        # uses its resolved version, even if a later setup switches the entry.
        install = r'''
import hashlib, json, os, pathlib, shutil, sys, tempfile
root = pathlib.Path('/opt/interiors-editor/deploy')
root.mkdir(mode=0o700, exist_ok=True)
if root.is_symlink() or root.stat().st_uid != 0 or root.stat().st_mode & 0o022:
    raise SystemExit('Deployment directory must be owned and writable only by root')
payload = sys.stdin.buffer.read()
sources = json.loads(payload)
if set(sources) != {'frontend.py', 'receiver.py', 'project_release.py', 'catalog_activate.py', 'catalog_package.py'}:
    raise SystemExit('Unexpected deployment modules')
version = root / ('tools-' + hashlib.sha256(payload).hexdigest())
with tempfile.TemporaryDirectory(dir=root) as scratch:
    stage = pathlib.Path(scratch) / 'modules'
    stage.mkdir(mode=0o700)
    for name, content in sources.items():
        compile(content, name, 'exec')
        (stage / name).write_bytes(content.encode())
    if not version.exists():
        os.rename(stage, version)
    if version.is_symlink() or any((version / name).is_symlink() or (version / name).read_bytes() != content.encode() for name, content in sources.items()):
        raise SystemExit('Installed deployment modules differ from reviewed bytes')
    entry = pathlib.Path(scratch) / 'receiver'
    entry.symlink_to(version / 'receiver.py')
    os.replace(entry, root / 'receiver.py')
'''
        run(ssh + ["python3 -c " + shlex.quote(install)], input=source)
        public_key = key.with_suffix(".pub").read_text().strip()
        if not re.fullmatch(r"ssh-ed25519 [A-Za-z0-9+/=]+ interiors-github-frontend", public_key):
            raise SystemExit("Unexpected generated public key")
        install_key = '''
import os, pathlib, sys, tempfile
key = sys.stdin.read().strip()
directory = pathlib.Path('/root/.ssh')
directory.mkdir(mode=0o700, exist_ok=True)
path = directory / 'authorized_keys'
if directory.is_symlink() or path.is_symlink():
    raise SystemExit('Refusing symlinked authorized_keys')
entry = 'restrict,command="/usr/bin/python3 /opt/interiors-editor/deploy/receiver.py" ' + key
previous = path.read_text() if path.exists() else ''
if entry not in previous.splitlines():
    fd, temporary = tempfile.mkstemp(prefix='.authorized_keys-', dir=directory)
    with os.fdopen(fd, 'w') as output:
        output.write(previous.rstrip('\\n') + '\\n' + entry + '\\n')
    os.chmod(temporary, 0o600)
    os.replace(temporary, path)
'''
        # Send the generated key as stdin; the command contains only fixed code.
        run(ssh + ["python3 -c " + shlex.quote(install_key)], input=public_key.encode())
        restricted = ["ssh", "-o", "BatchMode=yes", "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=yes",
                      "-o", "ConnectTimeout=15", "-i", str(key), f"root@{host}", "forbidden-shell"]
        check = subprocess.run(restricted, capture_output=True, text=True)
        if check.returncode != 1 or "Only the bounded project deploy protocol" not in check.stderr:
            raise SystemExit("Restricted deploy-key check failed; no GitHub secrets were written")
        environments = run(["gh", "api", f"repos/{repository}/environments", "--paginate",
                            "--jq", ".environments[].name"], capture_output=True, text=True)
        if "production" not in (environments.stdout or "").splitlines():
            run(["gh", "api", f"repos/{repository}/environments/production", "--method", "PUT"], stdout=subprocess.DEVNULL)
        for name, data in (("DEPLOY_SSH_PRIVATE_KEY", key.read_bytes()), ("DEPLOY_SSH_KNOWN_HOSTS", hosts.encode())):
            run(["gh", "secret", "set", name, "--repo", repository, "--env", "production"], input=data)
    print("Production deployment receiver and GitHub environment secrets configured.")
    print("Project deployment starts on the next successful main push.")


if __name__ == "__main__":
    main()
