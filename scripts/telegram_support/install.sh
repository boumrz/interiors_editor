#!/bin/sh
# Install one complete support release. Activation is an explicit operator step.
set -eu
src=$(CDPATH='' cd "$(dirname "$0")" && pwd)
root=''
stage=0
if [ "$#" -eq 2 ] && [ "$1" = '--stage' ] && [ -d "$2" ]; then
    root=$(CDPATH='' cd "$2" && pwd)
    if [ "$root" = '/' ]; then
        exit 2
    fi
    stage=1
elif [ "$#" -ne 0 ] || [ "$(id -u)" != 0 ]; then
    echo 'Run as root, or use install.sh --stage EXISTING_DIRECTORY.' >&2
    exit 2
fi

account='interiors-telegram-support'
lib="$root/usr/local/lib/$account"
units="$root/etc/systemd/system"
conf="$root/etc/interiors-editor/telegram-support"
state="$root/var/lib/$account"
install -d -m 0755 "$lib" "$units"
install -d -m 0700 "$conf"
if [ "$stage" -eq 0 ]; then
    if ! id "$account" >/dev/null 2>&1; then
        useradd --system --user-group --home-dir /nonexistent --shell /usr/sbin/nologin "$account"
    fi
    install -d -m 0700 -o "$account" -g "$account" "$state"
    if [ ! -e "$state/poll.lock" ]; then
        install -m 0600 -o "$account" -g "$account" /dev/null "$state/poll.lock"
    fi
else
    install -d -m 0700 "$state"
fi

release=$(mktemp -d "$lib/release.XXXXXX")
chmod 0755 "$release"
for file in service.py support.py telegram_api.py; do
    install -m 0644 "$src/$file" "$release/$file"
done
python3 -B - "$lib" "$(basename "$release")" <<'PY'
import os
from pathlib import Path
import sys

library = Path(sys.argv[1])
release = sys.argv[2]
temporary = library / f".{release}"
temporary.symlink_to(release)
os.replace(temporary, library / "current")
PY

unit='interiors-telegram-support.service'
install -m 0644 "$src/$unit" "$units/$unit.new"
mv -f "$units/$unit.new" "$units/$unit"
if [ "$stage" -eq 0 ]; then
    systemctl daemon-reload
fi
