"""Real storefront checkout against mocked providers. No purchases or emails."""
import json,os,subprocess,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
os.chdir(Path(__file__).parent)
with tempfile.TemporaryDirectory(prefix='vega-sales-ui-') as data:
    env={**os.environ,'PORT':'0','DATA_DIR':data,'ADMIN_PASSWORD':'test-owner-password-123','FLW_SECRET_KEY':'FLWSECK_TEST-fixture-X','FLW_SECRET_HASH':'fixture-hash','FLW_MODE':'test','FLW_USD_APPROVED':'true','CJ_API_KEY':'fixture','RESEND_API_KEY':'fixture','EMAIL_FROM':'store@example.com','SITE_URL':'https://shop.example.com','DURABLE_STORAGE_CONFIRMED':'true'}
    # HTTPS site is validated by production code; rewrite callback in the browser fixture.
    process=subprocess.Popen(['node','--import','./test-sales-fixture.mjs','server.mjs'],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    try:
        port=int(process.stdout.readline().strip().split()[-1]);base=f'http://127.0.0.1:{port}'
        with sync_playwright() as pw:
            browser=pw.chromium.launch();context=browser.new_context(viewport={'width':390,'height':844});page=context.new_page();page.set_default_timeout(90000);page.set_default_navigation_timeout(90000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(base+'/admin.html?tab=sales',wait_until='domcontentloaded');page.locator('#ownerPassword').fill('test-owner-password-123');page.locator('#ownerLoginSubmit').click();page.locator('#ownerLogin').wait_for(state='hidden')
            page.locator('#salesConnections .connection').first.wait_for()
            assert page.locator('#salesConnections .connection').count()==9
            headers={'Origin':base}
            def api(path,body):
                response=context.request.post(base+path,headers=headers,data=body);assert response.ok,(response.status,response.text());return response.json()
            product=api('/api/products',{'name':'Linen Everyday Shirt','brand':'VEGArance','category':'Fashion','blurb':'A reviewed, supplier-backed product for the test checkout.','image':'images/brand-lattafa.webp','inStock':True,'saleReady':True,'supplier':{'provider':'cj','productId':'CJ-shirt'},'variants':[{'id':'shirt-medium','label':'Ivory / Medium','sku':'SHIRT-M','inStock':True}],'prices':{'shirt-medium':75}})
            api('/api/suppliers/cj/sync',{})
            import time
            for _ in range(30):
                current=context.request.get(base+'/api/products/'+product['id']).json()
                if current.get('supplierSync',{}).get('status')=='synced':break
                time.sleep(.2)
            cfg={'enabled':True,'businessName':'VEGArance Test','supportEmail':'support@example.com','shippingPolicy':'Test shipping policy: US delivery after three processing days.','returnPolicy':'Test return policy: contact support before returning approved items.','privacyPolicy':'Test privacy policy: order details go to the fulfillment supplier.','terms':'Test terms of sale: secure checkout and supplier-backed products.','taxReviewed':True,'taxRates':{'FL':6},'processingDays':3}
            response=context.request.put(base+'/api/sales',headers=headers,data=cfg);assert response.ok,response.text()
            page.route('https://checkout.flutterwave.com/**',lambda route:route.fulfill(content_type='text/html',body='<h1>Mock hosted payment</h1>'))
            page.goto(base,wait_until='domcontentloaded');assert page.locator('#shopGrid .card').count()==1
            assert page.locator('#mix').is_hidden();assert 'preview price' not in page.locator('#shopGrid').inner_text()
            page.locator('#shopGrid [data-view]').click();assert page.locator('#pmSizes [data-size="shirt-medium"]').is_visible();page.locator('#pmAdd').click();page.locator('#checkoutBtn').click()
            form=page.locator('#checkoutForm')
            for key,value in {'name':'Test Customer','email':'customer@example.com','phone':'3055551234','line1':'123 Test Street','city':'Miami','zip':'33101'}.items():form.locator(f'[name={key}]').fill(value)
            form.locator('[name=state]').select_option('FL');page.locator('#getShipping').click();page.locator('.shipping-option').wait_for();assert '$87.98' in page.locator('#checkoutSummary').inner_text()
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            page.screenshot(path='/tmp/vegarance-checkout-mobile.png')
            form.locator('[name=consent]').check();form.locator('[type=submit]').click();page.wait_for_url('https://checkout.flutterwave.com/**')
            orders=context.request.get(base+'/api/sales/orders').json();assert len(orders)==1 and orders[0]['paymentStatus']=='unpaid';token=orders[0]['token']
            page.goto(base+'/order.html?token='+token+'&status=successful',wait_until='domcontentloaded');page.locator('.order-status').wait_for();assert page.locator('.order-status').inner_text()=='Paid';assert '$87.98' in page.locator('#orderResult').inner_text()
            assert 'No supplier purchase' in page.locator('#orderResult').inner_text();assert page.evaluate("JSON.parse(localStorage.getItem('vegarance_cart')).length")==0
            page.screenshot(path='/tmp/vegarance-order-mobile.png')
            for width in [320,390,768,1440]:
                page.set_viewport_size({'width':width,'height':900});page.goto(base,wait_until='domcontentloaded');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
                page.goto(base+'/policies.html?section=returns',wait_until='domcontentloaded');page.wait_for_function("document.getElementById('policyText').textContent.startsWith('Test return')");assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
            page.goto(base+'/admin.html?tab=sales',wait_until='domcontentloaded');page.locator('.live-order').wait_for();assert page.locator('[data-sales-action=dispatch]').count()==0;assert page.locator('[data-sales-action=fund]').count()==0;assert page.locator('[data-sales-action=refund]').count()==1
            assert not errors,errors
            browser.close()
            print('PASS: owner connection dashboard, approved catalog, live checkout UI, CJ shipping, tax, Flutterwave redirect, verified payment, cart clearing, test-order purchase block, policies and responsive layout; no browser errors.')
    finally:
        process.terminate();process.wait(timeout=10)
