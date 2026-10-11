import {test,expect} from '@playwright/test';
test('Backup sign-in dialog handles email, code, errors, reset and mobile keyboard',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/e2e/fixtures/backup-preview.html');await page.getByRole('button',{name:'Open backup sign in'}).click();
 const modal=page.getByRole('dialog');await expect(modal.getByLabel('Backup email',{exact:true})).toBeFocused();
 await modal.getByLabel('Backup email',{exact:true}).fill('member@example.com');await modal.getByRole('button',{name:'Send verification code'}).click();
 await expect(modal.getByRole('heading',{name:'Check your inbox.'})).toBeVisible();await expect(modal.getByText('Enter the six-digit code sent to member@example.com.')).toBeVisible();
 await modal.getByLabel('Email verification code').fill('999999');await modal.getByRole('button',{name:'Sign in',exact:true}).click();await expect(modal.getByRole('alert')).toBeVisible();await expect(modal.getByLabel('Email verification code')).toHaveAttribute('aria-invalid','true');
 await modal.getByRole('button',{name:'Use another email / resend'}).click();await expect(modal.getByLabel('Backup email',{exact:true})).toHaveValue('member@example.com');await expect(modal.getByRole('alert')).toHaveCount(0);
 await page.setViewportSize({width:390,height:844});expect(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);await page.screenshot({path:'test-results/backup-email-mobile.png'});
 await page.keyboard.press('Escape');await expect(modal).toHaveCount(0);await expect(page.getByRole('button',{name:'Open backup sign in'})).toBeFocused();
 expect(errors).toEqual([]);
});
