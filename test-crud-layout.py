"""Product CRUD and vertical containment regression tests, static and Node modes."""
import json,os,subprocess,tempfile,threading
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
os.chdir(Path(__file__).parent)
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
static=ThreadingHTTPServer(('127.0.0.1',0),Quiet)
threading.Thread(target=static.serve_forever,daemon=True).start()
errors=[];reports=[]
with tempfile.TemporaryDirectory(prefix='fmp-ui-') as database:
    process=subprocess.Popen(['node','server.mjs'],env={**os.environ,'PORT':'0','DATA_DIR':database,'ADMIN_PASSWORD':'test-owner-password-123'},stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True)
    try:
        node_port=int(process.stdout.readline().strip().split()[-1])
        with sync_playwright() as p:
            browser=p.chromium.launch()
            for mode,base in [('browser',f'http://127.0.0.1:{static.server_port}'),('server',f'http://127.0.0.1:{node_port}')]:
                context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
                page=context.new_page();page.emulate_media(reduced_motion='reduce');page.on('pageerror',lambda e:errors.append(str(e)))
                page.goto(base+'/admin.html',wait_until='domcontentloaded')
                if mode=='server':
                    page.locator('#ownerPassword').fill('test-owner-password-123');page.locator('#ownerLoginSubmit').click();page.locator('#ownerLogin').wait_for(state='hidden')
                page.locator('#newProduct').click()
                form=page.locator('#productForm')
                form.locator('[name=name]').fill('   ');form.locator('[name=brand]').fill('Discovery House')
                for size,price in [('3ml','8.50'),('5ml','13'),('10ml','24')]:form.locator(f'[name="{size}"]').fill(price)
                page.locator('#productSave').click();assert 'blank' in page.locator('#productError').inner_text()
                form.locator('[name=name]').fill('CRUD Test Fragrance');form.locator('[name=blurb]').fill('A product created through the complete editor.')
                form.locator('[name=upload]').set_input_files('images/brand-lattafa.webp')
                page.wait_for_function("document.querySelector('[name=image]').value.length>0")
                page.locator('#productSave').click();page.locator('#productEditor').wait_for(state='hidden')
                page.locator('#adminSearch').fill('CRUD Test Fragrance');assert page.locator('#productRows tr').count()==1
                row=page.locator('#productRows tr');pid=row.get_attribute('data-row')
                row.locator('[data-product-action=view]').first.click();assert form.locator('[name=name]').is_disabled();page.locator('#productEditFromView').click()
                form.locator('[name=name]').fill('Updated CRUD Fragrance');form.locator('[name="3ml"]').fill('10.25');page.locator('#productSave').click();page.locator('#productEditor').wait_for(state='hidden')
                page.goto(base,wait_until='domcontentloaded');page.locator('#shopSearch').fill('Updated CRUD Fragrance');assert page.locator('#shopGrid .card').count()==1
                page.locator('#shopGrid [data-view]').click();assert '$10.25' in page.locator('#pmSizes [data-size="3ml"]').inner_text();page.keyboard.press('Escape')
                if mode=='server':
                    visitor=browser.new_context();vp=visitor.new_page();vp.goto(base,wait_until='domcontentloaded');vp.locator('#shopSearch').fill('Updated CRUD Fragrance');assert vp.locator('#shopGrid .card').count()==1
                    vp.locator('#shopGrid [data-view]').click();vp.locator('#pmAdd').click();vp.locator('#checkoutBtn').click();vp.locator('[name=customer]').fill('Demo Customer');vp.locator('[name=email]').fill('demo@example.com');vp.locator('[name=state]').select_option(label='Florida');vp.locator('#checkoutForm [type=submit]').click();vp.locator('#checkoutSuccess').wait_for(state='visible');visitor.close()
                    page.goto(base+'/admin.html?tab=orders',wait_until='domcontentloaded');page.wait_for_function("ORDERS.some(o=>o.id.startsWith('DEMO-'))")
                    with page.expect_response(lambda r:'/api/orders/' in r.url and r.request.method=='PATCH') as response:page.locator('.order-status').first.select_option('Shipped')
                    assert response.value.json()['status']=='Shipped'
                    page.locator('[data-delete-order]').first.click();page.locator('#cancelOrderDelete').click();assert page.locator('[data-delete-order]').count()==1
                    page.locator('[data-delete-order]').first.click();page.locator('#confirmOrderDelete').click();page.locator('#deleteOrderDialog').wait_for(state='hidden');assert page.locator('[data-delete-order]').count()==0
                page.goto(base+'/admin.html',wait_until='domcontentloaded');page.locator('#adminSearch').fill('Updated CRUD Fragrance');row=page.locator('#productRows tr')
                row.locator('[data-product-action=delete]').click();page.locator('#cancelDelete').click();assert page.locator('#productRows tr').count()==1
                row.locator('[data-product-action=delete]').click();page.locator('#confirmDelete').click();page.locator('#deleteProductDialog').wait_for(state='hidden');assert page.locator('#productRows tr[data-row]').count()==0
                page.goto(base,wait_until='domcontentloaded');page.locator('#shopSearch').fill('Updated CRUD Fragrance');assert page.locator('#shopGrid .card').count()==0
                reports.append(mode+': create/read/edit/image upload/delete/cancel + storefront propagation PASS')
                print(reports[-1],flush=True)
                context.close()
            for width in [320,375,390,480,600,768,820,1024,1440,1920]:
                page=browser.new_page(viewport={'width':width,'height':844});page.emulate_media(reduced_motion='reduce');page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f'http://127.0.0.1:{static.server_port}',wait_until='domcontentloaded')
                for section in ['#featured','#shop','#sizes','#mix','.perks','#soon','#story','#discovery','#faq','.footer']:
                    page.locator(section).scroll_into_view_if_needed();page.wait_for_timeout(20)
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),f'Width overflow {width} {section}'
                assert page.evaluate("['mixBase','mixAccent'].every(id=>{const el=document.getElementById(id);return el.scrollHeight>el.clientHeight && ['auto','scroll'].includes(getComputedStyle(el).overflowY);})"),f'Uncontained lists at {width}'
                overlaps=page.evaluate("""()=>{const problems=[];for(const selector of ['.mix-builder','.soon-grid','.perks-inner','.values','.story-stats','.faq-list','.footer-inner','.guide-grid']){const box=document.querySelector(selector);const els=[...box.children].filter(e=>e.getClientRects().length);for(let i=0;i<els.length;i++)for(let j=i+1;j<els.length;j++){const a=els[i].getBoundingClientRect(),b=els[j].getBoundingClientRect();if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2)problems.push(selector+' '+i+'/'+j);}}return problems;}""")
                assert not overlaps,f'Group overlap at {width}: {overlaps}'
                for question in page.locator('.faq-q').all():
                    question.click();assert page.evaluate("[...document.querySelectorAll('.faq-item.open .faq-a')].every(el=>el.scrollHeight<=el.clientHeight+1)")
                if width==390:
                    for section,name in [('#mix','mobile-mix-fixed'),('#soon','mobile-soon-fixed'),('#story','mobile-story-fixed'),('.footer','mobile-footer-fixed')]:
                        page.locator(section).scroll_into_view_if_needed();page.screenshot(path=f'/home/olamihacks/frag-man-plug/previews/{name}.png')
                page.close()
                print(f'Layout {width}px PASS',flush=True)
            reports.append('10 viewport widths: all sections, scrolling list containment, group overlaps, expanded FAQ PASS')
            assert not errors,errors
            browser.close()
    finally:
        process.terminate();process.wait(timeout=10)
print(json.dumps({'results':reports,'page_errors':errors},indent=2))
