import concurrent.futures
import datetime as dt
import http.client
import io
import json
import socket
import socketserver
import sqlite3
import tempfile
import threading
import unittest
from contextlib import closing, redirect_stderr
from pathlib import Path
from unittest.mock import patch
from urllib.parse import parse_qsl, urlsplit

import collector as c


START = dt.datetime(2026, 11, 22, 20, 59, 59, tzinfo=dt.timezone.utc)
CLOSED = START + dt.timedelta(minutes=6)
ENV = {
    'INTERIORS_AGGREGATE_AUTHORIZED': '1',
    'INTERIORS_CID_KEY_HEX': '53' * 32,
    'INTERIORS_MP_PRIMARY_TOKEN': 'primary-test',
    'INTERIORS_MP_AGGREGATE_TOKEN': 'aggregate-test',
    'INTERIORS_MP_AGGREGATE_COUNTER_ID': '114493478',
}


OPEN = "/stats/tma-open-v2"
MOBILE_OPEN = "/stats/tma-mobile-open-v1"
REPEAT = "/stats/tma-repeat-v2"
CUTOFF = dt.datetime(2027, 3, 31, 21, tzinfo=dt.timezone.utc)

class CollectorTest(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.db = Path(tmp.name) / 'counts.sqlite3'
        self.now = START
        self.store = c.Counts(self.db, lambda: self.now)
        self.store.initialize()
        self.sent = []
        self.sender = lambda counter, token, hits: self.sent.append((counter, token, hits)) or 'sent'
        self.app = c.Analytics(self.store, dict(ENV), self.sender)

    def serve(self):
        path = self.db.parent / 'unix.sock'
        listener = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        listener.bind(str(path))
        listener.listen()
        server = c.Server(listener, self.app)
        self.addCleanup(server.server_close)
        worker = threading.Thread(target=server.serve_forever, kwargs={'poll_interval': 0.02})
        worker.start()
        self.addCleanup(worker.join)
        self.addCleanup(server.shutdown)

        def request(method, route, body=None, headers=None):
            with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
                client.settimeout(4)
                client.connect(str(path))
                body = body or b''
                headers = {'Host':'localhost', 'Content-Length':str(len(body)), **(headers or {})}
                rows = [f'{method} {route} HTTP/1.0', *(f'{k}: {v}' for k, v in headers.items()), '', '']
                client.sendall('\r\n'.join(rows).encode() + body)
                with http.client.HTTPResponse(client) as response:
                    response.begin()
                    return response.status

        return request

    def test_empty_open_and_repeat_increment_independent_totals_without_network(self):
        request = self.serve()
        with concurrent.futures.ThreadPoolExecutor(8) as pool:
            statuses = list(pool.map(lambda route: request('POST', route), [OPEN, REPEAT, OPEN] * 15))
        self.assertEqual(set(statuses), {204})
        self.assertEqual((30, 15), self.store.totals('2026-11-22'))
        self.now += dt.timedelta(seconds=1)
        self.assertEqual(204, request('POST', OPEN))
        self.assertEqual((1, 0), self.store.totals('2026-11-23'))
        self.assertEqual([], self.sent)

    def test_mobile_signals_keep_daily_totals_and_publish_only_full_moscow_intervals(self):
        self.now = dt.datetime.fromisoformat("2026-11-24T21:25:00+03:00")
        request = self.serve()
        self.assertEqual(request('POST', MOBILE_OPEN), 204)
        self.assertEqual(self.store.activate_intraday(), "2026-11-24T22:00:00+03:00")
        self.assertEqual(request('POST', MOBILE_OPEN), 204)
        self.now = dt.datetime.fromisoformat("2026-11-24T22:00:00+03:00")
        with concurrent.futures.ThreadPoolExecutor(8) as pool:
            self.assertEqual(set(pool.map(lambda _: request('POST', MOBILE_OPEN), range(10))), {204})
        self.assertEqual(request('POST', OPEN), 204)
        self.assertEqual(request('POST', REPEAT), 204)
        self.assertEqual(self.store.totals('2026-11-24'), (13, 1))
        self.assertEqual(self.store.intraday_report(dt.date(2026, 11, 24)), [])
        self.now = dt.datetime.fromisoformat("2026-11-25T00:00:00+03:00")
        self.assertEqual(request('POST', MOBILE_OPEN), 204)
        self.assertEqual(self.store.activate_intraday(), "2026-11-24T22:00:00+03:00")
        self.assertEqual(self.store.intraday_report(dt.date(2026, 11, 24)), [
            {'start': "2026-11-24T22:00:00+03:00", 'end':"2026-11-25T00:00:00+03:00",
             'tma_opens_2h': 10, 'state': 'pending'},
        ])
        self.assertEqual(self.store.totals('2026-11-25'), (1, 0))
        self.assertEqual(self.store.intraday_report(dt.date(2026, 11, 25)), [])
        self.now = dt.datetime.fromisoformat("2026-11-25T04:00:00+03:00")
        self.assertEqual([row['tma_opens_2h'] for row in self.store.intraday_report(dt.date(2026, 11, 25))], [1, 0])

    def test_intraday_transport_uses_only_bucket_total_and_keeps_its_own_delivery_ledger(self):
        self.now = dt.datetime.fromisoformat("2026-11-24T21:25:00+03:00")
        self.store.activate_intraday()
        self.now = dt.datetime.fromisoformat("2026-11-24T23:59:59+03:00")
        self.assertTrue(self.app.record(MOBILE_OPEN))
        self.now += dt.timedelta(minutes=5)
        with concurrent.futures.ThreadPoolExecutor(6) as pool:
            list(pool.map(lambda _: self.app.export_intraday(), range(6)))
        self.assertEqual(self.app.export(), 'sent')
        self.assertEqual(len(self.sent), 2)
        intraday, daily = [hits[0] for _, _, hits in self.sent]
        self.assertEqual(intraday['dl'], c.TMA_URL + '/intraday-report')
        self.assertEqual(intraday['t'], 'pageview')
        self.assertNotEqual(intraday['cid'], daily['cid'])
        self.assertEqual(intraday['et'], daily['et'])
        self.assertEqual(json.loads(intraday['params']), {"tma_opens_2h": 1})
        self.assertEqual(json.loads(daily['params']), {"tma_opens": 1, "tma_repeat_opens": 0})
        self.app.export_intraday()
        self.assertEqual(len(self.sent), 2)

    def test_intraday_retries_rejection_but_not_indeterminate_delivery_or_expired_intervals(self):
        self.now = dt.datetime.fromisoformat("2026-11-24T19:15:00+03:00")
        self.store.activate_intraday()
        self.now = dt.datetime.fromisoformat("2026-11-24T22:05:00+03:00")
        statuses = iter(['rejected', 'unknown'])
        attempted = []

        def sending(counter, token, hits):
            attempted.append(hits[0])
            return next(statuses)

        self.app.send = sending
        self.app.export_intraday()
        self.app.export_intraday()
        self.app.export_intraday()
        self.assertEqual(len(attempted), 2)
        self.assertEqual(self.store.intraday_report(dt.date(2026, 11, 24))[0]['state'], 'unknown')
        self.now = dt.datetime.fromisoformat("2026-11-26T00:05:00+03:00")
        self.assertEqual([row['state'] for row in self.store.intraday_report(dt.date(2026, 11, 24))],
                         ['unknown', 'expired'])
        self.app.send = self.sender
        self.app.export_intraday()
        threshold = int((self.now - dt.timedelta(hours=12)).timestamp())
        self.assertEqual(len(self.sent), 6)
        self.assertTrue(all(int(hits[0]['et']) >= threshold for _, _, hits in self.sent))

    def test_old_routes_bodies_and_queries_do_not_contribute(self):
        request = self.serve()
        for path, body in [('/stats/tma-open', b''), ('/stats/tma-return', b'3'*64),
                           ('/stats/tma-return-v2', b'3'*160), (OPEN+'?id=1', b''), (REPEAT+'/', b''),
                           (OPEN,b'x'), (REPEAT,b'3'*64)]:
            self.assertGreaterEqual(request('POST',path,body),400)
        for route in (OPEN, REPEAT):
            self.assertGreaterEqual(request('GET',route),400)
            self.assertGreaterEqual(request('POST',route,headers={'Transfer-Encoding':'chunked'}),400)
        self.assertEqual((0,0),self.store.totals('2026-11-22'))
        self.assertEqual([],self.sent)

    def test_disabled_receivers_and_exact_moscow_study_cutoff(self):
        request = self.serve()
        self.app.env['INTERIORS_AGGREGATE_AUTHORIZED'] = '0'
        self.assertEqual(request('POST',OPEN),403)
        self.assertEqual(request('POST',REPEAT),403)
        self.now = CLOSED
        self.assertEqual(self.app.export(),'disabled')
        self.app.env.pop('INTERIORS_AGGREGATE_AUTHORIZED')
        self.now = CUTOFF - dt.timedelta(microseconds=1)
        self.assertEqual(request('POST',REPEAT),204)
        self.now = CUTOFF
        self.assertEqual(request('POST',REPEAT),403)
        self.assertEqual(request('POST',OPEN),204)
        self.assertEqual((0,1),self.store.totals('2027-03-31'))
        self.assertEqual((1,0),self.store.totals('2027-04-01'))
        self.now = START
        self.app.env['INTERIORS_REPEAT_ENABLED'] = '0'
        self.assertEqual(request('POST',REPEAT),403)
        self.assertEqual(request('POST',OPEN),204)

    def test_existing_database_is_upgraded_reentrantly_without_losing_counts_or_delivery_state(self):
        old = self.db.parent/'v1.db'
        with closing(sqlite3.connect(old)) as db, db:
            db.executescript("CREATE TABLE counts (day TEXT PRIMARY KEY, opens INTEGER NOT NULL);"
                             "CREATE TABLE exports (day TEXT PRIMARY KEY, state TEXT NOT NULL);"
                             "INSERT INTO counts VALUES ('2026-11-22',23);"
                             "INSERT INTO exports VALUES ('2026-11-22','sending');")
        self.store.path = old
        with concurrent.futures.ThreadPoolExecutor(4) as pool:
            list(pool.map(lambda _: self.store.initialize(), range(6)))
        self.assertEqual((23,0),self.store.totals('2026-11-22'))
        request = self.serve()
        self.assertEqual(request('POST', REPEAT), 204)
        self.assertEqual((23,1),self.store.totals('2026-11-22'))
        self.assertEqual(request('POST', MOBILE_OPEN), 204)
        self.assertEqual(self.store.totals('2026-11-22'), (24,1))
        self.now = CLOSED
        self.assertEqual(self.store.intraday_report(dt.date(2026, 11, 22)), [])
        self.assertEqual('sending', self.app.export())
        self.assertEqual([],self.sent)

    def test_day_report_sends_one_shared_service_id_with_both_totals_once(self):
        request = self.serve()
        for route in [OPEN, REPEAT, OPEN]: self.assertEqual(request('POST',route),204)
        self.now = CLOSED
        with concurrent.futures.ThreadPoolExecutor(8) as pool:
            list(pool.map(lambda _:self.app.export(),range(8)))
        self.assertEqual(len(self.sent),1)
        counter,token,hits = self.sent[0]
        self.assertEqual((counter,token),('114493478','aggregate-test'))
        self.assertEqual(len(hits),1)
        self.assertEqual(hits[0],{'cid':c.SERVICE_CID,'t':'pageview','dl':c.TMA_URL+'/daily-report',
                                  'et':str(int(START.timestamp())),
                                  'params':'{"tma_opens":2,"tma_repeat_opens":1}'})
        self.now += dt.timedelta(days=1)
        self.assertEqual(self.app.export(),'sent')
        self.assertEqual(hits[0]['cid'],self.sent[1][2][0]['cid'])
        self.assertEqual('{"tma_opens":0,"tma_repeat_opens":0}',self.sent[1][2][0]['params'])

    def test_release_readiness_needs_storage_and_aggregate_destination_without_sending(self):
        request = self.serve()
        self.assertEqual(request('GET','/health/aggregate-v2'),204)
        self.app.env['INTERIORS_AGGREGATE_AUTHORIZED']='0'
        self.assertEqual(request('GET','/health/aggregate-v2'),503)
        self.app.env['INTERIORS_AGGREGATE_AUTHORIZED']='1'
        self.app.env['INTERIORS_MP_AGGREGATE_TOKEN']=''
        self.assertEqual(request('GET','/health/aggregate-v2'),503)
        self.app.env = dict(ENV)
        self.store.path = self.db.parent
        self.assertEqual(request('GET','/health/aggregate-v2'),503)
        self.assertEqual(request('POST',OPEN),503)
        self.assertEqual(request('POST',REPEAT),503)
        self.assertEqual([],self.sent)

    def test_rejected_methods_log_no_request_data(self):
        request = self.serve()
        errors=io.StringIO()
        with redirect_stderr(errors):
            self.assertEqual(501,request('UNSUPPORTED','/private?client-marker'))
        self.assertEqual(errors.getvalue(),'')

    def test_no_reports_before_start_or_outside_twelve_hour_window(self):
        self.now = START - dt.timedelta(hours=23)
        self.assertEqual('before-start', self.app.export())
        self.now = START + dt.timedelta(hours=12, seconds=1)
        self.assertEqual('expired', self.app.export())
        self.assertEqual([], self.sent)

    def test_report_at_exact_twelve_hour_boundary(self):
        self.now = START + dt.timedelta(hours=12)
        self.assertEqual('sent', self.app.export())
        self.assertEqual(1, len(self.sent))

    def test_wrong_counter_or_missing_token_never_writes_export_claim(self):
        self.now = CLOSED
        for counter, token in [('114486792','other'), ('114493478',''), ('abc','x'), ('0','x')]:
            self.app.env = dict(ENV, INTERIORS_MP_AGGREGATE_COUNTER_ID=counter, INTERIORS_MP_AGGREGATE_TOKEN=token)
            self.assertEqual('unconfigured', self.app.export())
        self.assertEqual([], self.sent)
        self.app.env = dict(ENV)
        self.assertEqual('sent', self.app.export())

    def test_ambiguous_or_crashed_delivery_is_never_replayed(self):
        self.now = CLOSED
        self.app.send = lambda *_: 'unknown'
        self.assertEqual('unknown', self.app.export())
        self.app.send = self.sender
        self.assertEqual('unknown', self.app.export())
        self.now += dt.timedelta(days=1)
        def crash(*_):
            raise RuntimeError('simulated abrupt exit')
        self.app.send = crash
        with self.assertRaises(RuntimeError):
            self.app.export()
        self.app.send = self.sender
        self.assertEqual('sending', self.app.export())
        self.assertEqual([], self.sent)

    def test_definite_rejection_or_preconnect_failure_can_retry(self):
        self.now = CLOSED
        for status in ['rejected', 'offline']:
            self.app.send = lambda *_, status=status: status
            self.assertEqual(status, self.app.export())
        self.app.send = self.sender
        self.assertEqual('sent', self.app.export())
        self.assertEqual(1, len(self.sent))

    def test_https_request_is_new_and_no_redirect_is_followed(self):
        hits = [{'cid':'2','t':'pageview','dl':'https://domiknote.ru/tma'}, {'cid':'2','t':'event','ea':'tma_open'}]
        with patch('collector.http.client.HTTPSConnection') as https:
            conn = https.return_value
            response = conn.getresponse.return_value
            for code, body, outcome in [(200,b'<!-- OK -->','sent'), (200,b'<html>','unknown'),
                                         (400,b'denied','rejected'), (302,b'','unknown'), (500,b'','unknown')]:
                response.status, response.read.return_value = code, body
                self.assertEqual(outcome, c.send_hits('114486792','test +',hits))
            https.assert_called_with('mc.yandex.ru', timeout=4)
            method, path = conn.request.call_args.args
            self.assertEqual('POST', method)
            self.assertEqual('/collect/', urlsplit(path).path)
            self.assertEqual({'tid':'114486792','ms':'test +'}, dict(parse_qsl(urlsplit(path).query)))
            kwargs = conn.request.call_args.kwargs
            self.assertEqual({'Content-Type':'application/x-www-form-urlencoded'}, kwargs['headers'])
            self.assertEqual(hits, [dict(parse_qsl(row)) for row in kwargs['body'].decode().split('\n')])
            conn.request.side_effect = TimeoutError()
            self.assertEqual('unknown', c.send_hits('1','x',hits))
            conn.connect.side_effect = OSError('before HTTP request')
            self.assertEqual('offline', c.send_hits('1','x',hits))


if __name__ == '__main__':
    unittest.main()
