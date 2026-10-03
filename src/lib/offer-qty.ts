/**
 * Buyer-safe quantity helpers for an offer. Pure functions of the offer itself:
 * they never read seller policy, so both the buyer's ask and the seller's reply
 * can name the same number.
 */
import type { Offer } from "./contracts";

type OfferQtyInput = Pick<Offer, "group" | "lines">;

/** The quantity volume tiers are measured against: meals, drink servings, or one delivery. */
export function primaryQty(o: OfferQtyInput): number {
  if (o.group === "meals") return o.lines.filter((l) => l.kind === "meal_vegetarian" || l.kind === "meal_standard").reduce((s, l) => s + l.qty, 0);
  if (o.group === "drinks_consumables") return o.lines.filter((l) => l.kind === "drink_serving").reduce((s, l) => s + l.qty, 0);
  return 1;
}

/** Plain-words unit for primaryQty, e.g. "meals" or "drink servings". */
export function primaryUnit(o: Pick<Offer, "group">, qty: number): string {
  const one = qty === 1;
  if (o.group === "meals") return one ? "meal" : "meals";
  if (o.group === "drinks_consumables") return one ? "drink serving" : "drink servings";
  return one ? "delivery" : "deliveries";
}
