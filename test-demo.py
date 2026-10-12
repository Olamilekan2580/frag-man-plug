"""Local shopping and admin regression checks: python3 test-demo.py."""
from pathlib import Path
import json
import os
import threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright

os.chdir(Path(__file__).parent)
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),QuietHandler)
threading.Thread(target=server.serve_forever,daemon=True).start()
BASE=f'http://127.0.0.1:{server.server_port}'
errors=[]
results=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':1440,'height':1000})
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    page.emulate_media(reduced_motion='reduce')
    page.goto(BASE,wait_until='domcontentloaded')
    page.locator('#featuredGrid .card').first.wait_for()
    assert page.locator('#shopGrid .card').count()==24
    page.locator('#loadMore').click()
    assert page.locator('#shopGrid .card').count()==48
    page.locator('#shopSearch').fill('Hawas')
    assert page.locator('#shopGrid .card').count()==22
    page.locator('#shopSearch').fill('no-such-scent')
    assert page.locator('#clearFilters').is_visible()
    page.locator('#clearFilters').click()
    assert page.locator('#shopGrid .card').count()==24
    page.locator('#shopSearch').fill('Lattafa Asad')
    page.locator('[data-view="lattafa-asad"]').last.click()
    page.locator('#pmSizes [data-size="10ml"]').click()
    page.locator('#pmAdd').click()
    assert page.locator('#drawerWrap').is_visible()
    assert page.locator('#cartCount').inner_text()=='1'
    page.locator('[data-delta="1"]').click()
    assert page.locator('#cartCount').inner_text()=='2'
    page.reload(wait_until='domcontentloaded')
    assert page.locator('#cartCount').inner_text()=='2'
    page.locator('#cartBtn').click()
    page.locator('#checkoutBtn').click()
    page.locator('[name="customer"]').fill('Demo Customer')
    page.locator('[name="email"]').fill('demo@example.com')
    page.locator('[name="state"]').select_option(label='Florida')
    page.locator('#checkoutForm [type="submit"]').click()
    assert page.locator('#checkoutSuccess').is_visible()
    assert page.locator('#cartCount').inner_text()=='0'
    orders=page.evaluate("JSON.parse(localStorage.getItem('fmp_demo_orders'))")
    assert len(orders)==1 and 'email' not in orders[0]
    page.locator('#checkoutSuccess [data-close]').click()
    page.locator('#mixSearch').fill('Asad')
    page.locator('#mixBase [data-id="lattafa-asad"]').click()
    page.locator('#mixSearch').fill('Hawas Ice')
    page.locator('#mixAccent .mix-pick').first.click()
    page.locator('#mixAdd').click()
    assert page.locator('#cartCount').inner_text()=='1'
    page.goto(BASE+'/admin.html?tab=orders',wait_until='domcontentloaded')
    assert page.locator('#orderRows').inner_text().find(orders[0]['id'])>=0
    page.locator('[data-tab="products"]').click()
    page.locator('#adminSearch').fill('Lattafa Asad')
    row=page.locator('[data-row="lattafa-asad"]')
    price=row.locator('[data-size="3ml"]')
    price.fill('12.50'); price.press('Tab')
    row.locator('[data-stock]').click()
    page.goto(BASE,wait_until='domcontentloaded')
    page.locator('#shopSearch').fill('Lattafa Asad')
    page.locator('#shopGrid [data-view="lattafa-asad"]').click()
    assert page.locator('#pmAdd').is_disabled()
    assert page.locator('#pmSizes [data-size="3ml"]').inner_text().find('$12.50')>=0
    page.keyboard.press('Escape')
    assert page.locator('#productModal').is_hidden()
    results.append('Catalog, cart persistence/quantity, checkout, hybrid, admin price/stock: PASS')
    page.evaluate('localStorage.clear()')
    for width in [320,375,390,480,768,820,1024,1440,1920]:
        page.set_viewport_size({'width':width,'height':900})
        page.goto(BASE,wait_until='domcontentloaded')
        page.wait_for_timeout(150)
        if not page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'):
            print(page.evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth,els:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1 && !e.closest('.filters,.marquee')).map(e=>({tag:e.tagName,id:e.id,cls:e.className,right:e.getBoundingClientRect().right,w:e.getBoundingClientRect().width})).slice(-30)})"))
            raise AssertionError(f'Overflow at {width}')
        if width in [390,1440]:page.screenshot(path=f'/tmp/frag-after-{width}.png')
        if width==390:
            page.locator('#burger').click()
            assert page.locator('#burger').get_attribute('aria-expanded')=='true'
            page.locator('#navLinks a[href="#shop"]').first.click()
            assert page.locator('#burger').get_attribute('aria-expanded')=='false'
            page.locator('#featuredGrid [data-view]').first.click()
            assert page.locator('#pmAdd').is_visible()
            page.screenshot(path='/tmp/frag-product-mobile.png')
            page.keyboard.press('Escape')
        page.goto(BASE+'/admin.html',wait_until='domcontentloaded')
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), f'Admin overflow at {width}'
    results.append('Storefront/admin overflow checks at 9 widths, mobile menu/dialog: PASS')
    page.goto(BASE,wait_until='domcontentloaded')
    images=page.evaluate("[...new Set(PRODUCTS.map(p=>brandImg(p)))].concat(['images/hero-flatlay.webp'])")
    for path in images:assert page.request.get(BASE+'/'+path).ok,path
    results.append(f'All {len(images)} representative image assets: PASS')
    assert not errors,errors
    browser.close()
print(json.dumps({'results':results,'console_errors':errors},indent=2))
