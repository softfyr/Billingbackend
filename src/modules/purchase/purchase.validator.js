import { z } from 'zod';

export const createPurchaseInvoiceSchema = z.object({
  body: z.object({
    supplierId: z.string({ required_error: 'Supplier ID is required.' }).trim().min(1, 'Supplier ID cannot be empty.'),
    supplierInvoiceNumber: z.string().optional().nullable(),
    invoiceDate: z.string().optional().nullable(),
    dueDate: z.string().optional().nullable(),
    paymentTerms: z.string().optional().nullable(),
    purchaseType: z.string().optional().default('Local Purchase'),
    bankAccount: z.string().optional().nullable(),
    referenceNumber: z.string().optional().nullable(),
    attachments: z.array(z.string()).optional().nullable(),
    notes: z.string().optional().nullable(),
    purchaseStatus: z.enum(['DRAFT', 'CONFIRMED']).optional().default('CONFIRMED'),
    items: z.array(
      z.object({
        productId: z.string().trim().optional().nullable(),
        newProductData: z.record(z.any()).optional().nullable(),
        productData: z.record(z.any()).optional().nullable(),
        unit: z.string().optional().default('Nos'),
        quantity: z.number({ required_error: 'Quantity is required.' })
          .positive('Quantity must be greater than zero.')
          .or(z.string().transform(val => parseInt(val)).refine(val => !isNaN(val) && val > 0, { message: 'Quantity must be a positive integer.' })),
        unitPurchasePrice: z.number({ required_error: 'Unit purchase price is required.' })
          .nonnegative('Unit purchase price cannot be negative.')
          .or(z.string().transform(val => parseFloat(val)).refine(val => !isNaN(val) && val >= 0, { message: 'Unit purchase price must be a non-negative number.' })),
        discountPercent: z.number().nonnegative().max(100).optional().default(0),
        discountAmount: z.number().nonnegative().optional().default(0),
        taxPercent: z.number().nonnegative().max(100, 'Tax percentage cannot exceed 100%.').optional().default(0)
      })
    ).min(1, 'At least one purchase line item is required.'),
    subtotal: z.number().optional(),
    discountAmount: z.number().nonnegative().optional().default(0),
    cgstAmount: z.number().nonnegative().optional().default(0),
    sgstAmount: z.number().nonnegative().optional().default(0),
    igstAmount: z.number().nonnegative().optional().default(0),
    otherCharges: z.number().optional().default(0),
    roundOff: z.number().optional().default(0),
    paidAmount: z.number().nonnegative().optional().default(0),
    paymentMethod: z.string().optional().default('CASH')
  }).passthrough()
});

export const updatePurchaseInvoiceSchema = z.object({
  body: z.object({
    supplierId: z.string().trim().min(1).optional(),
    supplierInvoiceNumber: z.string().optional().nullable(),
    invoiceDate: z.string().optional().nullable(),
    dueDate: z.string().optional().nullable(),
    paymentTerms: z.string().optional().nullable(),
    purchaseType: z.string().optional().nullable(),
    bankAccount: z.string().optional().nullable(),
    referenceNumber: z.string().optional().nullable(),
    attachments: z.array(z.string()).optional().nullable(),
    notes: z.string().optional().nullable(),
    purchaseStatus: z.enum(['DRAFT', 'CONFIRMED']).optional(),
    items: z.array(
      z.object({
        productId: z.string().trim().min(1),
        unit: z.string().optional(),
        quantity: z.number().positive().or(z.string().transform(val => parseInt(val)).refine(val => !isNaN(val) && val > 0)),
        unitPurchasePrice: z.number().nonnegative().or(z.string().transform(val => parseFloat(val)).refine(val => !isNaN(val) && val >= 0)),
        discountPercent: z.number().nonnegative().optional().default(0),
        discountAmount: z.number().nonnegative().optional().default(0),
        taxPercent: z.number().nonnegative().max(100).optional().default(0)
      })
    ).optional(),
    subtotal: z.number().optional(),
    discountAmount: z.number().nonnegative().optional(),
    cgstAmount: z.number().nonnegative().optional(),
    sgstAmount: z.number().nonnegative().optional(),
    igstAmount: z.number().nonnegative().optional(),
    otherCharges: z.number().optional(),
    roundOff: z.number().optional(),
    paidAmount: z.number().nonnegative().optional(),
    paymentMethod: z.string().optional()
  }).passthrough()
});

export const recordPurchasePaymentSchema = z.object({
  body: z.object({
    amount: z.number({ required_error: 'Payment amount is required.' })
      .positive('Payment amount must be greater than zero.')
      .or(z.string().transform(val => parseFloat(val)).refine(val => !isNaN(val) && val > 0, { message: 'Payment amount must be a positive number.' })),
    paymentMethod: z.string().optional().default('CASH'),
    referenceNumber: z.string().optional().nullable(),
    notes: z.string().optional().nullable()
  }).passthrough()
});

export const processPurchaseReturnSchema = z.object({
  body: z.object({
    purchaseInvoiceId: z.string({ required_error: 'Purchase Invoice ID is required.' }).trim().min(1),
    returnType: z.enum(['PURCHASE_RETURN', 'PURCHASE_CANCELLATION']).optional().default('PURCHASE_RETURN'),
    supplierId: z.string().optional(),
    returnDate: z.string().optional().nullable(),
    returnReason: z.string().optional().nullable(),
    referenceNotes: z.string().optional().nullable(),
    returnAgainst: z.enum(['PARTIAL_ITEMS', 'FULL_RETURN']).optional().default('PARTIAL_ITEMS'),
    warehouse: z.string().optional().default('Main Warehouse'),
    refundType: z.enum(['CASH_REFUND', 'ADJUST_IN_NEXT_PURCHASE', 'BANK_TRANSFER']).optional().default('CASH_REFUND'),
    refundAmount: z.number().nonnegative().optional().default(0),
    paymentMethod: z.string().optional().default('CASH'),
    bankAccount: z.string().optional().nullable(),
    returnItems: z.array(
      z.object({
        productId: z.string({ required_error: 'Product ID is required for return.' }).trim().min(1),
        unit: z.string().optional().default('Nos'),
        purchasedQty: z.number().optional(),
        returnQuantity: z.number({ required_error: 'Return quantity is required.' })
          .positive('Return quantity must be greater than zero.')
          .or(z.string().transform(val => parseInt(val)).refine(val => !isNaN(val) && val > 0)),
        unitPrice: z.number().nonnegative().optional(),
        discountPercent: z.number().nonnegative().optional().default(0),
        taxPercent: z.number().nonnegative().optional().default(0)
      })
    ).min(1, 'At least one item return quantity is required.')
  }).passthrough()
});
