"""Merchant setup and storefront browser checks. No external provider calls."""
import os,subprocess,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
os.chdir(Path(__file__).parent)
with tempfile.TemporaryDirectory(prefix='vega-platform-ui-') as data:
    process=subprocess.Popen(['node','--import','./test-platform-provider-fixture.mjs','server.mjs'],env={**os.environ,'PORT':'0','HOST':'127.0.0.1','DATA_DIR':data,'ADMIN_PASSWORD':'platform-test-owner-password','PLATFORM_SECRET_KEY':'ab'*32},stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    try:
        base='http://127.0.0.1:'+process.stdout.readline().strip().split()[-1]
        with sync_playwright() as pw:
            browser=pw.chromium.launch();context=browser.new_context(viewport={'width':390,'height':844});page=context.new_page();page.set_default_timeout(90000);page.set_default_navigation_timeout(90000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(base+'/platform.html',wait_until='domcontentloaded')
            f=page.locator('#signup');f.locator('[name=name]').fill('Browser Merchant');f.locator('[name=email]').fill('browser@example.com');f.locator('[name=password]').fill('a-private-browser-password');f.locator('button').click();page.locator('#dashboard').wait_for(state='visible')
            f=page.locator('#newStore');f.locator('[name=name]').fill('Browser Shop');f.locator('[name=slug]').fill('browser-shop');f.locator('button').click();page.locator('#editor').wait_for(state='visible')
            f=page.locator('#product');f.locator('[name=name]').fill('Browser Product');f.locator('[name=description]').fill('A product created through the dashboard.');f.locator('[name=price]').fill('29.95');f.locator('button[type=button]').count();f.locator('button').first.click();page.locator('#products .row').wait_for();assert '$29.95' in page.locator('#products').inner_text()
            page.locator('[data-edit]').click();page.locator('#product [name=price]').fill('32.50');page.locator('#product button').first.click();page.wait_for_function("document.getElementById('products').textContent.includes('$32.50')")
            page.locator('#settings [name=description]').fill('A storefront built by its own merchant.');page.locator('#settings [name=published]').check();page.locator('#settings button').click();page.locator('#storeLink').wait_for(state='visible')
            guest=browser.new_context();shop=guest.new_page();shop.set_default_timeout(90000);shop.goto(base+'/shops/browser-shop',wait_until='domcontentloaded');shop.locator('#shopProducts article').wait_for();assert shop.locator('#shopName').inner_text()=='Browser Shop';assert '$32.50' in shop.locator('#shopProducts').inner_text();assert 'checkout is not available' in shop.locator('#shopStatus').inner_text()
            for width in [320,390,768,1440]:
                page.set_viewport_size({'width':width,'height':900});shop.set_viewport_size({'width':width,'height':900});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width;assert shop.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
            page.locator('#logout').click();page.locator('#account').wait_for(state='visible');f=page.locator('#login');f.locator('[name=email]').fill('browser@example.com');f.locator('[name=password]').fill('a-private-browser-password');f.locator('button').click();page.locator('#dashboard').wait_for(state='visible');page.locator('#stores button').click();page.locator('#editor').wait_for(state='visible');assert '$32.50' in page.locator('#products').inner_text();
            page.locator('#cjConnection [name=apiKey]').fill('private-cj-browser-key');page.locator('#cjConnection button').first.click();page.wait_for_function("document.getElementById('connectionStatus').textContent.includes('CJ: Saved')");assert page.locator('#cjConnection [name=apiKey]').input_value()==''
            page.locator('[data-verify=cj]').click();page.wait_for_function("document.getElementById('connectionStatus').textContent.includes('CJ: Read access checked')")
            form=page.locator('#paymentConnection');form.locator('[name=secret]').fill('FLWSECK_TEST-browser-secret');form.locator('[name=webhookSecret]').fill('private-browser-webhook');form.locator('button').first.click();page.wait_for_function("document.getElementById('connectionStatus').textContent.includes('FLUTTERWAVE: Saved')");assert form.locator('[name=secret]').input_value()==''
            page.locator('[data-verify=flutterwave]').click();page.wait_for_function("document.getElementById('connectionStatus').textContent.includes('FLUTTERWAVE: Read access checked')")
            page.locator('#supplierSearch [name=query]').fill('shirt');page.locator('#supplierSearch button').click();page.locator('#supplierResults button').wait_for();page.locator('#supplierResults button').click();page.wait_for_function("document.getElementById('products').textContent.includes('Supplier Test Shirt')");assert page.locator('#products .row').count()==2;assert 'Hidden' in page.locator('#products').inner_text()
            page.locator('#products .row').filter(has_text='Supplier Test Shirt').locator('[data-edit]').click();assert page.locator('#product [name=price]').is_disabled();page.locator('#product [name=description]').fill('Reviewed supplier description.');page.locator('#product button').first.click();page.wait_for_function("document.getElementById('message').textContent==='Product saved.'")
            shop.reload(wait_until='domcontentloaded');shop.locator('#shopProducts article').wait_for();assert shop.locator('#shopProducts article').count()==1
            for width in [320,390,768,1440]:
                page.set_viewport_size({'width':width,'height':900});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
            assert not errors,errors
            browser.close();print('PASS: signup, store creation, branding, product create/edit, publishing, guest storefront, logout/login and private connections, mocked read checks, hidden CJ import, preserved supplier options and four responsive widths; no browser errors.')
    finally:
        process.terminate();process.wait(timeout=10)
