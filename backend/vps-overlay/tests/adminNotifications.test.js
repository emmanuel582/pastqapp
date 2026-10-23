import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

test('campaign preview freezes recipients, sending is idempotent, inbox is private, and images are normalized',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'pastq-campaign-'));
  process.env.DATA_DIR=root;process.env.NODE_ENV='test';process.env.SESSION_OWNER_HMAC_SECRET='campaign-test-secret';process.env.WEB_PUSH_SUBJECT='mailto:admin@example.test';
  const notifications=await import('../services/admin/notifications.js');
  const reminders=await import('../services/reminders/store.js');
  const {sessionOwnerKey}=await import('../services/auth/middleware.js');
  try{
    const image=await notifications.saveImage(await sharp({create:{width:40,height:30,channels:3,background:'#e67468'}}).png().toBuffer(),'admin');
    assert.equal((await sharp(fs.readFileSync(notifications.imagePath(image.id))).metadata()).format,'webp');assert.equal(notifications.imagePath('../../.env'),null);
    await assert.rejects(notifications.saveImage(Buffer.from('<svg/>'),'admin'));
    assert.throws(()=>notifications.validateMessage({title:'x',body:'y',deepLink:'//external.example'}));
    assert.throws(()=>notifications.validateMessage({title:'x',body:'y',imageId:'missing'}));
    const owner=sessionOwnerKey('first');reminders.saveSettings(owner,{enabled:true});reminders.saveSubscription(owner,{endpoint:'https://fcm.googleapis.com/fake',keys:{}});
    const message=notifications.validateMessage({title:'A new paper',body:'Try this paper.',imageId:image.id,push:true});
    const preview=notifications.previewCampaign('admin',message,{mode:'selected',userIds:['first','second']},[{id:'first'},{id:'second'}]);
    assert.equal(preview.recipients,2);assert.equal(preview.pushEligible,1);assert.equal(notifications.inbox('first').total,0);
    assert.throws(()=>notifications.queueCampaign(preview.id,'other-admin'),/not found/);
    notifications.queueCampaign(preview.id,'admin');notifications.queueCampaign(preview.id,'admin');
    assert.equal(notifications.inbox('first').total,1);assert.equal(notifications.inbox('second').total,1);assert.equal(notifications.inbox('outsider').total,0);
    assert.throws(()=>notifications.markRead('outsider',preview.id),/not found/);notifications.markRead('first',preview.id);assert.equal(notifications.inbox('first').unread,0);
    const sent=[],topics=[];await notifications.dispatchCampaigns({send:async(device,payload,options)=>{sent.push(payload);topics.push(options.topic);}});await notifications.dispatchCampaigns({send:async()=>assert.fail('Duplicate push')});
    assert.match(topics[0],/^[A-Za-z0-9_-]{32}$/);
    assert.equal(sent.length,1);assert.equal(sent[0].image,`https://76.13.110.6.nip.io/api/reminders/images/${image.id}`);
    const history=notifications.listCampaigns();assert.equal(history.items[0].status,'completed');assert.equal(history.items[0].push_sent,1);assert.equal(history.items[0].read,1);
    notifications.closeNotificationStore();assert.equal(notifications.inbox('first').total,1);
    const failed=notifications.previewCampaign('admin',message,{mode:'selected',userIds:['first']},[{id:'first'}]);notifications.queueCampaign(failed.id,'admin');
    await notifications.dispatchCampaigns({send:async()=>{throw {statusCode:410};}});assert.equal(notifications.listCampaigns().items.find(row=>row.id===failed.id).push_failed,1);assert.equal(reminders.subscriptions(owner).length,0);
    assert.equal(notifications.inbox('first').total,2);
  }finally{notifications.closeNotificationStore();reminders.closeReminderStore();fs.rmSync(root,{recursive:true,force:true});}
});
