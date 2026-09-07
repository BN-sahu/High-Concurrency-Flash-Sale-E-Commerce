import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

// Custom metrics
const successfulReservations = new Counter('successful_reservations');
const failedReservations = new Counter('failed_reservations');
const errorRate = new Rate('error_rate');

export const options = {
  scenarios: {
    flash_sale_rush: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 500 }, // Ramp up to 500 users
        { duration: '1m', target: 1000 },  // Ramp up to 1000 users (the flash sale spike)
        { duration: '30s', target: 0 },   // Cool down
      ],
    },
  },
  thresholds: {
    // 95% of requests should complete within 200ms
    http_req_duration: ['p(95)<200'],
    // We expect a high error rate for reservations because inventory is limited,
    // so we don't set a hard threshold on error_rate here, but we track it.
    // However, server errors (5xx) should be zero.
  },
};

const API_BASE_URL = __ENV.API_URL || 'http://localhost:3001/api/v1';

// Setup phase: run once before the VUs start
export function setup() {
  // 1. Create a test user for auth (or use a shared test token)
  // For simplicity in load testing, we might assume a bypass token or create one
  // In a real scenario, you'd seed users and authenticate them, or mock auth for load tests.
  
  // Here we assume the API accepts a test user token for load testing purposes
  const testToken = __ENV.TEST_TOKEN || 'test-jwt-token';
  
  // 2. We need a product ID with limited inventory (e.g., 50 items)
  const productId = __ENV.PRODUCT_ID || 'test-product-id';

  return { token: testToken, productId };
}

// VU Code: run repeatedly by each virtual user
export default function (data) {
  const { token, productId } = data;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    // Unique idempotency key per VU attempt
    'X-Idempotency-Key': `k6-req-${__VU}-${__ITER}`,
  };

  const payload = JSON.stringify({
    productId: productId,
    quantity: 1,
    idempotencyKey: `k6-req-${__VU}-${__ITER}`,
  });

  // Attempt to reserve the item
  const res = http.post(`${API_BASE_URL}/checkout/reserve`, payload, { headers });

  // Track outcomes
  const isSuccess = res.status === 200 && res.json('success') === true;
  const isInventoryError = res.status === 409; // Insufficient inventory
  const isServerError = res.status >= 500;

  if (isSuccess) {
    successfulReservations.add(1);
  } else if (isInventoryError) {
    failedReservations.add(1); // Expected failures once inventory is gone
  } else {
    errorRate.add(1);
  }

  if (isServerError) {
    console.error(`Server error: ${res.status} - ${res.body}`);
  }

  check(res, {
    'is status 200 or 409': (r) => r.status === 200 || r.status === 409,
    'is not 5xx': (r) => r.status < 500,
  });

  // Short sleep to simulate user think time before retrying if failed
  // For a flash sale, users spam the button, so sleep is very short
  sleep(Math.random() * 0.5);
}
