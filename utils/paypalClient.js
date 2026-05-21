const paypal = require('@paypal/checkout-server-sdk');

function environment() {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (process.env.PAYPAL_MODE === 'live') {
        return new paypal.core.LiveEnvironment(clientId, clientSecret);
    }
    return new paypal.core.SandboxEnvironment(clientId, clientSecret);
}

function client() {
    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) return null;
    return new paypal.core.PayPalHttpClient(environment());
}

const PAYPAL_MIN_USD = 0.50;

async function createOrder(amount) {
    const paypalClient = client();
    if (!paypalClient) return null;

    const usdValue = (Number(amount) / 4000);
    if (usdValue < PAYPAL_MIN_USD) return null;

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
        intent: 'CAPTURE',
        purchase_units: [{
            amount: {
                currency_code: 'USD',
                value: usdValue.toFixed(2)
            },
            description: 'Pago de arriendo RentUp'
        }]
    });

    const order = await paypalClient.execute(request);
    return order.result;
}

async function captureOrder(orderId) {
    const paypalClient = client();
    if (!paypalClient) return null;

    const request = new paypal.orders.OrdersCaptureRequest(orderId);
    request.requestBody({});

    const capture = await paypalClient.execute(request);
    return capture.result;
}

module.exports = { createOrder, captureOrder, client };
