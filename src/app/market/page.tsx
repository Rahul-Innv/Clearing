import type { Metadata } from "next";
import { MarketMap } from "@/components/MarketMap";

export const metadata: Metadata = {
  title: "Clearing — market map",
  description: "How the plan was found: every supplier checked and why it was kept or set aside. Demo suppliers · Local rules · Simulated orders.",
};

/** The market graph on its own page. All state comes from the same run hook the console uses. */
export default function MarketPage() {
  return <MarketMap />;
}
