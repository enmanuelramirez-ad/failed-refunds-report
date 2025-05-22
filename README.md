# Failed Refunds Report

This Node.js script generates a CSV report of failed or initial refund transactions from Commercetools payments within a given date range. It matches these transactions with related orders (if available) and outputs the data into a CSV file for further analysis.

---

## 📦 Features

- Connects to the Commercetools API using client credentials.
- Fetches payments with refund transactions in `Initial` or `Failure` state.
- Matches each payment to its related order (if any).
- Outputs results to a CSV file (`refunds.csv`).
- Processes data day by day to avoid timeouts and rate limits.

---

## 🛠 Requirements

- Node.js ≥ 18.x (due to native ES modules and `node-fetch` v3)
- A Commercetools project with API credentials

---

## 📁 Project Structure

```
.
├── index.js            # Main script
├── .env.example        # Environment variable template
├── refunds.csv         # Output file (generated)
└── package.json        # Dependencies
```

---

## 🔧 Setup

### 1. Clone the repository

```bash
git clone https://github.com/enmanuelramirez-ad/failed-refunds-report.git
cd failed-refunds-report
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file based on the provided `.env.example`:

```env
CT_PROJECT_KEY=your-project-key
CT_CLIENT_ID=your-client-id
CT_CLIENT_SECRET=your-client-secret
CT_AUTH_URL=https://auth.europe-west1.gcp.commercetools.com
CT_API_URL=https://api.europe-west1.gcp.commercetools.com
```

Make sure the values match your Commercetools project settings and region.

---

## 🕒 Set Date Range

Open `index.js` and update the following variables to set your desired date range:

```js
const startDate = new Date("2025-05-22T00:00:00Z"); // ← Update this
const endDate = new Date("2025-05-23T00:00:00Z"); // ← And this
```

Make sure the `endDate` is exclusive, meaning it won't include data for that full day.

---

## ▶️ Run the Script

```bash
node index.js
```

The script will:

- Process payments day by day from your defined `startDate` to `endDate`.
- Wait 1 minute between days to avoid rate limits.
- Create or update `refunds.csv` with the matching records.

---

## 📄 Output Format (`refunds.csv`)

| paymentId | transactionId | transactionTimestamp | transactionState  | orderId | orderNumber |
| --------- | ------------- | -------------------- | ----------------- | ------- | ----------- |
| …         | …             | …                    | Initial / Failure | …       | …           |

---

## 🧠 Notes

- You must manually set the desired `startDate` and `endDate` in `index.js` before running the script.
- The script uses throttling (`sleep()`) to avoid hitting Commercetools API rate limits.
- Payments are sorted by `lastModifiedAt` to ensure correct pagination.
