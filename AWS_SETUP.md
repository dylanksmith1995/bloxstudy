# BloxStudy — AWS Setup Guide

## Architecture Overview

```
Browser (S3 + CloudFront)
        ↓ HTTPS
API Gateway → Lambda Functions
        ↓
  ┌─────┴──────┐
Cognito    DynamoDB    Stripe    SES
(Auth)    (Database)  (Billing) (Email)
```

---

## Step 1 — AWS Account Setup

1. Go to https://aws.amazon.com and create a free account
2. Enable MFA on your root account (important for security)
3. Create an IAM user with programmatic access for development
4. Install AWS CLI: https://aws.amazon.com/cli/
5. Run `aws configure` and enter your access keys

---

## Step 2 — Host the Website (S3 + CloudFront)

### Create S3 Bucket
```bash
aws s3 mb s3://bloxstudy-website --region us-east-1
aws s3 website s3://bloxstudy-website --index-document index.html --error-document index.html
```

### Upload your files
```bash
aws s3 sync . s3://bloxstudy-website --exclude "*.md" --exclude "*.json"
```

### Create CloudFront Distribution
1. Go to AWS Console → CloudFront → Create Distribution
2. Origin: your S3 bucket
3. Enable HTTPS (free SSL via ACM)
4. Set default root object: `index.html`
5. Your site will be live at: `https://XXXX.cloudfront.net`

### Custom Domain (Route 53)
1. Register domain at Route 53 (~$12/yr) or point existing domain
2. Request SSL cert in ACM (us-east-1)
3. Add CloudFront as ALIAS record in Route 53

**Cost: ~$1-5/month**

---

## Step 3 — Authentication (AWS Cognito)

### Create User Pool
1. AWS Console → Cognito → Create User Pool
2. Settings:
   - Sign-in: Email address
   - Password policy: Min 8 chars
   - MFA: Optional (recommended)
   - Email verification: Yes (use SES)
3. Create App Client (no client secret for web apps)
4. Note your:
   - `User Pool ID` (us-east-1_XXXXXXX)
   - `Client ID`

### Add Cognito to your frontend
```bash
npm install amazon-cognito-identity-js
```

Replace the `Auth.signIn()` stub in `script.js`:
```javascript
import { CognitoUserPool, CognitoUser, AuthenticationDetails } from 'amazon-cognito-identity-js';

const poolData = {
  UserPoolId: 'us-east-1_XXXXXXX',  // ← your pool ID
  ClientId: 'XXXXXXXXXXXXXXXXXX'      // ← your client ID
};
const userPool = new CognitoUserPool(poolData);
```

**Cost: FREE up to 50,000 users**

---

## Step 4 — Database (DynamoDB)

### Tables to Create

#### `bloxstudy-users`
| Key | Type | Description |
|-----|------|-------------|
| `userId` (PK) | String | Cognito sub |
| `email` | String | Parent email |
| `firstName` | String | |
| `plan` | String | starter/family/premium |
| `stripeCustomerId` | String | |
| `createdAt` | Number | Unix timestamp |

#### `bloxstudy-kids`
| Key | Type | Description |
|-----|------|-------------|
| `kidId` (PK) | String | UUID |
| `parentId` (SK) | String | userId |
| `name` | String | Kid's name |
| `grade` | Number | 1–8 |
| `avatar` | String | emoji or URL |

#### `bloxstudy-sessions`
| Key | Type | Description |
|-----|------|-------------|
| `sessionId` (PK) | String | UUID |
| `kidId` (SK) | String | |
| `gameName` | String | |
| `subject` | String | math/science/etc |
| `score` | Number | |
| `duration` | Number | seconds |
| `timestamp` | Number | Unix |

### Create via CLI
```bash
aws dynamodb create-table \
  --table-name bloxstudy-users \
  --attribute-definitions AttributeName=userId,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

**Cost: FREE (25GB free tier)**

---

## Step 5 — Serverless API (Lambda + API Gateway)

### Lambda Functions to Create

| Function | Trigger | Purpose |
|----------|---------|---------|
| `bloxstudy-create-checkout` | POST /checkout | Create Stripe session |
| `bloxstudy-get-progress` | GET /progress/{userId} | Fetch kid progress |
| `bloxstudy-log-session` | POST /sessions | Save game session |
| `bloxstudy-stripe-webhook` | POST /webhook | Handle Stripe events |
| `bloxstudy-send-report` | Scheduled (weekly) | Email progress reports |

### Example: Create Checkout Lambda (Node.js)
```javascript
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PLANS = {
  starter: 'price_XXXX',  // ← your Stripe price IDs
  family:  'price_XXXX',
  premium: 'price_XXXX'
};

exports.handler = async (event) => {
  const { plan, userId } = JSON.parse(event.body);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: PLANS[plan], quantity: 1 }],
    success_url: 'https://bloxstudy.com/dashboard.html?success=true',
    cancel_url:  'https://bloxstudy.com/signup.html',
    metadata: { userId }
  });

  return {
    statusCode: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ url: session.url })
  };
};
```

### Deploy Lambda
```bash
zip function.zip index.js node_modules/
aws lambda create-function \
  --function-name bloxstudy-create-checkout \
  --runtime nodejs20.x \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --role arn:aws:iam::ACCOUNT_ID:role/lambda-role \
  --environment Variables="{STRIPE_SECRET_KEY=sk_live_XXXX}"
```

**Cost: FREE (1M requests/month free tier)**

---

## Step 6 — Stripe Subscription Setup

1. Go to https://dashboard.stripe.com
2. Create Products:
   - **Starter** — $4.99/month
   - **Family** — $9.99/month  
   - **Premium** — $14.99/month
3. Note each Price ID (price_XXXX) and add to Lambda env
4. Set up Webhook endpoint → your `/webhook` Lambda URL
5. Events to listen for:
   - `checkout.session.completed` → activate subscription in DynamoDB
   - `customer.subscription.deleted` → downgrade/deactivate account
   - `invoice.payment_failed` → send email, lock access

---

## Step 7 — Email (SES)

1. AWS Console → SES → Verify your domain
2. Move out of sandbox mode (submit request to AWS)
3. Create email templates:
   - Welcome email
   - Weekly progress report
   - Payment failed notice

### Weekly Report Lambda (triggered by EventBridge)
```javascript
// Runs every Sunday at 8am
// 1. Query all active subscriptions from DynamoDB
// 2. For each family, aggregate kid session data
// 3. Generate HTML report
// 4. Send via SES
```

**Cost: $0.10 per 1,000 emails**

---

## Step 8 — Deploy Updates

Create a deploy script (`deploy.sh`):
```bash
#!/bin/bash
echo "Deploying BloxStudy to AWS..."
aws s3 sync . s3://bloxstudy-website \
  --exclude "*.md" \
  --exclude ".git/*" \
  --exclude "node_modules/*"

aws cloudfront create-invalidation \
  --distribution-id YOUR_DIST_ID \
  --paths "/*"

echo "✅ Deployed!"
```

---

## Environment Variables Checklist

```
STRIPE_SECRET_KEY        = sk_live_XXXX
STRIPE_WEBHOOK_SECRET    = whsec_XXXX
COGNITO_USER_POOL_ID     = us-east-1_XXXX
COGNITO_CLIENT_ID        = XXXX
DYNAMODB_REGION          = us-east-1
SES_FROM_EMAIL           = hello@bloxstudy.com
FRONTEND_URL             = https://bloxstudy.com
```

---

## Monthly Cost Estimate (Scaling)

| Users | AWS Cost | Stripe Fees | Net Revenue ($9.99 avg) |
|-------|----------|-------------|--------------------------|
| 100   | ~$2      | ~$30        | ~$939                    |
| 1,000 | ~$8      | ~$300       | ~$9,690                  |
| 10,000| ~$40     | ~$3,000     | ~$96,860                 |

---

## Next Steps

- [ ] Register domain on Route 53
- [ ] Create AWS account + IAM user  
- [ ] Set up S3 + CloudFront
- [ ] Configure Cognito User Pool
- [ ] Create DynamoDB tables
- [ ] Set up Stripe products + webhook
- [ ] Deploy Lambda functions
- [ ] Configure SES + verify domain
- [ ] Deploy site and test end-to-end
