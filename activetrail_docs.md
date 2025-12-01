# ActiveTrail SMS API Documentation

## SMS Campaign

Create, edit, design, delete, schedule and send SMS campaigns.

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `api/smscampaign/Campaign?IsIncludeNotSent={IsIncludeNotSent}&FromDate={FromDate}&ToDate={ToDate}&SearchTerm={SearchTerm}&FilterType={FilterType}&Page={Page}&Limit={Limit}` | Get account's SMS campaigns (including operational SMS). You can get campaigns filtered by various parameters including dates and limited to a number of campaigns (you will get campaigns that were last updated in the last 3 months by default) |
| GET | `api/smscampaign/Campaign/{id}` | Get SMS campaign by id |
| PUT | `api/smscampaign/Campaign/{id}` | Update SMS campaign (whether it was sent or not). You can also send the updated campaign in the process |
| POST | `api/smscampaign/Campaign` | Create and return a new SMS campaign |
| GET | `api/smscampaign/Campaign/{id}/estimate` | Calculating the estimated number of messages for a given campaign. Can be used only for campaigns that were not sent yet |
| GET | `api/smscampaign/OperationalMessage/{id}` | Get SMS message by id |
| PUT | `api/smscampaign/OperationalMessage/{id}` | Update operational SMS messages. Only those who were not sent can be updated |
| POST | `api/smscampaign/OperationalMessage` | Create and return a new operational SMS message |

## Base URL

```
https://webapi.mymarketing.co.il/
```

## Authentication

Include the API key in the `Authorization` header:

```
Authorization: {API_KEY}
```

## Request Body Schema: Operational SMS

```json
{
  "details": {
    "unsubscribe_text": "sample string 1",
    "can_unsubscribe": true,
    "name": "sample string 3",
    "from_name": "sample string 4",
    "sms_sending_profile_id": 5,
    "content": "sample string 6"
  },
  "scheduling": {
    "send_now": true,
    "scheduled_date_utc": "2016-12-24T14:12:12"
  },
  "mobiles": [
    {
      "phone_number": "sample string 1"
    }
  ]
}
```

## Example: Send Operational SMS

```javascript
const response = await fetch('https://webapi.mymarketing.co.il/api/smscampaign/OperationalMessage', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': process.env.ACTIVETRAIL_API_KEY,
  },
  body: JSON.stringify({
    details: {
      name: 'SMS Campaign Name',
      from_name: 'SenderName',
      content: 'Your message here',
      can_unsubscribe: false,
    },
    scheduling: {
      send_now: true,
    },
    mobiles: [
      { phone_number: '972501234567' }
    ],
  }),
});
```
