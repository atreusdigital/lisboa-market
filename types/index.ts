export type UserRole = 'director' | 'admin' | 'empleado'

export type Branch = {
  id: string
  name: string
  address: string
  created_at: string
}

export type Profile = {
  id: string
  full_name: string
  email: string
  role: UserRole
  branch_id: string | null
  branch_ids?: string[]
  avatar_url: string | null
  created_at: string
  branch?: Branch
}

export type Category = {
  id: string
  name: string
}

export type Product = {
  id: string
  name: string
  category: string
  subcategory: string | null
  barcode: string | null
  cost_price: number
  sell_price: number
  pedidos_ya_price: number
  rappi_price: number
  family_id: string | null
  sell_price_updated_at: string | null
  sell_price_updated_by: string | null
  cost_updated_at: string | null
  cost_updated_by: string | null
  image_url: string | null
  is_star: boolean
  created_at: string
}

export type ProductFamily = {
  id: string
  name: string
  description: string | null
  color: string
  created_at: string
}

export type PromotionType = 'tiered_discount' | 'nx_for_y'

export type TieredDiscountRule = { quantity: number; discount_pct: number }
export type NxForYRule = { buy: number; pay: number }

export type Promotion = {
  id: string
  name: string
  type: PromotionType
  is_active: boolean
  rules: TieredDiscountRule[] | NxForYRule[]
  created_at: string
  products?: Product[]
}

export type Stock = {
  id: string
  product_id: string
  branch_id: string
  quantity: number
  min_quantity: number
  updated_at: string
  product?: Product
  branch?: Branch
}

export type PaymentMethod = 'mercadopago' | 'efectivo'

export type Sale = {
  id: string
  branch_id: string
  user_id: string
  total: number
  payment_method: PaymentMethod
  mp_payment_id: string | null
  created_at: string
  branch?: Branch
  user?: Profile
  items?: SaleItem[]
}

export type SaleItem = {
  id: string
  sale_id: string
  product_id: string
  quantity: number
  unit_price: number
  product?: Product
}

export type Supplier = {
  id: string
  name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  created_at: string
}

export type OrderStatus = 'pending' | 'received' | 'confirmed' | 'cancelled'

export type SupplierOrder = {
  id: string
  supplier_id: string
  branch_id: string
  user_id: string
  status: OrderStatus
  total: number
  delivery_photo_url: string | null
  notes: string | null
  created_at: string
  supplier?: Supplier
  branch?: Branch
  user?: Profile
  items?: SupplierOrderItem[]
}

export type SupplierOrderItem = {
  id: string
  order_id: string
  product_id: string
  quantity_ordered: number
  quantity_received: number
  unit_price: number
  product?: Product
}

export type AccountPayable = {
  id: string
  supplier_id: string
  branch_id: string
  balance: number
  updated_at: string
  supplier?: Supplier
  branch?: Branch
}

export type Payment = {
  id: string
  account_id: string
  amount: number
  method: string
  status: 'pending' | 'completed' | 'failed'
  notes: string | null
  created_at: string
  confirmed_by: string | null
}

export type AlertType =
  | 'low_stock'
  | 'high_demand_low_stock'
  | 'stagnant_product'
  | 'payment_due'
  | 'cash_anomaly'

export type Alert = {
  id: string
  type: AlertType
  product_id: string | null
  branch_id: string
  message: string
  status: 'active' | 'resolved'
  created_at: string
  resolved_at: string | null
  product?: Product
  branch?: Branch
}

export type ActivityLog = {
  id: string
  user_id: string
  action: string
  entity_type: string
  entity_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  user?: Profile
}

export type CartItem = {
  product: Product
  quantity: number
  stock_available: number
}

export type DashboardStats = {
  total_sales_today: number
  total_revenue_today: number
  low_stock_count: number
  active_alerts: number
  pending_orders: number
}

export type ShiftStatus = 'open' | 'closed'

export type Shift = {
  id: string
  branch_id: string
  user_id: string
  opened_at: string
  closed_at: string | null
  opening_cash: number
  closing_cash: number | null
  total_sales: number
  notes: string | null
  status: ShiftStatus
  user?: Profile
  branch?: Branch
}

export type CashClosing = {
  id: string
  branch_id: string
  user_id: string
  shift_id: string | null
  date: string
  expected_cash: number
  actual_cash: number
  difference: number
  notes: string | null
  created_at: string
  user?: Profile
}

export type ExpenseCategory = 'electricidad' | 'limpieza' | 'delivery' | 'sueldo' | 'mantenimiento' | 'marketing' | 'otros'

export type Expense = {
  id: string
  branch_id: string
  user_id: string
  category: ExpenseCategory
  description: string
  amount: number
  date: string
  created_at: string
  user?: Profile
}

export type PriceHistory = {
  id: string
  product_id: string
  old_cost_price: number | null
  new_cost_price: number | null
  old_sell_price: number | null
  new_sell_price: number | null
  changed_by: string | null
  created_at: string
  product?: Product
  user?: Profile
}
