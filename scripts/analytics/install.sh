#!/bin/sh
# Update the collector and socket-activated units; credentials remain operator-managed.
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

if [ "$stage" -eq 0 ]; then
    getent group www-data >/dev/null
    if ! id interiors-analytics >/dev/null 2>&1; then
        useradd --system --user-group --home-dir /nonexistent --shell /usr/sbin/nologin interiors-analytics
    fi
fi

lib="$root/usr/local/lib/interiors-analytics"
units="$root/etc/systemd/system"
conf="$root/etc/interiors-analytics"
install -d -m 0755 "$lib" "$units"
install -d -m 0700 "$conf"
install -m 0644 "$src/collector.py" "$lib/collector.py.new"
mv -f "$lib/collector.py.new" "$lib/collector.py"
for file in interiors-analytics.socket interiors-analytics.service interiors-analytics-daily.service interiors-analytics-daily.timer; do
    install -m 0644 "$src/$file" "$units/$file.new"
    mv -f "$units/$file.new" "$units/$file"
done

python3 - "$conf" <<'PY'
import os
from pathlib import Path
import sys
import tempfile

directory = Path(sys.argv[1])
target = directory / "service.env"
with tempfile.NamedTemporaryFile(dir=directory, mode="w", encoding="ascii") as file:
    file.write("INTERIORS_MP_AGGREGATE_COUNTER_ID=114493478\n")
    file.write("INTERIORS_MP_AGGREGATE_TOKEN=\n")
    file.flush()
    os.fsync(file.fileno())
    try:
        os.link(file.name, target)
    except FileExistsError:
        pass
os.chmod(target, 0o600)
PY

if [ "$stage" -eq 0 ]; then
    chown root:root "$conf" "$conf/service.env"
    systemctl daemon-reload
    systemctl enable --now interiors-analytics.socket
    systemctl restart interiors-analytics.service
    systemctl enable --now interiors-analytics-daily.timer
fi
