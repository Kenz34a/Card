"""Account/admin UI integration tests. Every test runs its own temporary SQLite server."""
import os
import re
import secrets
import subprocess
import tempfile
import unittest
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]


class OnlineBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), args=['--no-sandbox'])
        Path('/tmp/linh-thu-screenshots').mkdir(exist_ok=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='linh-thu-ui-')
        self.server_env = {**os.environ, 'PORT': '0', 'GAME_DATA_DIR': self.temp.name}
        self.server = subprocess.Popen(['node', 'server.mjs'], cwd=ROOT, env=self.server_env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        line = self.server.stdout.readline()
        match = re.search(r'port (\d+)', line)
        if not match:
            raise RuntimeError('Test server failed to start: ' + self.server.stderr.read(2000))
        self.url = 'http://127.0.0.1:' + match.group(1)
        self.contexts = []
        self.errors = []
        self.page = self.new_page()
        self.password = secrets.token_urlsafe(24)

    def tearDown(self):
        for context in self.contexts:
            context.close()
        self.server.terminate()
        self.server.wait(timeout=10)
        self.server.stdout.close()
        self.server.stderr.close()
        self.temp.cleanup()
        self.assertEqual(self.errors, [])

    def new_page(self):
        context = self.browser.new_context(viewport={'width': 1440, 'height': 1000})
        self.contexts.append(context)
        page = context.new_page()
        page.on('pageerror', lambda error: self.errors.append(str(error)))
        page.goto(self.url, wait_until='networkidle')
        return page

    def register(self, page, username, display=None):
        page.locator('[data-action="auth"]').click()
        page.locator('[data-action="auth-tab"][data-mode="register"]').click()
        form = page.locator('[data-form="auth"]')
        form.locator('[name="username"]').fill(username)
        form.locator('[name="displayName"]').fill(display or username)
        form.locator('[name="password"]').fill(self.password)
        form.locator('[type="submit"]').click()
        expect(page.locator('.profile-button')).to_be_visible()
        expect(page.locator('[data-form="auth"]')).to_have_count(0)

    def profile(self, page):
        response = page.request.get(self.url + '/api/me')
        self.assertEqual(response.status, 200)
        return response.json()

    def owner(self):
        self.register(self.page, 'owner', 'Quản trị viên')
        result = subprocess.run(['node', 'scripts/admin.mjs', 'owner'], cwd=ROOT, env=self.server_env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.page.reload(wait_until='networkidle')
        expect(self.page.locator('.nav-item[data-page="admin"]')).to_be_visible()
        self.page.locator('.nav-item[data-page="admin"]').click()
        expect(self.page.locator('.admin-table')).to_be_visible()

    def manage(self, username):
        form = self.page.locator('[data-form="admin-search"]')
        form.locator('[name="search"]').fill(username)
        form.locator('[type="submit"]').click()
        expect(self.page.locator('.admin-table tbody tr')).to_have_count(1)
        self.page.get_by_role('button', name='Quản lý ' + username, exact=True).click()
        expect(self.page.locator('.admin-user-modal')).to_be_visible()

    def test_01_register_login_persistence_logout_and_account_isolation(self):
        self.register(self.page, 'alice', '<img src=x onerror=alert(1)>')
        expect(self.page.locator('.profile-button strong')).to_have_text('<img src=x onerror=alert(1)>')
        expect(self.page.locator('.profile-button img')).to_have_count(0)
        self.page.locator('.hero [data-action="buy-pack"]').click()
        expect(self.page.locator('.reveal-card')).to_have_count(5)
        self.assertEqual(self.profile(self.page)['profile']['coins'], 1050)
        self.page.reload(wait_until='networkidle')
        expect(self.page.locator('.profile-button')).to_be_visible()
        self.assertEqual(self.profile(self.page)['profile']['coins'], 1050)
        other = self.new_page()
        self.register(other, 'bobby')
        self.assertEqual(self.profile(other)['profile']['coins'], 1200)
        self.page.locator('[data-action="account"]').click()
        self.page.locator('[data-action="logout"]').click()
        expect(self.page.locator('[data-action="auth"]')).to_be_visible()
        self.page.locator('[data-action="auth"]').click()
        self.page.locator('[name="username"]').fill('alice')
        self.page.locator('[name="password"]').fill(self.password)
        self.page.locator('[data-form="auth"] [type="submit"]').click()
        expect(self.page.locator('.profile-button')).to_be_visible()
        self.assertEqual(self.profile(self.page)['profile']['coins'], 1050)

    def test_02_admin_resources_audit_ban_unban_and_mobile(self):
        self.owner()
        player = self.new_page()
        self.register(player, 'alice', 'Người chơi Alice')
        self.manage('alice')
        form = self.page.locator('[data-form="admin-gold"]')
        form.locator('[name="amount"]').fill('750')
        form.get_by_role('button', name='Thêm vàng').click()
        expect(self.page.locator('.admin-user-stats')).to_contain_text('1.950')
        self.assertEqual(self.profile(player)['profile']['coins'], 1950)
        form = self.page.locator('[data-form="admin-cards"]')
        form.locator('[name="cardId"]').select_option('nature-12')
        form.locator('[name="quantity"]').fill('2')
        form.get_by_role('button', name='Cấp thẻ').click()
        expect(self.page.locator('#toast')).to_contain_text('Đã cập nhật')
        self.assertEqual(self.profile(player)['profile']['collection']['nature-12'], 2)
        self.page.locator('.modal-close').click()
        expect(self.page.locator('.admin-audit')).to_contain_text('Cấp 2 bản sao Cổ Long Thiên Mộc')
        self.page.screenshot(path='/tmp/linh-thu-screenshots/admin.png', full_page=True)
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.page.wait_for_timeout(250)
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth > innerWidth'))
        self.page.screenshot(path='/tmp/linh-thu-screenshots/admin-mobile.png', full_page=True)
        self.page.set_viewport_size({'width': 1440, 'height': 1000})
        self.page.get_by_role('button', name='Quản lý alice', exact=True).click()
        self.page.get_by_role('button', name='Khóa tài khoản', exact=True).click()
        self.page.locator('[data-action="admin-execute"]').click()
        expect(self.page.locator('.admin-user-modal')).to_contain_text('Đang bị khóa')
        self.assertEqual(player.request.get(self.url + '/api/me').status, 401)
        self.page.get_by_role('button', name='Mở khóa tài khoản', exact=True).click()
        self.page.locator('[data-action="admin-execute"]').click()
        expect(self.page.locator('.admin-user-modal')).to_contain_text('Đang hoạt động')
        self.assertEqual(player.request.post(self.url + '/api/auth/login', data={'username': 'alice', 'password': self.password}).status, 200)

    def test_03_online_deck_battle_turns_and_server_reward(self):
        self.register(self.page, 'alice')
        self.page.locator('.nav-item[data-page="deck"]').click()
        self.page.locator('[data-action="remove-deck"][data-id="fire-0"]').click()
        expect(self.page.locator('.deck-panel h3')).to_contain_text('19/20')
        self.assertEqual(len(self.profile(self.page)['profile']['deck']), 19)
        self.page.locator('[data-action="add-deck"][data-id="fire-0"]').click()
        expect(self.page.locator('.deck-panel h3')).to_contain_text('20/20')
        self.page.locator('[data-action="start-menu"]').click()
        self.page.locator('[data-action="new-battle"][data-mode="ai"]').click()
        expect(self.page.locator('.arena')).to_be_visible()
        for _ in range(2):
            playable = self.page.locator('.hand-card.playable .game-card')
            if playable.count():
                previous = len(self.profile(self.page)['profile']['battle']['players'][0]['hand'])
                playable.first.click()
                self.page.wait_for_function('n => document.querySelectorAll(".hand-card").length !== n', arg=previous)
            self.page.locator('[data-action="end-turn"]').click()
            expect(self.page.locator('[data-action="end-turn"]')).to_be_enabled(timeout=15000)
        self.assertGreaterEqual(self.profile(self.page)['profile']['battle']['round'], 3)
        self.page.locator('[data-action="surrender"]').click()
        self.page.locator('[data-action="confirm-surrender"]').click()
        expect(self.page.locator('.battle-result')).to_be_visible()
        self.assertEqual(self.profile(self.page)['profile']['coins'], 1240)
        self.page.reload(wait_until='networkidle')
        expect(self.page.locator('.profile-button')).to_be_visible()
        self.assertEqual(self.profile(self.page)['profile']['coins'], 1240)

    def test_04_player_cannot_forge_role_or_resources_in_local_storage(self):
        self.register(self.page, 'alice')
        self.page.evaluate('''() => localStorage.setItem('linh-thu-save-v1', JSON.stringify({version:1, coins:9999999, collection:{}, deck:[], role:'admin'}))''')
        self.page.reload(wait_until='networkidle')
        expect(self.page.locator('.profile-button')).to_be_visible()
        expect(self.page.locator('.nav-item[data-page="admin"]')).to_have_count(0)
        response = self.page.request.get(self.url + '/api/admin/users')
        self.assertEqual(response.status, 403)
        account = self.profile(self.page)
        self.assertEqual(account['user']['role'], 'player')
        self.assertEqual(account['profile']['coins'], 1200)


if __name__ == '__main__':
    unittest.main(verbosity=2)
