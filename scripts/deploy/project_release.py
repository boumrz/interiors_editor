"""Activate the catalog and both frontend targets from one verified CI commit."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import re
import shutil
import signal
import tarfile
import tempfile

from catalog_activate import active_catalog
from frontend import activate_release


COMPONENT_LIMITS = {"frontend.tar.gz": 300 * 1024**2, "catalog.tar.gz": 200 * 1024**2}


def unpack_components(archive, destination):
    """Only two regular files may cross the deployment boundary."""
    with tarfile.open(archive, "r:") as package:
        members = {}
        for member in package:
            limit = COMPONENT_LIMITS.get(member.name)
            if (not limit or member.name in members or member.type != tarfile.REGTYPE
                    or not 0 < member.size <= limit):
                raise ValueError("Unexpected project deployment archive member")
            members[member.name] = member
        if members.keys() != COMPONENT_LIMITS.keys():
            raise ValueError("Project deployment requires both verified components")
        for name, member in members.items():
            with package.extractfile(member) as source, (destination / name).open("xb") as output:
                shutil.copyfileobj(source, output)


def activate_project(archive, commit, root=Path("/opt/interiors-editor/frontend"),
                     site=Path("/etc/nginx/sites-available/interiors-editor.conf")):
    if not re.fullmatch(r"[a-f0-9]{40}", commit):
        raise ValueError("Expected full source commit SHA")
    # The frontend lock also supports its standalone administratively invoked
    # command. This outer lock serializes the complete restricted SSH protocol.
    with (root / ".project-deploy.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        with tempfile.TemporaryDirectory(prefix="components-", dir=Path(archive).parent) as temporary:
            components = Path(temporary)
            unpack_components(archive, components)
            with active_catalog(components / "catalog.tar.gz", commit) as catalog:
                return activate_release(components / "frontend.tar.gz", root, site,
                                        expected_commit=commit, catalog_receipt=catalog)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", required=True, type=Path)
    parser.add_argument("--commit", required=True)
    arguments = parser.parse_args()
    if os.geteuid() != 0:
        raise PermissionError("Project activation requires the installed deployment service")

    def interrupted(signum, _frame):
        raise InterruptedError("Deployment interrupted by signal " + str(signum))

    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    print(json.dumps(activate_project(arguments.archive, arguments.commit)))


if __name__ == "__main__":
    main()
