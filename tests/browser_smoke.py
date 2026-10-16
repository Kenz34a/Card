"""Functional UI checks. Start `npm run dev` first; requires Python Playwright + Chromium."""
import json
import os
import unittest
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

URL = os.environ.get('GAME_URL', 'http://127.0.0.1:3000')
KEY = 'linh-thu-save-v1'


class GameBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(
            executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'),
            args=['--no-sandbox'],
        )

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1440, 'height': 1000})
        self.page = self.context.new_page()
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.goto(URL, wait_until='networkidle')

    def tearDown(self):
        errors = self.errors[:]
        self.context.close()
        self.assertEqual(errors, [], 'No uncaught browser errors')

    def saved(self):
        return self.page.evaluate(f'JSON.parse(localStorage.getItem("{KEY}"))')

    def nav(self, target):
        self.page.locator(f'.nav-item[data-page="{target}"]').click()

    def action(self, action):
        return self.page.locator(f'[data-action="{action}"]')

    def start_battle(self, mode='ai'):
        self.nav('battle')
        self.action('start-menu').first.click()
        self.page.locator(f'[data-action="new-battle"][data-mode="{mode}"]').click()

    def test_01_home_responsive_and_help(self):
        self.assertEqual(self.page.title(), 'Linh Thú — Đấu trường thẻ bài')
        expect(self.page.locator('.pack-tile')).to_have_count(4)
        out = Path('/tmp/linh-thu-screenshots')
        out.mkdir(exist_ok=True)
        self.page.screenshot(path=str(out / 'desktop.png'), full_page=True)
        for width in [390, 768, 1440]:
            self.page.set_viewport_size({'width': width, 'height': 900})
            self.page.wait_for_timeout(300)
            self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth > innerWidth'), f'No overflow at {width}px')
            if width == 390:
                self.assertLessEqual(self.page.locator('.sidebar').bounding_box()['x'] + 240, 1)
                self.page.screenshot(path=str(out / 'mobile.png'), full_page=True)
                self.action('menu').click()
                self.page.wait_for_timeout(250)
                self.nav('collection')
                expect(self.page.locator('.game-card')).to_have_count(96)
                self.action('menu').click()
                self.nav('home')
        self.action('help').click()
        expect(self.page.get_by_role('dialog')).to_be_visible()
        self.page.keyboard.press('Escape')
        expect(self.page.get_by_role('dialog')).to_have_count(0)

    def test_02_open_pack_flip_and_persist(self):
        self.page.locator('.hero [data-action="buy-pack"]').click()
        save = self.saved()
        self.assertEqual(save['coins'], 1050)
        self.assertEqual(save['packsOpened'], 1)
        self.assertEqual(sum(save['collection'].values()), 25)
        expect(self.page.locator('.reveal-card')).to_have_count(5)
        self.action('flip-all').click()
        expect(self.page.locator('.reveal-card.flipped')).to_have_count(5)
        self.page.wait_for_timeout(800)
        bounds = self.page.locator('.pack-modal').bounding_box()
        for card in self.page.locator('.reveal-card').all():
            box = card.bounding_box()
            self.assertLessEqual(box['x'] + box['width'], bounds['x'] + bounds['width'])
        self.page.screenshot(path='/tmp/linh-thu-screenshots/pack.png', full_page=True)
        self.action('go-collection').click()
        expect(self.page.locator('.collection-grid .game-card')).to_have_count(96)
        self.page.reload(wait_until='networkidle')
        self.assertEqual(self.saved()['coins'], 1050)
        self.assertEqual(sum(self.saved()['collection'].values()), 25)

    def test_03_daily_reward_once_and_insufficient_funds(self):
        self.page.locator('.daily-card [data-action="daily"]').click()
        self.assertEqual(self.saved()['coins'], 1500)
        self.page.locator('.balance').click()
        self.assertEqual(self.saved()['coins'], 1500)
        self.action('sound').click()
        self.assertTrue(self.saved()['sound'])
        self.page.evaluate(f'localStorage.setItem("{KEY}", JSON.stringify({{...JSON.parse(localStorage.getItem("{KEY}")), coins:100}}))')
        self.page.reload(wait_until='networkidle')
        self.page.locator('.hero [data-action="buy-pack"]').click()
        expect(self.page.locator('#toast')).to_contain_text('chưa đủ vàng')
        self.assertEqual(self.saved()['coins'], 100)
        expect(self.page.get_by_role('dialog')).to_have_count(0)

    def test_04_collection_search_filters_and_deck_edit(self):
        self.nav('collection')
        self.page.locator('#card-search').fill('co long thien moc')
        expect(self.page.locator('#collection-grid .game-card')).to_have_count(1)
        self.page.locator('#collection-grid .game-card').click()
        expect(self.page.locator('.card-detail h2')).to_have_text('Cổ Long Thiên Mộc')
        self.action('close-modal').click()
        self.page.locator('#card-search').fill('zzzz')
        expect(self.page.locator('.empty-state')).to_be_visible()
        self.page.locator('#card-search').fill('')
        self.page.locator('[data-element="nature"]').click()
        self.page.locator('#rarity-filter').select_option('legendary')
        expect(self.page.locator('#collection-grid .game-card')).to_have_count(2)
        self.page.locator('#owned-filter').select_option('owned')
        expect(self.page.locator('#collection-grid .game-card')).to_have_count(0)
        self.nav('deck')
        self.page.locator('[data-action="remove-deck"][data-id="fire-0"]').click()
        self.assertEqual(len(self.saved()['deck']), 19)
        self.page.locator('[data-action="add-deck"][data-id="fire-0"]').click()
        self.assertEqual(len(self.saved()['deck']), 20)
        self.page.locator('[data-action="remove-deck"][data-id="water-0"]').click()
        self.page.locator('[data-action="add-deck"][data-id="fire-0"]').click()
        expect(self.page.locator('#toast')).to_contain_text('tối đa 2 bản sao')
        self.assertEqual(len(self.saved()['deck']), 19)
        self.action('reset-deck').click()
        self.action('confirm-reset').click()
        self.assertEqual(len(self.saved()['deck']), 20)

    def test_05_ai_turn_combat_evolution_and_reward_once(self):
        self.page.clock.install()
        self.start_battle()
        expect(self.page.locator('.arena')).to_be_visible()
        self.assertEqual(self.saved()['battle']['turn'], 0)
        for _ in range(4):
            for _ in range(10):
                playable = self.page.locator('.hand-card.playable .game-card')
                if not playable.count():
                    break
                playable.first.click()
            # Evolve an existing unit when there is spare energy.
            units = self.page.locator('.own-board .unit .game-card')
            if units.count():
                units.first.click()
                evolve = self.action('evolve')
                if evolve.count() and evolve.is_enabled():
                    evolve.click()
                if self.action('deselect').count():
                    self.action('deselect').click()
            # Attack one target through the UI when a ready creature exists.
            ready = self.page.locator('.own-board .unit.ready .game-card')
            if ready.count():
                ready.first.click()
                targets = self.page.locator('.enemy-board .unit .game-card')
                if targets.count():
                    targets.first.click()
                else:
                    self.action('attack-hero').click()
            if self.saved()['battle']['winner'] is not None:
                break
            self.action('end-turn').click()
            self.page.clock.run_for(15000)
            self.assertEqual(self.saved()['battle']['turn'], 0)
        self.assertGreaterEqual(self.saved()['battle']['round'], 3)
        self.assertGreater(len(self.saved()['battle']['log']), 5)
        self.page.screenshot(path='/tmp/linh-thu-screenshots/battle.png', full_page=True)
        self.action('surrender').click()
        self.action('confirm-surrender').click()
        save = self.saved()
        self.assertEqual(save['battle']['winner'], 1)
        self.assertEqual(save['coins'], 1240)
        self.assertEqual(save['matches'], 1)
        self.assertTrue(save['battle']['rewarded'])
        self.action('close-modal').click()
        self.nav('home')
        self.nav('battle')
        self.assertEqual(self.saved()['coins'], 1240)
        self.page.reload(wait_until='networkidle')
        self.assertEqual(self.saved()['coins'], 1240)

    def test_06_local_duel_privacy_and_mobile_board(self):
        self.start_battle('local')
        expect(self.page.locator('.pass-screen h2')).to_have_text('Lượt của người chơi 1')
        expect(self.page.locator('.arena')).to_have_class('arena turn-shield')
        self.page.keyboard.press('Escape')
        expect(self.page.locator('.pass-screen')).to_be_visible()
        self.action('accept-turn').click()
        self.action('end-turn').click()
        self.assertEqual(self.saved()['battle']['turn'], 1)
        expect(self.page.locator('.pass-screen h2')).to_have_text('Lượt của người chơi 2')
        self.action('accept-turn').click()
        expect(self.page.locator('.hero-bar.player strong')).to_have_text('Người chơi 2')
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.page.wait_for_timeout(300)
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth > innerWidth'))
        self.page.screenshot(path='/tmp/linh-thu-screenshots/battle-mobile.png', full_page=True)
        self.action('end-turn').click()
        self.action('accept-turn').click()
        self.assertEqual(self.saved()['battle']['turn'], 0)
        self.action('surrender').click()
        self.action('confirm-surrender').click()
        self.assertEqual(self.saved()['coins'], 1260)
        self.assertEqual(self.saved()['battle']['winner'], 1)

    def test_07_saved_local_battle_does_not_block_other_modals(self):
        self.start_battle('local')
        self.action('accept-turn').click()
        self.page.reload(wait_until='networkidle')
        self.action('help').click()
        self.action('close-modal').first.click()
        expect(self.page.get_by_role('dialog')).to_have_count(0)
        self.nav('battle')
        expect(self.page.locator('.pass-screen')).to_be_visible()

    def test_08_lethal_attack_victory_and_saved_reward(self):
        # Resume a deterministic battle one legal attack away from victory.
        self.page.evaluate('''async () => {
            const {createBattle, playCard} = await import('/src/engine.js');
            const {freshState} = await import('/src/state.js');
            const s = freshState();
            const b = createBattle();
            b.players[0].hand = ['lightning-0'];
            playCard(b, 0);
            b.players[1].hp = 2;
            s.battle = b;
            localStorage.setItem('linh-thu-save-v1', JSON.stringify(s));
        }''')
        self.page.reload(wait_until='networkidle')
        self.nav('battle')
        self.page.locator('.own-board .unit.ready .game-card').click()
        self.action('attack-hero').click()
        expect(self.page.locator('.battle-result h2')).to_have_text('Chiến thắng rực rỡ!')
        self.assertEqual(self.saved()['coins'], 1300)
        self.assertEqual(self.saved()['wins'], 1)
        self.assertEqual(self.saved()['battle']['winner'], 0)
        self.action('close-modal').click()
        self.nav('home')
        self.nav('battle')
        self.assertEqual(self.saved()['coins'], 1300)
        self.page.reload(wait_until='networkidle')
        self.assertEqual(self.saved()['coins'], 1300)


if __name__ == '__main__':
    unittest.main(verbosity=2)
