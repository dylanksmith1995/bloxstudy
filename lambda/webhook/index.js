/*
  BloxStudy — Lambda: Stripe Webhook Handler
  Triggered by: POST /webhook  (API Gateway — RAW body, no transformation)
  Env vars required:
    STRIPE_SECRET_KEY      — same as checkout Lambda
    STRIPE_WEBHOOK_SECRET  — whsec_... from Stripe Dashboard → Webhooks
*/

const Stripe = require('stripe');
const { DynamoDBClient, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const dynamo = new DynamoDBClient({ region: 'us-east-1' });

exports.handler = async (event) => {
  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];

  let stripeEvent;
  try {
    // Verify the event came from Stripe, not a bad actor
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  // Handle subscription activated (trial started or first payment succeeded)
  if (stripeEvent.type === 'checkout.session.completed') {
    const session  = stripeEvent.data.object;
    const userId   = session.metadata?.userId;
    const childCount = session.metadata?.childCount || '1';

    if (userId) {
      try {
        await dynamo.send(new UpdateItemCommand({
          TableName: 'bloxstudy-users',
          Key: { userId: { S: userId } },
          UpdateExpression: 'SET stripeCustomerId = :cid, stripeSubscriptionId = :sid, subscriptionStatus = :status, childCount = :cc, updatedAt = :ts',
          ExpressionAttributeValues: {
            ':cid':    { S: session.customer           || '' },
            ':sid':    { S: session.subscription       || '' },
            ':status': { S: 'trialing'                      },
            ':cc':     { N: childCount                      },
            ':ts':     { N: String(Date.now())              }
          }
        }));
        console.log(`Activated subscription for userId: ${userId}`);
      } catch (err) {
        console.error('DynamoDB update failed:', err);
        return { statusCode: 500, body: 'Database error' };
      }
    }
  }

  // Handle subscription going active after trial ends (first real charge)
  if (stripeEvent.type === 'customer.subscription.updated') {
    const sub    = stripeEvent.data.object;
    const userId = sub.metadata?.userId;

    if (userId && sub.status) {
      await dynamo.send(new UpdateItemCommand({
        TableName: 'bloxstudy-users',
        Key: { userId: { S: userId } },
        UpdateExpression: 'SET subscriptionStatus = :status, updatedAt = :ts',
        ExpressionAttributeValues: {
          ':status': { S: sub.status        },
          ':ts':     { N: String(Date.now()) }
        }
      }));
    }
  }

  // Handle subscription cancelled
  if (stripeEvent.type === 'customer.subscription.deleted') {
    const sub    = stripeEvent.data.object;
    const userId = sub.metadata?.userId;

    if (userId) {
      await dynamo.send(new UpdateItemCommand({
        TableName: 'bloxstudy-users',
        Key: { userId: { S: userId } },
        UpdateExpression: 'SET subscriptionStatus = :status, updatedAt = :ts',
        ExpressionAttributeValues: {
          ':status': { S: 'cancelled'        },
          ':ts':     { N: String(Date.now()) }
        }
      }));
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
