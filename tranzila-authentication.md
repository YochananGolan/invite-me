# Tranzila API Authentication

## Overview

Authentication information is sent via custom HTTP request headers and not the actual payload itself.

Tranzila uses a secure access-token to ensure authentication, prevent processing of the same request more than once, and prevent man-in-the-middle attacks.

In order to achieve that, every merchant must enroll to Tranzila API Services and get both **public** and **secret** keys from Tranzila.

While the public key is used in each request and is exposed in the request header, the secret key is only used internally by both merchant application and server application for each merchant.

## Important Security Notes

- **Keep your secret key safe** and do not share it with anyone at all times
- **Cannot call Tranzila API from web client applications** - this restriction means you must use a proxy service on your server
- The secret key must remain server-side only

## Required HTTP Headers

| Header | Note |
|--------|------|
| `X-tranzila-api-app-key` | Application key (public key) supplied by Tranzila |
| `X-tranzila-api-request-time` | Request time sent in Unix format (large integer counting milliseconds from Jan 1st, 1970 00:00:00) |
| `X-tranzila-api-nonce` | A 40 bytes NONCE – unique random string generated with any random bytes function |
| `X-tranzila-api-access-token` | hash_hmac using 'sha256' on application key with secret + request-time + nonce. hash_hmac is available for all programming languages |

## Create a Valid Access Token

The access token is created using HMAC SHA-256:

```
accessToken = hash_hmac('sha256', appKey, secret + requestTime + nonce)
```

**Components:**
1. **appKey** - Your public application key from Tranzila
2. **secret** - Your private secret key from Tranzila (never expose this!)
3. **requestTime** - Current Unix timestamp in milliseconds
4. **nonce** - A unique 40-byte random string (typically generates 80 character string when hex-encoded)

## Code Examples

### PHP

```php
<?php
$json = trim(isset($_POST['jsontext']) ? $_POST['jsontext'] : '');
$time = time();
$appKey = '<public app key>';
$secret = '<private app key>';
$nonce = bin2hex(random_bytes(40)); // actually 80 characters string
$accessToken = hash_hmac('sha256', $appKey, $secret . $time . $nonce);

$ch = curl_init('<<please replace this with service endpoint>>');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLINFO_HEADER_OUT, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $json);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);
curl_setopt($ch, CURLOPT_HTTPHEADER, array(
    'Content-Type: application/json',
    'Content-Length: ' . strlen($json),
    'X-tranzila-api-app-key: ' . $appKey,
    'X-tranzila-api-request-time:' . $time,
    'X-tranzila-api-nonce:' . $nonce,
    'X-tranzila-api-access-token:' . $accessToken
  )
);

$data = curl_exec($ch);
curl_close($ch);
return $json;
?>
```

### .NET (C#)

```csharp
using System;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;

public class TranzilaAuth
{
    public static async Task<string> MakeRequest(string endpoint, string jsonPayload)
    {
        string appKey = "<public app key>";
        string secret = "<private app key>";

        // Generate timestamp
        long requestTime = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        // Generate nonce (40 bytes = 80 hex characters)
        string nonce = GenerateNonce(40);

        // Create access token
        string accessToken = CreateAccessToken(appKey, secret, requestTime, nonce);

        using (var client = new HttpClient())
        {
            client.DefaultRequestHeaders.Add("X-tranzila-api-app-key", appKey);
            client.DefaultRequestHeaders.Add("X-tranzila-api-request-time", requestTime.ToString());
            client.DefaultRequestHeaders.Add("X-tranzila-api-nonce", nonce);
            client.DefaultRequestHeaders.Add("X-tranzila-api-access-token", accessToken);

            var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");
            var response = await client.PostAsync(endpoint, content);

            return await response.Content.ReadAsStringAsync();
        }
    }

    private static string GenerateNonce(int bytes)
    {
        byte[] randomBytes = new byte[bytes];
        using (var rng = new RNGCryptoServiceProvider())
        {
            rng.GetBytes(randomBytes);
        }
        return BitConverter.ToString(randomBytes).Replace("-", "").ToLower();
    }

    private static string CreateAccessToken(string appKey, string secret, long requestTime, string nonce)
    {
        string message = secret + requestTime + nonce;
        byte[] keyBytes = Encoding.UTF8.GetBytes(appKey);
        byte[] messageBytes = Encoding.UTF8.GetBytes(message);

        using (var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(message)))
        {
            byte[] hashBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(appKey));
            return BitConverter.ToString(hashBytes).Replace("-", "").ToLower();
        }
    }
}
```

### Node.js

```javascript
const crypto = require('crypto');
const axios = require('axios');

async function makeRequest(endpoint, jsonPayload) {
  const appKey = '<public app key>';
  const secret = '<private app key>';

  // Generate timestamp (in seconds for Unix time)
  const requestTime = Math.floor(Date.now() / 1000);

  // Generate nonce (40 bytes = 80 hex characters)
  const nonce = crypto.randomBytes(40).toString('hex');

  // Create access token
  const message = secret + requestTime + nonce;
  const accessToken = crypto
    .createHmac('sha256', message)
    .update(appKey)
    .digest('hex');

  try {
    const response = await axios.post(endpoint, jsonPayload, {
      headers: {
        'Content-Type': 'application/json',
        'X-tranzila-api-app-key': appKey,
        'X-tranzila-api-request-time': requestTime,
        'X-tranzila-api-nonce': nonce,
        'X-tranzila-api-access-token': accessToken
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error making request:', error);
    throw error;
  }
}

module.exports = { makeRequest };
```

### Python

```python
import time
import hmac
import hashlib
import secrets
import requests

def make_request(endpoint, json_payload):
    app_key = '<public app key>'
    secret = '<private app key>'

    # Generate timestamp (in seconds for Unix time)
    request_time = int(time.time())

    # Generate nonce (40 bytes = 80 hex characters)
    nonce = secrets.token_hex(40)

    # Create access token
    message = f"{secret}{request_time}{nonce}"
    access_token = hmac.new(
        message.encode('utf-8'),
        app_key.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

    # Set headers
    headers = {
        'Content-Type': 'application/json',
        'X-tranzila-api-app-key': app_key,
        'X-tranzila-api-request-time': str(request_time),
        'X-tranzila-api-nonce': nonce,
        'X-tranzila-api-access-token': access_token
    }

    # Make request
    response = requests.post(endpoint, json=json_payload, headers=headers)

    return response.json()

# Example usage
if __name__ == "__main__":
    endpoint = "<<please replace this with service endpoint>>"
    payload = {"key": "value"}
    result = make_request(endpoint, payload)
    print(result)
```

### Postman Pre-Request Script

```javascript
// Set your keys here
const appKey = '<public app key>';
const secret = '<private app key>';

// Generate timestamp
const requestTime = Math.floor(Date.now() / 1000).toString();

// Generate nonce (40 bytes = 80 hex characters)
const nonce = CryptoJS.lib.WordArray.random(40).toString();

// Create access token
const message = secret + requestTime + nonce;
const accessToken = CryptoJS.HmacSHA256(appKey, message).toString();

// Set headers
pm.request.headers.add({
    key: 'X-tranzila-api-app-key',
    value: appKey
});

pm.request.headers.add({
    key: 'X-tranzila-api-request-time',
    value: requestTime
});

pm.request.headers.add({
    key: 'X-tranzila-api-nonce',
    value: nonce
});

pm.request.headers.add({
    key: 'X-tranzila-api-access-token',
    value: accessToken
});

console.log('Authentication headers set');
console.log('Request Time:', requestTime);
console.log('Nonce:', nonce);
console.log('Access Token:', accessToken);
```

## Security Best Practices

1. **Never expose your secret key** in client-side code or public repositories
2. **Always use HTTPS** for API requests
3. **Implement rate limiting** on your server-side proxy
4. **Validate timestamps** - reject requests with timestamps too far in the past or future
5. **Store credentials securely** - use environment variables or secure vaults
6. **Rotate keys periodically** if Tranzila provides this functionality
7. **Log authentication attempts** for security monitoring
8. **Never commit keys to version control** - use `.gitignore` for `.env` files

## Testing Authentication

When testing your authentication implementation:

1. Verify all four headers are present in the request
2. Ensure the timestamp is current (within a reasonable time window)
3. Confirm the nonce is unique for each request (40 bytes / 80 hex characters)
4. Validate the access token is correctly generated using HMAC-SHA256
5. Test with invalid credentials to ensure proper error handling

## Common Issues

### Invalid Access Token
- Check that you're concatenating secret + requestTime + nonce correctly
- Verify you're using the correct hashing algorithm (HMAC-SHA256)
- Ensure the appKey is used as the message, not the key in the HMAC function

### Timestamp Rejection
- Make sure you're using Unix timestamp in seconds (not milliseconds)
- Verify your server time is synchronized

### Nonce Generation
- Must be a unique random string for each request
- Should be 40 bytes (typically generates 80 hex characters)
- Use cryptographically secure random generators

## Integration Example (Next.js API Route)

```typescript
// app/api/tranzila/payment/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const appKey = process.env.TRANZILA_APP_KEY!;
    const secret = process.env.TRANZILA_SECRET_KEY!;

    // Parse request body
    const body = await request.json();

    // Generate authentication headers
    const requestTime = Math.floor(Date.now() / 1000);
    const nonce = crypto.randomBytes(40).toString('hex');
    const message = secret + requestTime + nonce;
    const accessToken = crypto
      .createHmac('sha256', message)
      .update(appKey)
      .digest('hex');

    // Make request to Tranzila
    const response = await fetch('https://api.tranzila.com/v1/your-endpoint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-tranzila-api-app-key': appKey,
        'X-tranzila-api-request-time': requestTime.toString(),
        'X-tranzila-api-nonce': nonce,
        'X-tranzila-api-access-token': accessToken
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('Tranzila API Error:', error);
    return NextResponse.json(
      { error: 'Payment processing failed' },
      { status: 500 }
    );
  }
}
```

## Environment Variables Setup

Create a `.env.local` file (already ignored in `.gitignore`):

```bash
# Tranzila API Credentials
TRANZILA_APP_KEY=your_public_app_key_here
TRANZILA_SECRET_KEY=your_private_secret_key_here
```

**Never commit this file to version control!**
