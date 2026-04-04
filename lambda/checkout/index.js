/*
  BloxStudy — Lambda: Create Stripe Checkout Session
  Triggered by: POST /checkout  (API Gateway)
  Env vars required:
    STRIPE_SECRET_KEY   — sk_test_... or sk_live_...
    STRIPE_BASE_PRICE   — price_... ($4.99/mo)
    STRIPE_EXTRA_PRICE  — price_... ($2.00/mo per extra child)
    SUCCESS_URL         — e.g. https://bloxstudy.netlify.app/dashboard.html?success=true
    CANCEL_URL          — e.g. https://bloxstudy.netlify.app/signup.html
*/

const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS'
};

exports.handler = async (event) => {
  // Handle preflight CORS request from browser
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  try {
    const { userId, email, childCount } = JSON.parse(event.body);

    if (!userId || !email || !childCount) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Missing required fields: userId, email, childCount' })
      };
    }

    // Build line items — base price always quantity 1
    // Extra children price added only if childCount > 1
    const lineItems = [
      { price: process.env.STRIPE_BASE_PRICE, quantity: 1 }
    ];

    if (childCount > 1) {
      lineItems.push({
        price: process.env.STRIPE_EXTRA_PRICE,
        quantity: childCount - 1
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode:                 'subscription',
      payment_method_types: ['card'],
      customer_email:       email,
      line_items:           lineItems,
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          userId,
          childCount: String(childCount)
        }
      },
      success_url: process.env.SUCCESS_URL,
      cancel_url:  process.env.CANCEL_URL,
      metadata: {
        userId,
        childCount: String(childCount)
      }
    });

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ url: session.url })
    };

  } catch (err) {
    console.error('Checkout Lambda error:', err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Failed to create checkout session.' })
    };
  }
};
