# PawCities Business Outreach Tool

Semi-automated email outreach for getting businesses to claim their PawCities listings.

## Setup

1. Ensure `RESEND_API_KEY` is set in your `.env.local`
2. Install dependencies: `npm install`
3. Prepare your prospect CSV (see template below)

## Usage

```bash
# Send outreach emails (dry-run by default)
npx tsx scripts/outreach/send-outreach.ts --csv prospects/la-restaurants.csv

# Send for real
npx tsx scripts/outreach/send-outreach.ts --csv prospects/la-restaurants.csv --send

# Send follow-ups (5+ days since initial, no reply)
npx tsx scripts/outreach/send-outreach.ts --csv prospects/la-restaurants.csv --send --followup
```

## CSV Format

```csv
businessName,contactName,contactEmail,city,category,listingUrl,alreadyListed
Dog Haus,John Smith,john@doghaus.com,Los Angeles,Restaurants,https://pawcities.com/cities/los-angeles/restaurants/dog-haus,true
```
