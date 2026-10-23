import { registerDevice, revokeDevice, enqueueNative, dispatchNative } from '../services/notifications/native.js';
import { Router } from 'express';
import { requireAuthenticatedUser } from '../services/auth/middleware.js';
import { rateLimit } from '../services/http/security.js';
import { validateSettings, validateActivity, planReminder } from '../services/reminders/planner.js';
import { pushConfiguration, validateSubscription, sendTestReminder } from '../services/reminders/delivery.js';
import * as store from '../services/reminders/store.js';
import * as notifications from '../services/admin/notifications.js';
const router = Router();
router.get('/images/:id/push.jpg',rateLimit({limit:180,keyPrefix:'notification-artwork'}),async(req,res,next)=>{
 try { const filename=await notifications.pushImage(req.params.id); res.type('jpeg').set('Cache-Control','public, max-age=86400').set('Cross-Origin-Resource-Policy','cross-origin').sendFile(filename,error=>{if(error)next(error);}); } catch(error){next(error);}
});
router.get('/images/:id',rateLimit({limit:180,keyPrefix:'notification-images'}),(req,res,next)=>{
  const filename=notifications.imagePath(req.params.id);
  if(!filename)return res.status(404).json({error:'Image not found.'});
  res.type('webp').set('Cache-Control','public, max-age=86400').set('Cross-Origin-Resource-Policy','cross-origin').sendFile(filename,error=>{if(error)next(error);});
});
router.post('/native-device/revoke', rateLimit({limit:20,keyPrefix:'native-revoke'}), (req,res,next)=>{try{revokeDevice(req.body);res.json({ok:true});}catch(error){if(error.status)return res.status(error.status).json({error:error.message});next(error);}});
router.use(requireAuthenticatedUser, rateLimit({ limit: 40, keyPrefix: 'reminders' }), (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.put('/native-device',(req,res,next)=>{try{registerDevice(req.auth.ownerKey,req.auth.user.id,req.body);res.json({connected:true});}catch(error){if(error.status)return res.status(error.status).json({error:error.message});next(error);}});
router.post('/native-test',rateLimit({limit:3,keyPrefix:'native-test'}),(req,res,next)=>{try{const result=enqueueNative(req.auth.ownerKey,'test:'+req.auth.user.id+':'+Math.floor(Date.now()/10000),{title:'PastQ notifications are connected',body:'Upload updates and messages from PastQ will appear here.',data:{kind:'inbox'}});void dispatchNative().catch(()=>{});res.status(202).json(result);}catch(error){next(error);}});
router.get('/inbox',(req,res)=>{const offset=Math.max(0,parseInt(req.query.offset)||0);res.json(notifications.inbox(req.auth.user.id,offset,20));});
router.post('/inbox/:id/read',(req,res,next)=>{try{notifications.markRead(req.auth.user.id,req.params.id);res.json({ok:true});}catch(error){if(error.status)return res.status(error.status).json({error:error.message});next(error);}});
function snapshot(owner, ownerId) { const settings = store.readSettings(owner), config = pushConfiguration(), activity = store.readActivity(owner); return { ownerId, settings, activityCount: activity.length, push: { configured: Boolean(config), publicKey: config?.publicKey || null, devices: store.subscriptions(owner).map(item => item.id) }, preview: planReminder(settings, activity), lastDelivery: store.lastDelivery(owner) }; }
router.get('/', (req, res, next) => { try { res.json(snapshot(req.auth.ownerKey, req.auth.user.id)); } catch (error) { next(error); } });
router.put('/', (req, res, next) => {
  try { const owner = req.auth.ownerKey, settings = validateSettings(req.body, store.readSettings(owner)); if (settings.enabled && (!pushConfiguration() || !store.subscriptions(owner).length)) return res.status(409).json({ error: 'Connect a device before enabling reminders.' }); store.saveSettings(owner, settings); res.json(snapshot(owner, req.auth.user.id)); }
  catch (error) { if (error.status) return res.status(error.status).json({ error: error.message }); next(error); }
});
router.put('/subscription', (req, res, next) => { try { if (!pushConfiguration()) return res.status(503).json({ error: 'Study notifications are not configured on the server yet.' }); store.saveSubscription(req.auth.ownerKey, validateSubscription(req.body)); res.json(snapshot(req.auth.ownerKey, req.auth.user.id)); } catch (error) { if (error.status) return res.status(error.status).json({ error: error.message }); next(error); } });
router.delete('/subscription', (req, res, next) => { try { if (typeof req.body?.endpoint !== 'string') return res.status(400).json({ error: 'Provide the current device subscription.' }); store.removeSubscription(req.auth.ownerKey, store.subscriptionId(req.body.endpoint)); res.json(snapshot(req.auth.ownerKey, req.auth.user.id)); } catch (error) { next(error); } });
router.post('/activity', (req, res, next) => { try { store.saveActivity(req.auth.ownerKey, validateActivity(req.body?.sessions)); res.status(202).json({ accepted: true }); } catch (error) { if (error.status) return res.status(error.status).json({ error: error.message }); next(error); } });
router.post('/test', rateLimit({ limit: 3, keyPrefix: 'reminder-test' }), async (req, res, next) => { try { await sendTestReminder(req.auth.ownerKey, req.body?.endpoint); res.json(snapshot(req.auth.ownerKey, req.auth.user.id)); } catch (error) { if (error.status) return res.status(error.status).json({ error: error.message }); next(error); } });
export default router;
