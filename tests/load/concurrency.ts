import fetch from 'node-fetch';

const API_URL = 'http://localhost:3001';
const CONCURRENT_REQUESTS = 1000;
const PRODUCT_ID = 'test-product-id'; 

async function runConcurrencyTest() {
  console.log(`Starting concurrency test with ${CONCURRENT_REQUESTS} requests...`);
  
  const startTime = Date.now();
  
  // We simulate 1000 users attempting to reserve 1 quantity of the same item at the exact same time
  const requests = Array.from({ length: CONCURRENT_REQUESTS }).map(async (_, index) => {
    try {
      const response = await fetch(`${API_URL}/checkout/reserve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          productId: PRODUCT_ID,
          quantity: 1,
          userId: `simulated-user-${index}`
        })
      });
      
      const data = await response.json();
      return { status: response.status, data };
    } catch (error: any) {
      return { status: 500, data: { error: error.message } };
    }
  });

  const results = await Promise.all(requests);
  
  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;
  
  const successes = results.filter(r => r.status === 201);
  const conflicts = results.filter(r => r.status === 409);
  const errors = results.filter(r => r.status !== 201 && r.status !== 409);

  console.log(`Test completed in ${duration} seconds`);
  console.log('--- Results ---');
  console.log(`Total Requests: ${CONCURRENT_REQUESTS}`);
  console.log(`Successful Reservations (201): ${successes.length}`);
  console.log(`Sold Out / Conflicts (409): ${conflicts.length}`);
  console.log(`Other Errors: ${errors.length}`);
  
  if (successes.length > 1) {
    console.error('❌ FAIL: Overselling occurred!');
    process.exit(1);
  } else if (successes.length === 1) {
    console.log('✅ PASS: Exactly 1 item was sold, no overselling.');
  } else {
    console.log('⚠️ WARNING: 0 items were sold. This may indicate a problem or the inventory was already 0.');
  }
}

runConcurrencyTest();
