import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import Stripe from 'stripe';

// Intentional disposable TEST objects; never log Stripe exceptions or credentials.
const proof = {checkedAt:new Date().toISOString(),testMode:true,reads:{customer:false,product:false,price:false,subscription:false},customerWriteDenied:false,cleanup:{clock:false,price:false,product:false},passed:false};
const resources = {};
const operation = randomUUID();
mkdirSync('.local',{recursive:true});
const privatePath = `.local/reader-probe-${operation}.json`;
const track = (name, id) => {resources[name]=id;writeFileSync(privatePath,JSON.stringify({operation,resources}));};
let controller;
try {
 assert.match(process.env.STRIPE_SECRET_KEY??'',/^sk_test_[A-Za-z0-9]+$/);
 assert.match(process.env.STRIPE_READONLY_KEY??'',/^rk_test_[A-Za-z0-9]+$/);
 controller = new Stripe(process.env.STRIPE_SECRET_KEY,{timeout:15000,maxNetworkRetries:0});
 const reader = new Stripe(process.env.STRIPE_READONLY_KEY,{timeout:15000,maxNetworkRetries:0});
 const clock = await controller.testHelpers.testClocks.create({frozen_time:Math.floor(Date.now()/1000),name:'Fastforward restricted reader verification'},{idempotencyKey:`ff-reader-${operation}-clock`});track('clock',clock.id);
 const product = await controller.products.create({name:'Fastforward disposable reader probe',metadata:{fastforward:'true',purpose:'restricted-reader-verification'}},{idempotencyKey:`ff-reader-${operation}-product`});track('product',product.id);
 const price = await controller.prices.create({product:product.id,currency:'usd',unit_amount:1900,recurring:{interval:'month'}},{idempotencyKey:`ff-reader-${operation}-price`});track('price',price.id);
 const customer = await controller.customers.create({test_clock:clock.id,metadata:{fastforward:'true',purpose:'restricted-reader-verification'}},{idempotencyKey:`ff-reader-${operation}-customer`});track('customer',customer.id);
 const subscription = await controller.subscriptions.create({customer:customer.id,items:[{price:price.id}],trial_period_days:1},{idempotencyKey:`ff-reader-${operation}-subscription`});track('subscription',subscription.id);
 for (const [kind, object] of [['product',product],['price',price],['customer',customer],['subscription',subscription]]) assert.equal(object.livemode,false);
 const readCustomer=await reader.customers.retrieve(customer.id);
 proof.reads.customer=!readCustomer.deleted&&readCustomer.id===customer.id&&readCustomer.livemode===false&&readCustomer.test_clock===clock.id;
 const readProduct=await reader.products.retrieve(product.id);proof.reads.product=readProduct.id===product.id&&readProduct.livemode===false;
 const readPrice=await reader.prices.retrieve(price.id);proof.reads.price=readPrice.id===price.id&&readPrice.product===product.id&&readPrice.livemode===false;
 const readSubscription=await reader.subscriptions.retrieve(subscription.id);proof.reads.subscription=readSubscription.id===subscription.id&&readSubscription.customer===customer.id&&readSubscription.items.data[0]?.price.id===price.id&&readSubscription.livemode===false;
 try {await reader.customers.update(customer.id,{metadata:{readonly_probe:'must-be-denied'}});}catch(error){proof.customerWriteDenied=error?.statusCode===403;}
 assert.ok(Object.values(proof.reads).every(Boolean));assert.equal(proof.customerWriteDenied,true);
} catch(error) {
 proof.error = {type:'Restricted reader verification did not complete',httpStatus:Number.isInteger(error?.statusCode)?error.statusCode:null};
 process.exitCode=1;
} finally {
 if(controller){
  if(resources.clock)try {proof.cleanup.clock=(await controller.testHelpers.testClocks.del(resources.clock)).deleted===true;}catch {process.exitCode=1;}
  if(resources.price)try {proof.cleanup.price=(await controller.prices.update(resources.price,{active:false})).active===false;}catch {process.exitCode=1;}
  if(resources.product)try {proof.cleanup.product=(await controller.products.update(resources.product,{active:false})).active===false;}catch {process.exitCode=1;}
 }
 proof.passed=!proof.error&&Object.values(proof.reads).every(Boolean)&&proof.customerWriteDenied&&Object.values(proof.cleanup).every(Boolean);
 proof.limitation='Confirms reads of fresh controller-created test objects and denial of one customer mutation, not an exhaustive permission audit.';
 mkdirSync('docs/evidence',{recursive:true});writeFileSync('docs/evidence/2026-10-17-stripe-reader-recheck.json',JSON.stringify(proof,null,2)+'\n');
 console.log(JSON.stringify(proof));if(!proof.passed)process.exitCode=1;
}
