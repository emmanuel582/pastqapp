import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
test('an admin campaign reaches opted-in native devices and inboxes without enabling browser reminders',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'native-campaign-'));process.env.DATA_DIR=root;process.env.NODE_ENV='test';process.env.SESSION_OWNER_HMAC_SECRET='native-admin-test';
 const [admin,push,{sessionOwnerKey},reminders]=await Promise.all([import('../services/admin/notifications.js'),import('../services/notifications/native.js'),import('../services/auth/middleware.js'),import('../services/reminders/store.js')]);
 const originalFetch=globalThis.fetch;let sent=0;globalThis.fetch=async(url,options)=>{assert.match(String(url),/exp.host/);const messages=JSON.parse(options.body);assert.equal(messages.length,1);assert.equal(messages[0].data.owner,'alice');assert.equal(messages[0].data.kind,'inbox');sent++;return new Response(JSON.stringify({data:[{status:'ok',id:'admin-ticket'}]}));};
 try{
  const owner=sessionOwnerKey('alice');push.registerDevice(owner,'alice',{installationId:randomUUID(),secret:randomUUID()+randomUUID(),token:'ExpoPushToken[nativetestalice12345]',platform:'ios'});
  assert.equal(reminders.readSettings(owner).enabled,false);assert.equal(admin.reachable('alice'),true);
  const message=admin.validateMessage({title:'New material',body:'Your new paper is ready.',push:true});const campaign=admin.previewCampaign('admin',message,{mode:'selected',userIds:['alice','bob']},[{id:'alice'},{id:'bob'}]);
  assert.equal(campaign.pushEligible,1);admin.queueCampaign(campaign.id,'admin');await admin.dispatchCampaigns();await admin.dispatchCampaigns();assert.equal(sent,1);assert.equal(admin.inbox('alice').total,1);assert.equal(admin.inbox('bob').total,1);assert.equal(admin.inbox('other').total,0);
  assert.equal(admin.listCampaigns().items[0].nativePush[0].status,'receipt');
 }finally{globalThis.fetch=originalFetch;admin.closeNotificationStore();push.closeNativeStore();reminders.closeReminderStore();fs.rmSync(root,{recursive:true,force:true});}
});
