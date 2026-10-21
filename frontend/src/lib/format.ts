// Display helpers. Money is rendered in INR with Indian digit grouping and
// sessions are shown in Asia/Kolkata, matching the product's market context.
export function formatInr(value: string | number): string {
  const text = String(value)
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return "—"
  const [whole, fraction = ""] = text.split(".")
  return `₹${BigInt(whole).toLocaleString("en-IN")}.${fraction.padEnd(2, "0")}`
}

export function formatQty(value: string): string {
  const [whole, fraction = ""] = value.split(".")
  const trimmed = fraction.replace(/0+$/, "")
  return BigInt(whole).toLocaleString("en-IN") + (trimmed ? `.${trimmed}` : "")
}

export function formatDateTime(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  })
}
