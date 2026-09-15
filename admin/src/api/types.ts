/** Shapes returned by functions/lib/orders.js, billing.js and notifications.js. */
export interface Delivery { id: number; order_ref: string; kind: string; scheduled_date: string; status: string; note: string | null; delivered_at: string | null; reminder_sent_at: string | null; created_at: string; updated_at: string }

export interface Order {
  ref: string; status: string; kit: string; items: string[]; addons: { id: string; n: number; price: number }[]
  currency: string; kitTotal: number; addonsTotal: number; discount: number; total: number; deposit: number; balance: number
  depositStatus: string; depositMethod: string | null; depositPaymentId: string | null; depositPaidAt: string | null
  balanceStatus: string; balanceMethod: string | null; balancePaymentId: string | null; balancePaidAt: string | null
  referral: string | null; referralCredit: number; storageInterest: boolean
  uni: string | null; halls: string | null; building: string | null; arrival: string
  name: string; email: string; phone: string | null; from: string | null; notes: string | null; lang: string | null
  adminNotes: string | null; cancelledAt: string | null; cancelReason: string | null
  data: Record<string, unknown>; createdAt: string; updatedAt: string
  deliveries: Delivery[]; openDeliveries?: number
}

export interface OrderEvent { id: number; activity: string; user_id: string | null; origin_ip: string | null; origin_country: string | null; method: string | null; payload: Record<string, unknown>; created_at: string }
export interface Notification { id: number; event: string; recipient: string; subject: string; order_ref?: string | null; status: string; error_message: string | null; body_text?: string | null; sent_at: string | null; created_at: string }
export interface Payment { id: number; ref: string; kind: 'deposit' | 'balance' | 'refund'; amount: number; currency: string; method: string | null; provider: string; providerRef: string | null; refundOf: string | null; note: string | null; userId: string | null; createdAt: string; name?: string; email?: string; halls?: string; orderStatus?: string }
export interface Invoice { id: number; number: string; ref: string; type: 'invoice' | 'credit_note'; amount: number; currency: string; issuedAt: string; name: string; email: string; total?: number; outstanding?: number; data?: InvoiceData }
export interface InvoiceData { business: Record<string, string>; customer: Record<string, string>; order: Record<string, string>; lines: { description: string; qty: number; unit: number; amount: number }[]; total: number; paid: number; outstanding: number; payments: Payment[]; reason: string | null }

export interface OrderDetail extends Order { events: OrderEvent[]; notifications: Notification[]; payments: Payment[]; invoices: Invoice[] }

export interface RunRow {
  id: number; ref: string; kind: string; date: string; status: string; note: string | null; deliveredAt: string | null; reminderSentAt: string | null
  name: string; phone: string | null; email: string; kit: string; items: string[]; addons: { id: string; n: number; price: number }[]; halls: string; building: string | null; uni: string | null
  notes: string | null; total: number; deposit: number; depositStatus: string; balance: number; balanceStatus: string; orderStatus: string; lang: string | null; contents: string[]
}

export interface Stats {
  orders: number; live: number; cancelled: number; depositsPaid: number; depositsValue: number; bookedValue: number; balanceCollected: number; storageInterest: number; referred: number
  goNoGo: { target: number; targetDate: string; paid: number; pct: number; daysLeft: number }
  byStatus: { status: string; n: number }[]; byKit: { kit: string; n: number; value: number }[]; byHalls: { halls: string; n: number }[]
  byWeek: { week: string; n: number; paid: number }[]; arrivals: { date: string; n: number }[]; upcoming: { date: string; kind: string; n: number }[]
  notifications: { sent: number; failed: number; skipped: number }
}

export interface BillingSummary {
  deposits: { value: number; n: number }; balances: { value: number; n: number }; refunds: { value: number; n: number }
  taken: number; net: number; booked: number
  outstanding: { balance: number; balanceN: number; deposits: number; depositsN: number }
  byMethod: { method: string; kind: string; n: number; value: number }[]
  byWeek: { week: string; starts: string; taken: number; refunded: number }[]
  invoices: { invoices: number; creditNotes: number }
}

export interface Template { id: string; event: string; subject: string; body_html: string; body_text: string | null; enabled: boolean; updated_at?: string }
export interface Preview { to: string; sample: boolean; subject: string; html: string; text: string }
export interface LogRow { id: number; severity: string; type: string; message: string; metadata: Record<string, unknown>; source: string | null; created_at: string }
