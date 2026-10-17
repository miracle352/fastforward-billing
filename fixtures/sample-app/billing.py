"""Intentionally incomplete sample integration, not a claimed production discovery."""


def handle_event(event, db, stripe_get):
    # This common mistake acknowledges updates but never applies them to access.
    if event.get("type") != "customer.subscription.created":
        return
    subscription = event["data"]["object"]
    customer = subscription["customer"]
    if isinstance(customer, dict):
        customer = customer["id"]
    access = int(subscription.get("status") in ("active", "trialing"))
    db.execute(
        "INSERT INTO access(customer_id, subscription_id, allowed) VALUES (?,?,?) "
        "ON CONFLICT(customer_id) DO UPDATE SET subscription_id=excluded.subscription_id, allowed=excluded.allowed",
        (customer, subscription["id"], access),
    )
