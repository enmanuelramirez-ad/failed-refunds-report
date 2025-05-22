import 'dotenv/config'
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { createClient } from "@commercetools/sdk-client";
import { createAuthMiddlewareForClientCredentialsFlow } from "@commercetools/sdk-middleware-auth";
import { createHttpMiddleware } from "@commercetools/sdk-middleware-http";
import { createApiBuilderFromCtpClient } from "@commercetools/platform-sdk";
import { fileURLToPath } from "url";
import { dirname } from "path";

// ---- Path setup for ES Modules ----
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---- Config ----
const projectKey = process.env.CT_PROJECT_KEY;
const clientId = process.env.CT_CLIENT_ID;
const clientSecret = process.env.CT_CLIENT_SECRET;
const authUrl = process.env.CT_AUTH_URL;
const apiUrl = process.env.CT_API_URL;
const startDate = new Date("2025-05-22T00:00:00Z");
const endDate = new Date("2025-05-23T00:00:00Z");
const outputFile = path.resolve(__dirname, "refunds.csv");
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const formatDate = (date) => date.toISOString().split("T")[0];

// ---- Init client ----
console.log("Initializing commercetools client...");
const client = createClient({
  middlewares: [
    createAuthMiddlewareForClientCredentialsFlow({
      host: authUrl,
      projectKey,
      credentials: { clientId, clientSecret },
      fetch,
    }),
    createHttpMiddleware({ host: apiUrl, fetch }),
  ],
});

const apiRoot = createApiBuilderFromCtpClient(client).withProjectKey({
  projectKey,
});

const writeCSV = (rows) => {
  const headers = [
    "paymentId",
    "transactionId",
    "transactionTimestamp",
    "transactionState",
    "orderId",
    "orderNumber",
  ];
  const csvLines = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((h) => `"${(row[h] || "").replace(/"/g, '""')}"`).join(",")
    ),
  ];
  fs.writeFileSync(outputFile, csvLines.join("\n"), "utf-8");
  console.log(`📄 CSV saved to: ${outputFile}`);
};

const processDay = async (dayStart, dayEnd) => {
  const limit = 100;
  const results = [];
  let hasMore = true;
  let lastSeenDate = dayStart.toISOString();

  console.log(
    `\n📅 Processing day: ${formatDate(dayStart)} to ${formatDate(dayEnd)}`
  );

  while (hasMore) {
    console.log(`Fetching payments modified after ${lastSeenDate}...`);

    const paymentsRes = await apiRoot
      .payments()
      .get({
        queryArgs: {
          limit,
          sort: "lastModifiedAt asc",
          where: `lastModifiedAt >= "${lastSeenDate}" and lastModifiedAt <= "${dayEnd.toISOString()}"`,
        },
      })
      .execute();

    const payments = paymentsRes.body.results;
    console.log(`→ Retrieved ${payments.length} payments`);

    if (payments.length === 0) {
      hasMore = false;
      break;
    }

    for (const [i, payment] of payments.entries()) {
      console.log(
        `  ↪ Checking payment ${i + 1}/${payments.length}: ${payment.id}`
      );

      const refundTx = payment.transactions?.find(
        (tx) =>
          tx.type === "Refund" &&
          (tx.state === "Initial" || tx.state === "Failure") &&
          tx.timestamp &&
          new Date(tx.timestamp) >= dayStart &&
          new Date(tx.timestamp) <= dayEnd
      );

      if (refundTx) {
        console.log(
          `    ⚠ Found refund transaction (${refundTx.state}): ${refundTx.id}`
        );

        await sleep(3000);

        const ordersRes = await apiRoot
          .orders()
          .get({
            queryArgs: {
              where: `paymentInfo(payments(id="${payment.id}"))`,
            },
          })
          .execute();

        const order = ordersRes.body.results?.[0];

        if (order) {
          console.log(`    ✅ Matched to order ${order.orderNumber}`);
        } else {
          console.log(`    ❌ No order found for this payment`);
        }

        results.push({
          paymentId: payment.id,
          transactionId: refundTx.id,
          transactionTimestamp: refundTx.timestamp || "",
          transactionState: refundTx.state || "",
          orderId: order?.id || "",
          orderNumber: order?.orderNumber || "",
        });
      }
    }

    // Update cursor for next iteration
    const lastPayment = payments[payments.length - 1];
    lastSeenDate = new Date(lastPayment.lastModifiedAt).toISOString();

    hasMore = payments.length === limit;
    if (hasMore) {
      console.log(`🔄 Waiting before next batch...`);
      await sleep(3000);
    }
  }

  return results;
};

const findRefunds = async () => {
  const allResults = [];

  for (
    let day = new Date(startDate);
    day < endDate;
    day = new Date(day.getTime() + DAY_IN_MS)
  ) {
    const nextDay = new Date(day.getTime() + DAY_IN_MS);
    const dailyResults = await processDay(day, nextDay);
    allResults.push(...dailyResults);

    // Save CSV after each day's processing
    writeCSV(allResults);

    // Wait 1 minute before the next day
    if (nextDay < endDate) {
      console.log(`⏳ Waiting 1 minute before next day...`);
      await sleep(1 * 60 * 1000);
    }
  }

  console.log(`\n✅ All days processed. Total records: ${allResults.length}`);
};

findRefunds().catch((err) => {
  console.error("❌ Error:", err.message);
  console.error(err);
});
