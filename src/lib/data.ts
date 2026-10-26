export type FieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'timestamp'
  | 'boolean'
  | 'time'
  | 'container'
  | 'json'
  | 'unknown'
export type Field = {
  name: string
  type: FieldType
  description: string
  required?: boolean
  key?: boolean
  reference?: string
  auto?: boolean
  nativeType?: string
  nullable?: boolean
  unique?: boolean
  indexed?: boolean
  global?: boolean
  repetitions?: number
}
export type DataRow = Record<string, unknown>
export type Entity = {
  name: string
  description: string
  fields: Field[]
  rows: DataRow[]
  count?: number | null
  endpoint?: string
  source?: string
  raw?: unknown
  warning?: string
  kind?: 'layout' | 'entity-set'
}
export type Protocol = 'Data API' | 'OData'
export type Profile = {
  id: string
  name: string
  database: string
  host: string
  protocol: Protocol
  sample?: boolean
  lab?: boolean
  apiVersion?: string
}
export type Page =
  | 'overview'
  | 'schema'
  | 'records'
  | 'relationships'
  | 'query'
  | 'developer'
  | 'ai'
  | 'requests'

const field = (
  name: string,
  type: FieldType,
  description: string,
  extra: Partial<Field> = {},
): Field => ({ name, type, description, ...extra })
const names = [
  'Olivia Chen',
  'James Wilson',
  'Sofia Martinez',
  'Noah Williams',
  'Emma Thompson',
  'Liam Anderson',
  'Ava Patel',
  'Oliver Brown',
  'Isabella Davis',
  'Ethan Kim',
  'Mia Robinson',
  'Lucas Garcia',
  'Amelia Lewis',
  'Henry Walker',
  'Charlotte Lee',
  'Leo Wright',
  'Harper Hall',
  'Aria Young',
]
const companies = [
  'Forma Studio',
  'Orbit Labs',
  'Kinfolk & Co.',
  'Meridian',
  'Fieldwork',
  'Assembly',
  'Good People',
  'Outline',
  'Parallel',
  'Common Ground',
  'Waypoint',
  'Evergreen',
  'Sunday Supply',
  'Baseline',
  'Kindred',
  'Offscript',
  'New Chapter',
  'Daybreak',
]
export const entities: Entity[] = [
  {
    name: 'Customers',
    description: 'The people and companies behind every order.',
    fields: [
      field(
        'CustomerID',
        'text',
        'Unique identifier for each customer. Automatically assigned when a customer is created.',
        { key: true, required: true, auto: true },
      ),
      field('FullName', 'text', 'The customer’s full display name.', {
        required: true,
      }),
      field(
        'Email',
        'text',
        'Primary email address for customer communication.',
        { required: true },
      ),
      field(
        'Company',
        'text',
        'The company or organization this customer belongs to.',
      ),
      field(
        'Status',
        'text',
        'Customer lifecycle status: Active, Pending, or Inactive.',
        { required: true },
      ),
      field('Country', 'text', 'The customer’s country of residence.'),
      field(
        'TotalOrders',
        'number',
        'Number of orders associated with this customer.',
      ),
      field(
        'LifetimeValue',
        'number',
        'Total value of customer orders in USD.',
      ),
      field('JoinedAt', 'date', 'Date this customer was first registered.', {
        auto: true,
      }),
      field(
        'IsActive',
        'boolean',
        'Whether this customer is currently active.',
      ),
    ],
    rows: names.map((name, i) => ({
      CustomerID: `CUS-${String(i + 1).padStart(4, '0')}`,
      FullName: name,
      Email: name.toLowerCase().replace(' ', '.') + '@example.com',
      Company: companies[i],
      Status: i % 7 === 3 ? 'Inactive' : i % 5 === 2 ? 'Pending' : 'Active',
      Country: ['United States', 'Canada', 'United Kingdom', 'Australia'][
        i % 4
      ],
      TotalOrders: (i * 3 + 2) % 17,
      LifetimeValue: Math.round((i * 183.8 + 240) * 100) / 100,
      JoinedAt: `2026-${String((i % 9) + 1).padStart(2, '0')}-${String((i % 24) + 1).padStart(2, '0')}`,
      IsActive: i % 7 !== 3,
    })),
  },
  {
    name: 'Orders',
    description: 'Customer orders, totals, and fulfillment status.',
    fields: [
      field('OrderID', 'text', 'Unique order identifier.', {
        key: true,
        required: true,
      }),
      field('CustomerID', 'text', 'Customer who placed this order.', {
        reference: 'Customers',
        required: true,
      }),
      field('OrderDate', 'date', 'Date the order was placed.'),
      field('Status', 'text', 'Current fulfillment status.'),
      field('Total', 'number', 'Order total in USD.'),
      field('Currency', 'text', 'Three-letter currency code.'),
      field('Notes', 'text', 'Additional order notes.'),
    ],
    rows: Array.from({ length: 24 }, (_, i) => ({
      OrderID: `ORD-${1001 + i}`,
      CustomerID: `CUS-${String((i % 18) + 1).padStart(4, '0')}`,
      OrderDate: `2026-10-${String(i + 1).padStart(2, '0')}`,
      Status: ['Delivered', 'Processing', 'Shipped'][i % 3],
      Total: 120 + i * 49,
      Currency: 'USD',
      Notes: i % 3 ? '' : 'Leave at reception',
    })),
  },
  {
    name: 'OrderItems',
    description: 'Individual products and quantities within an order.',
    fields: [
      field('ItemID', 'text', 'Unique line item identifier.', {
        key: true,
        required: true,
      }),
      field('OrderID', 'text', 'The parent order.', {
        reference: 'Orders',
        required: true,
      }),
      field('ProductID', 'text', 'The purchased product.', {
        reference: 'Products',
        required: true,
      }),
      field('Quantity', 'number', 'Number of units.'),
      field('UnitPrice', 'number', 'Price per unit in USD.'),
      field('Subtotal', 'number', 'Quantity multiplied by unit price.'),
    ],
    rows: Array.from({ length: 32 }, (_, i) => ({
      ItemID: `ITEM-${i + 1}`,
      OrderID: `ORD-${1001 + (i % 24)}`,
      ProductID: `PRD-${(i % 8) + 1}`,
      Quantity: (i % 3) + 1,
      UnitPrice: 25 + (i % 8) * 15,
      Subtotal: ((i % 3) + 1) * (25 + (i % 8) * 15),
    })),
  },
  {
    name: 'Products',
    description: 'Your product catalog, pricing, and inventory.',
    fields: [
      field('ProductID', 'text', 'Unique product identifier.', {
        key: true,
        required: true,
      }),
      field('Name', 'text', 'Product display name.', { required: true }),
      field('SKU', 'text', 'Stock keeping unit.'),
      field('Category', 'text', 'Product category.'),
      field('Price', 'number', 'Current unit price in USD.'),
      field('Stock', 'number', 'Available inventory.'),
      field('IsActive', 'boolean', 'Whether the product is available.'),
    ],
    rows: [
      'Everyday Notebook',
      'Studio Desk Mat',
      'Arc Table Light',
      'Canvas Tote',
      'Ceramic Mug',
      'Focus Timer',
      'Desk Organizer',
      'Weekly Planner',
    ].map((name, i) => ({
      ProductID: `PRD-${i + 1}`,
      Name: name,
      SKU: `NS-${100 + i}`,
      Category: ['Stationery', 'Workspace', 'Lighting', 'Accessories'][i % 4],
      Price: 25 + i * 15,
      Stock: 12 + i * 7,
      IsActive: i !== 6,
    })),
  },
  {
    name: 'Invoices',
    description: 'Billing documents and payment tracking.',
    fields: [
      field('InvoiceID', 'text', 'Unique invoice identifier.', {
        key: true,
        required: true,
      }),
      field('OrderID', 'text', 'Order this invoice covers.', {
        reference: 'Orders',
        required: true,
      }),
      field('Amount', 'number', 'Total amount due in USD.'),
      field('DueDate', 'date', 'Payment due date.'),
      field('Status', 'text', 'Payment status.'),
      field('PaidAt', 'timestamp', 'Timestamp of payment, if paid.'),
    ],
    rows: Array.from({ length: 12 }, (_, i) => ({
      InvoiceID: `INV-${2001 + i}`,
      OrderID: `ORD-${1001 + i}`,
      Amount: 120 + i * 49,
      DueDate: `2026-11-${String(i + 1).padStart(2, '0')}`,
      Status: i % 3 ? 'Paid' : 'Pending',
      PaidAt: i % 3 ? '2026-10-20T14:30:00Z' : '',
    })),
  },
  {
    name: 'Contacts',
    description: 'Additional people connected to customer accounts.',
    fields: [
      field('ContactID', 'text', 'Unique contact identifier.', {
        key: true,
        required: true,
      }),
      field('CustomerID', 'text', 'Associated customer.', {
        reference: 'Customers',
        required: true,
      }),
      field('FullName', 'text', 'Contact’s full name.'),
      field('Email', 'text', 'Contact’s work email.'),
      field('Role', 'text', 'Role within the customer’s organization.'),
      field('IsPrimary', 'boolean', 'Whether this is the primary contact.'),
    ],
    rows: names.slice(0, 10).map((name, i) => ({
      ContactID: `CON-${i + 1}`,
      CustomerID: `CUS-${String(i + 1).padStart(4, '0')}`,
      FullName: name,
      Email: `contact${i + 1}@example.com`,
      Role: ['Operations', 'Finance', 'Owner'][i % 3],
      IsPrimary: i % 2 === 0,
    })),
  },
]

export const relationships = entities.flatMap((entity) =>
  entity.fields
    .filter((f) => f.reference)
    .map((f) => ({
      source: f.reference!,
      target: entity.name,
      field: f.name,
      label: '1 : many',
    })),
)
export const totalFields = entities.reduce((sum, e) => sum + e.fields.length, 0)
export const totalRecords = entities.reduce((sum, e) => sum + e.rows.length, 0)
export const sampleProfiles: Profile[] = [
  {
    id: 'sample-data',
    name: 'Northstar CRM',
    database: 'Northstar_CRM',
    host: 'Bundled sample solution',
    protocol: 'Data API',
    sample: true,
  },
  {
    id: 'sample-odata',
    name: 'Northstar OData',
    database: 'Northstar_CRM',
    host: 'Bundled sample solution',
    protocol: 'OData',
    sample: true,
  },
]

export function loadProfiles(): Profile[] {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem('fm-explorer-profiles') ?? '[]',
    )
    if (!Array.isArray(parsed)) return sampleProfiles
    const valid = parsed
      .filter(
        (p): p is Profile =>
          !!p &&
          typeof p === 'object' &&
          typeof p.id === 'string' &&
          typeof p.name === 'string' &&
          typeof p.database === 'string' &&
          typeof p.host === 'string' &&
          (p.protocol === 'Data API' || p.protocol === 'OData'),
      )
      .map((p) => ({ ...p, sample: false }))
    return [...sampleProfiles, ...valid]
  } catch {
    return sampleProfiles
  }
}
