import configparser
import datetime as dt
import json
import os
from pathlib import Path
import socket
import stat
import subprocess
import sys
import tempfile
import unittest


HERE = Path(__file__).parent.resolve()


class ServiceTest(unittest.TestCase):
    def test_package_stages_with_private_paths_and_activation_units(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            subprocess.run(['sh', str(HERE/'install.sh'), '--stage', tmp], check=True)
            self.assertEqual((HERE/'collector.py').read_bytes(),
                             (root/'usr/local/lib/interiors-analytics/collector.py').read_bytes())
            cfg = root/'etc/interiors-analytics/service.env'
            self.assertEqual(0o600, stat.S_IMODE(cfg.stat().st_mode))
            self.assertEqual(0o700, stat.S_IMODE(cfg.parent.stat().st_mode))
            values = dict(line.split('=', 1) for line in cfg.read_text().splitlines() if line and not line.startswith('#'))
            self.assertNotIn('INTERIORS_CID_KEY_HEX', values)
            self.assertEqual('114493478', values['INTERIORS_MP_AGGREGATE_COUNTER_ID'])
            self.assertNotIn('INTERIORS_MP_PRIMARY_TOKEN', values)
            self.assertEqual('', values['INTERIORS_MP_AGGREGATE_TOKEN'])
            self.assertEqual('0', values['INTERIORS_PRODUCT_METRICS_ENABLED'])
            cfg.write_text('existing credential file must survive\n')
            subprocess.run(['sh', str(HERE/'install.sh'), '--stage', tmp], check=True)
            self.assertEqual('existing credential file must survive\n', cfg.read_text())

            def unit(suffix, section):
                parser = configparser.ConfigParser(interpolation=None)
                with (root/('etc/systemd/system/interiors-analytics' + suffix)).open() as src:
                    parser.read_file(src)
                return parser[section]

            installer = (HERE/'install.sh').read_text()
            self.assertIn('systemctl restart interiors-analytics.service', installer)
            self.assertIn('systemctl enable --now interiors-analytics-daily.timer', installer)
            self.assertIn('systemctl enable --now interiors-analytics.socket', installer)
            sock = unit('.socket','Socket')
            self.assertEqual('/run/interiors-analytics/collect.sock', sock['ListenStream'])
            self.assertEqual('www-data', sock['SocketGroup'])
            self.assertEqual('0660', sock['SocketMode'])
            for suffix, action in [('.service','serve'), ('-daily.service','daily'), ('-intraday.service','intraday')]:
                svc = unit(suffix, 'Service')
                self.assertEqual('interiors-analytics', svc['User'])
                self.assertEqual('interiors-analytics', svc['StateDirectory'])
                self.assertEqual('0700', svc['StateDirectoryMode'])
                self.assertEqual('/etc/interiors-analytics/service.env', svc['EnvironmentFile'])
                self.assertEqual(set(svc['UnsetEnvironment'].split()), {'INTERIORS_CID_KEY_HEX','INTERIORS_MP_PRIMARY_TOKEN'})
                self.assertEqual('/usr/bin/python3 -B /usr/local/lib/interiors-analytics/collector.py ' + action,
                                 svc['ExecStart'])
            timer = unit('-daily.timer','Timer')
            self.assertIn('Europe/Moscow', timer['OnCalendar'])
            self.assertEqual('true', timer['Persistent'])
            intraday = unit('-intraday.timer', 'Timer')
            self.assertEqual('*-*-* *:05:00 Europe/Moscow', intraday['OnCalendar'])
            self.assertEqual('true', intraday['Persistent'])
            self.assertNotIn('systemctl enable --now interiors-analytics-intraday.timer', installer)

    def test_private_cli_fails_clearly_without_activation_or_storage(self):
        with tempfile.TemporaryDirectory() as tmp:
            def run(action, path):
                env = dict(os.environ, PYTHONDONTWRITEBYTECODE='1', INTERIORS_ANALYTICS_DB=str(path),
                           INTERIORS_MP_AGGREGATE_TOKEN='', LISTEN_PID='0')
                return subprocess.run([sys.executable, str(HERE/'collector.py'), action],
                                      env=env, capture_output=True, text=True)
            self.assertIn('socket', run('serve', Path(tmp)/'db').stderr)
            self.assertIn('storage', run('report', Path(tmp)).stderr)
            result = run('daily', Path(tmp)/'db')
            self.assertIn(result.returncode, (0, 1))
            self.assertIn(result.stdout.strip(), ('before-start','expired','unconfigured'))
            self.assertEqual('',result.stderr)

    def test_real_activated_process_health_increment_and_private_report(self):
        with tempfile.TemporaryDirectory() as tmp, socket.socket(socket.AF_UNIX) as listener:
            path = str(Path(tmp)/'stats.sock')
            listener.bind(path)
            listener.listen()
            env = dict(os.environ, INTERIORS_ANALYTICS_DB=str(Path(tmp)/'db'), PYTHONDONTWRITEBYTECODE='1')
            fd = listener.fileno()
            activate = (
                'import os, sys; os.dup2(int(sys.argv[1]), 3); os.set_inheritable(3,True); '
                'os.environ.update(LISTEN_PID=str(os.getpid()), LISTEN_FDS="1"); '
                'os.execv(sys.executable,[sys.executable,sys.argv[2],"serve"])'
            )
            proc = subprocess.Popen([sys.executable, '-c', activate, str(fd), str(HERE/'collector.py')],
                                    env=env, pass_fds=[fd], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            try:
                study_open = dt.datetime.now(dt.timezone.utc) < dt.datetime(2027,4,1,tzinfo=dt.timezone(dt.timedelta(hours=3)))
                for method, route, status in [('GET','/health',b'204 No Content'), ('POST','/stats/tma-open',b'404 Not Found'), ('POST','/stats/tma-open-v2',b'204 No Content'), ('POST','/stats/tma-repeat-v2',b'204 No Content' if study_open else b'403 Forbidden')]:
                    with socket.socket(socket.AF_UNIX) as client:
                        client.settimeout(5)
                        client.connect(path)
                        request = f'{method} {route} HTTP/1.0\r\nHost: localhost\r\nContent-Length: 0\r\n\r\n'
                        client.sendall(request.encode())
                        self.assertIn(status, client.recv(512))
                result = subprocess.run([sys.executable, str(HERE/'collector.py'), 'report'], env=env,
                                        capture_output=True, check=True)
                self.assertEqual(1, json.loads(result.stdout)['tma_opens'])
                self.assertEqual(int(study_open), json.loads(result.stdout)['tma_repeat_opens'])
                product = subprocess.run([sys.executable, str(HERE/'collector.py'), 'report-product',
                                          '--day', '2026-11-25'], env=env, capture_output=True, check=True)
                self.assertEqual(json.loads(product.stdout), {"day": "2026-11-25", "reports": []})
            finally:
                proc.terminate()
                stdout, stderr = proc.communicate(timeout=5)
            self.assertEqual(b'', stdout)
            self.assertEqual(b'', stderr)


if __name__ == '__main__':
    unittest.main()
