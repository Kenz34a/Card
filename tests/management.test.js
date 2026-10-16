import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { fixture } from './server.test.js';
import { STARTER_DECK } from '../src/cards.js';

test('all management APIs require admin, while catalog is public and excludes credentials', async t => {
  const { call, register }=await fixture(t), p=await register('alice');
  for (const [route,data] of [['/api/admin/config'],['/api/admin/config',{}],['/api/admin/cards',{}],['/api/admin/packs',{}],['/api/admin/users',{}],['/api/admin/bulk',{}],['/api/admin/export'],[`/api/admin/users/${p.id}/account`,{}],[`/api/admin/users/${p.id}/delete`,{}]]) {
    assert.equal((await call(route,data)).status,401); assert.equal((await call(route,data,p.cookie)).status,403);
  }
  const catalog=await call('/api/catalog'); assert.equal(catalog.status,200); assert.equal(catalog.data.cards.length,96);
  assert.equal(catalog.data.users,undefined); assert.equal(catalog.data.sessions,undefined);
});
test('game settings change starting gold and daily rewards on server and detect conflicting saves', async t => {
  const { call,register }=await fixture(t), owner=await register('owner',true);
  const config=(await call('/api/admin/config',undefined,owner.cookie)).data;
  config.settings.startingGold=77;config.settings.dailyGold=23;
  const saved=await call('/api/admin/config',{config,revision:config.revision},owner.cookie);assert.equal(saved.status,200);assert.equal(saved.data.revision,1);
  assert.equal((await call('/api/admin/config',{config,revision:0},owner.cookie)).status,409);
  const p=await register('alice');assert.equal(p.data.profile.coins,77);
  const reward=await call('/api/game/daily',{},p.cookie);assert.equal(reward.data.profile.coins,100);
  assert.equal((await call('/api/catalog')).data.settings.dailyGold,23);
});
test('maintenance blocks player mutations, admin remains able to test, and registration can be closed', async t => {
  const { call,register }=await fixture(t), owner=await register('owner',true), p=await register('alice');
  const config=(await call('/api/admin/config',undefined,owner.cookie)).data;
  Object.assign(config.settings,{maintenance:true,registrationOpen:false,announcement:'Bảo trì ngắn'});
  assert.equal((await call('/api/admin/config',{config,revision:0},owner.cookie)).status,200);
  assert.equal((await call('/api/game/pack',{packId:'origin'},p.cookie)).status,503);
  assert.equal((await call('/api/game/battle/start',{mode:'ai'},owner.cookie)).status,200);
  assert.equal((await call('/api/auth/register',{username:'bobby',password:randomBytes(16).toString('hex')})).status,403);
  assert.equal((await call('/api/me',undefined,p.cookie)).data.profile.coins,1200);
});
test('pack price, rarity weights and publication state affect real purchases', async t => {
  const { call,register }=await fixture(t), owner=await register('owner',true), p=await register('alice');
  let config=(await call('/api/admin/config',undefined,owner.cookie)).data;
  const item={...config.packs[0],price:17,weights:{common:0,rare:0,epic:0,legendary:100},guarantee:'legendary'};
  let update=await call('/api/admin/packs',{id:'origin',item,revision:0},owner.cookie);assert.equal(update.status,200);config=update.data.config;
  const pack=await call('/api/game/pack',{packId:'origin'},p.cookie);assert.equal(pack.data.profile.coins,1183);
  assert.ok(pack.data.cards.every(id=>config.cards.find(c=>c.id===id).rarity==='legendary'));
  update=await call('/api/admin/packs',{id:'origin',item:{...item,enabled:false},revision:1},owner.cookie);assert.equal(update.status,200);
  assert.equal((await call('/api/game/pack',{packId:'origin'},p.cookie)).status,400);
  assert.equal((await call('/api/me',undefined,p.cookie)).data.profile.coins,1183);
});
test('invalid rates and removing published cards are rejected atomically', async t => {
  const { call,register }=await fixture(t), owner=await register('owner',true);
  const config=(await call('/api/admin/config',undefined,owner.cookie)).data;
  const bad=await call('/api/admin/packs',{id:'origin',item:{...config.packs[0],weights:{common:60,rare:60,epic:0,legendary:0}},revision:0},owner.cookie);assert.equal(bad.status,400);
  assert.equal((await call('/api/admin/config',undefined,owner.cookie)).data.revision,0);
  config.cards.splice(0,1);
  assert.equal((await call('/api/admin/config',{config,revision:0},owner.cookie)).status,400);
  assert.equal((await call('/api/catalog')).data.cards.length,96);
});
test('custom creatures can be created, granted, put in decks, summoned and used in combat', async t => {
  const { call,register,store }=await fixture(t), owner=await register('owner',true), p=await register('alice');
  let config=store.config();
  const item={...config.cards[0],name:'Thiên Hồ Mới',cost:0,attack:9,health:12,skill:'swift',enabled:true};
  const created=await call('/api/admin/cards',{item,revision:0},owner.cookie);assert.equal(created.status,200);const id=created.data.id;
  assert.equal((await call('/api/catalog')).data.cards.length,97);
  await call(`/api/admin/users/${p.id}/cards`,{cardId:id,quantity:2},owner.cookie);
  const deck=[id,id,...STARTER_DECK.slice(2)];assert.equal((await call(`/api/admin/users/${p.id}/deck`,{deck},owner.cookie)).status,200);
  const start=await call('/api/game/battle/start',{mode:'ai'},p.cookie);let b=start.data.profile.battle;assert.equal(b.cardMap[id].attack,9);
  const profile=start.data.profile;profile.battle.players[0].hand=[id];store.saveProfile(p.id,profile);
  const summon=await call('/api/game/battle/action',{battleId:b.id,revision:0,type:'play',index:0},p.cookie);assert.equal(summon.status,200);
  const unit=summon.data.profile.battle.players[0].board[0];assert.equal(unit.attack,9);assert.equal(unit.ready,true);
  const attack=await call('/api/game/battle/action',{battleId:b.id,revision:1,type:'attack',uid:unit.uid,target:null},p.cookie);assert.equal(attack.data.profile.battle.players[1].hp,15);
});
test('card balancing and reward changes do not alter an already running battle', async t => {
  const { call,register }=await fixture(t), owner=await register('owner',true), p=await register('alice');
  const start=await call('/api/game/battle/start',{mode:'ai'},p.cookie), b=start.data.profile.battle;
  const config=(await call('/api/admin/config',undefined,owner.cookie)).data;config.cards.find(c=>c.id==='fire-0').attack=30;config.settings.lossGold=999;
  assert.equal((await call('/api/admin/config',{config,revision:0},owner.cookie)).status,200);
  const result=await call('/api/game/battle/action',{battleId:b.id,revision:0,type:'surrender'},p.cookie);
  assert.equal(result.data.profile.battle.cardMap['fire-0'].attack,b.cardMap['fire-0'].attack);
  assert.equal(result.data.profile.coins,1240);assert.equal(result.data.profile.battle.rewardGold,40);
  const again=await call('/api/game/battle/start',{mode:'ai'},p.cookie);assert.equal(again.data.profile.battle.cardMap['fire-0'].attack,30);
});
test('bulk operations are atomic, support all players and do not silently include admins', async t => {
  const { call,register }=await fixture(t), owner=await register('owner',true), a=await register('alice'),b=await register('bobby');
  await call(`/api/admin/users/${b.id}/gold`,{amount:-1195},owner.cookie);
  const before=(await call('/api/admin/overview',undefined,owner.cookie)).data.audit.length;
  const invalid=await call('/api/admin/bulk',{userIds:[a.id,b.id],action:'gold',amount:-10,confirm:'XÁC NHẬN'},owner.cookie);assert.equal(invalid.status,400);
  assert.equal((await call('/api/me',undefined,a.cookie)).data.profile.coins,1200);
  assert.equal((await call('/api/admin/overview',undefined,owner.cookie)).data.audit.length,before);
  const result=await call('/api/admin/bulk',{scope:'players',action:'gold',amount:20,confirm:'XÁC NHẬN'},owner.cookie);assert.equal(result.data.count,2);
  assert.equal((await call('/api/me',undefined,a.cookie)).data.profile.coins,1220);assert.equal((await call('/api/me',undefined,b.cookie)).data.profile.coins,25);
  assert.equal((await call('/api/me',undefined,owner.cookie)).data.profile.coins,1200);
});
test('bulk cannot lock the acting admin and rolls back session revocation on partial failure', async t => {
  const { call,register }=await fixture(t), owner=await register('owner',true),p=await register('alice');
  const result=await call('/api/admin/bulk',{userIds:[p.id,owner.id],action:'ban',confirm:'XÁC NHẬN'},owner.cookie);assert.equal(result.status,400);
  assert.equal((await call('/api/me',undefined,p.cookie)).status,200);assert.equal((await call('/api/me',undefined,owner.cookie)).status,200);
  assert.equal((await call('/api/admin/bulk',{scope:'players',action:'reset',confirm:'wrong'},owner.cookie)).status,400);
});
test('role editing, password resets and deletion preserve the acting admin and revoke target sessions', async t => {
  const { call,register }=await fixture(t), owner=await register('owner',true),p=await register('alice');
  assert.equal((await call(`/api/admin/users/${owner.id}/account`,{displayName:'Owner',role:'player'},owner.cookie)).status,400);
  assert.equal((await call(`/api/admin/users/${owner.id}/delete`,{confirm:'owner'},owner.cookie)).status,400);
  const role=await call(`/api/admin/users/${p.id}/account`,{displayName:'Admin Alice',role:'admin'},owner.cookie);assert.equal(role.data.user.role,'admin');
  assert.equal((await call('/api/admin/config',undefined,p.cookie)).status,200);
  const password=randomBytes(16).toString('hex');assert.equal((await call(`/api/admin/users/${p.id}/password`,{password},owner.cookie)).status,200);
  assert.equal((await call('/api/me',undefined,p.cookie)).status,401);
  const login=await call('/api/auth/login',{username:'alice',password});assert.equal(login.status,200);
  assert.equal((await call(`/api/admin/users/${p.id}/delete`,{confirm:'not-alice'},owner.cookie)).status,400);
  assert.equal((await call(`/api/admin/users/${p.id}/delete`,{confirm:'alice'},owner.cookie)).data.deleted,true);
  assert.equal((await call('/api/me',undefined,login.cookie)).status,401);
});
test('inventory changes trim invalid deck copies and admin deck updates enforce ownership', async t => {
  const { call,register }=await fixture(t),owner=await register('owner',true),p=await register('alice');
  const reduced=await call(`/api/admin/users/${p.id}/inventory`,{cardId:'fire-0',quantity:0},owner.cookie);
  assert.equal(reduced.data.profile.deck.length,18);assert.equal(reduced.data.profile.collection['fire-0'],undefined);
  assert.equal((await call(`/api/admin/users/${p.id}/deck`,{deck:STARTER_DECK},owner.cookie)).status,400);
  await call(`/api/admin/users/${p.id}/inventory`,{cardId:'fire-0',quantity:2},owner.cookie);
  assert.equal((await call(`/api/admin/users/${p.id}/deck`,{deck:STARTER_DECK},owner.cookie)).status,200);
});
test('admin can create accounts while registration is closed and export excludes credentials', async t => {
  const { call,register,store }=await fixture(t),owner=await register('owner',true);
  let config=store.config();config.settings.registrationOpen=false;store.saveConfig(config,0);
  const password=randomBytes(16).toString('hex');
  const created=await call('/api/admin/users',{username:'staff',displayName:'Nhân viên',password,role:'admin'},owner.cookie);assert.equal(created.status,200);
  const login=await call('/api/auth/login',{username:'staff',password});assert.equal(login.status,200);
  const exported=await call('/api/admin/export',undefined,owner.cookie);assert.equal(exported.data.users.length,2);
  const serialized=JSON.stringify(exported.data);assert.ok(!serialized.includes('password_hash')&&!serialized.includes('token_hash')&&!serialized.includes(password));
  assert.equal(exported.data.users[0].profile.battle,null);
});
test('changing own password rotates the current cookie and invalidates other devices', async t => {
  const { call,register }=await fixture(t),p=await register('alice');
  const other=await call('/api/auth/login',{username:'alice',password:p.password});const next=randomBytes(16).toString('hex');
  assert.equal((await call('/api/auth/password',{oldPassword:'incorrect',password:next},p.cookie)).status,400);
  const changed=await call('/api/auth/password',{oldPassword:p.password,password:next},p.cookie);assert.equal(changed.status,200);
  assert.equal((await call('/api/me',undefined,p.cookie)).status,401);assert.equal((await call('/api/me',undefined,other.cookie)).status,401);
  assert.equal((await call('/api/me',undefined,changed.cookie)).status,200);
});
test('old displayed pack prices are rejected without charging the player', async t => {
  const {call,register,store}=await fixture(t),owner=await register('owner',true),p=await register('alice');
  const config=store.config();config.packs[0].price=333;store.saveConfig(config,0);
  const stale=await call('/api/game/pack',{packId:'origin',price:150},p.cookie);assert.equal(stale.status,409);
  assert.equal((await call('/api/me',undefined,p.cookie)).data.profile.coins,1200);
  assert.equal((await call('/api/game/pack',{packId:'origin',price:333},p.cookie)).data.profile.coins,867);
});
test('revoked admin rights are checked again after an in-flight request body finishes', async t => {
  const {call,register,url}=await fixture(t),owner=await register('owner',true),staff=await register('staff',true),p=await register('alice');
  let resolveResponse,rejectResponse;
  const response=new Promise((resolve,reject)=>{resolveResponse=resolve;rejectResponse=reject;});
  const req=httpRequest(url+`/api/admin/users/${p.id}/gold`,{method:'POST',headers:{Cookie:staff.cookie,'Content-Type':'application/json','Transfer-Encoding':'chunked'}},res=>{res.resume();res.on('end',()=>resolveResponse(res.statusCode));});
  req.on('error',rejectResponse);req.write('{');
  await new Promise(resolve=>setTimeout(resolve,40));
  assert.equal((await call(`/api/admin/users/${staff.id}/account`,{displayName:'Staff',role:'player'},owner.cookie)).status,200);
  req.end('"amount":1000}');assert.equal(await response,403);
  assert.equal((await call('/api/me',undefined,p.cookie)).data.profile.coins,1200);
});
test('large validated catalogs support 500 cards including long Vietnamese descriptions', async t => {
  const {call,register,store}=await fixture(t),owner=await register('owner',true);
  const config=store.config(), template=config.cards[0];
  while(config.cards.length<500)config.cards.push({...template,id:`card-large-${config.cards.length}`,name:`Thẻ mới ${config.cards.length}`,description:'ử'.repeat(400)});
  const payload={config,revision:0};assert.ok(Buffer.byteLength(JSON.stringify(payload))>524288);
  const saved=await call('/api/admin/config',payload,owner.cookie);assert.equal(saved.status,200);assert.equal(saved.data.cards.length,500);
});
