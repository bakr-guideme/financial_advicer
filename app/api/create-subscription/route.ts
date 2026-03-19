import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";



export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const { email, priceId } = await req.json();

  // 1. Create customer
  const customer = await stripe.customers.create({ email });

  // 2. Create checkout session for subscription
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    customer: customer.id,
    success_url:
      "http://localhost:3002/payment/payment-success?session_id={CHECKOUT_SESSION_ID}",
    cancel_url: "http://localhost:3002/cancel",
  });

  console.log("session", session);
  return NextResponse.json({ url: session.url, sessionId: session.id });
}
