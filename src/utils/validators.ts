/**
 * Validaciones críticas para operaciones del negocio
 */

import { Product, Order, Payment } from '../types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Valida una cantidad de stock
 */
export function validateStockQuantity(quantity: number, context?: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (quantity < 0) {
    errors.push(`Cantidad de stock no puede ser negativa: ${quantity}`);
  }

  if (quantity === 0) {
    warnings.push('Cantidad de stock es cero');
  }

  // Alerta si la cantidad es absurdamente alta (posible error de tipeo)
  if (quantity > 10000) {
    warnings.push(`Cantidad inusualmente alta: ${quantity}. Verificar si es correcto.`);
  }

  // Para ventas, verificar si la cantidad es muy alta
  if (context === 'sale' && quantity > 500) {
    warnings.push(`Venta de cantidad muy alta (${quantity}). Verificar si es correcto.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Valida que haya stock suficiente para una venta
 */
export function validateStockAvailability(
  product: Product,
  quantityRequested: number
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (product.stock < quantityRequested) {
    errors.push(
      `Stock insuficiente de ${product.nombre} ${product.color} ${product.talle}. ` +
      `Disponible: ${product.stock}, Solicitado: ${quantityRequested}`
    );
  }

  // Advertir si la venta deja el stock por debajo del mínimo
  const stockAfterSale = product.stock - quantityRequested;
  if (stockAfterSale < product.stockMinimo && stockAfterSale >= 0) {
    warnings.push(
      `Venta dejará el stock por debajo del mínimo. ` +
      `Quedarán ${stockAfterSale} (mínimo: ${product.stockMinimo})`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Valida un monto de dinero
 */
export function validateMoneyAmount(amount: number, context?: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (amount < 0) {
    errors.push(`Monto no puede ser negativo: $${amount}`);
  }

  if (amount === 0) {
    warnings.push('Monto es cero');
  }

  // Montos absurdamente altos (posible error)
  if (amount > 10000000) { // 10 millones
    warnings.push(`Monto inusualmente alto: $${amount.toLocaleString('es-AR')}. Verificar si es correcto.`);
  }

  // Validaciones específicas por contexto
  if (context === 'sale' && amount > 1000000) { // 1 millón
    warnings.push(`Venta de monto muy alto ($${amount.toLocaleString('es-AR')}). Verificar.`);
  }

  if (context === 'payment' && amount > 5000000) { // 5 millones
    warnings.push(`Pago de monto muy alto ($${amount.toLocaleString('es-AR')}). Verificar.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Valida un precio de producto
 */
export function validateProductPrice(price: number): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (price <= 0) {
    errors.push(`Precio debe ser mayor a cero: $${price}`);
  }

  // Precios muy bajos (posible error)
  if (price < 100) {
    warnings.push(`Precio inusualmente bajo: $${price}. Verificar.`);
  }

  // Precios muy altos para ropa (posible error)
  if (price > 500000) {
    warnings.push(`Precio inusualmente alto: $${price.toLocaleString('es-AR')}. Verificar.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Valida un pago contra la deuda del cliente
 */
export function validatePayment(
  paymentAmount: number,
  totalDebt: number
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const moneyValidation = validateMoneyAmount(paymentAmount, 'payment');
  errors.push(...moneyValidation.errors);
  warnings.push(...moneyValidation.warnings);

  // Advertir si el pago es mayor a la deuda
  if (paymentAmount > totalDebt) {
    warnings.push(
      `El pago ($${paymentAmount.toLocaleString('es-AR')}) es mayor a la deuda ` +
      `($${totalDebt.toLocaleString('es-AR')}). ` +
      `¿El cliente está pagando por adelantado o hay un error?`
    );
  }

  // Advertir si el pago es exactamente igual (buen caso pero confirmar)
  if (paymentAmount === totalDebt && totalDebt > 0) {
    warnings.push('El pago salda completamente la deuda. Confirmar.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Valida una fecha de vencimiento
 */
export function validateDeadline(deadline: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validar formato YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(deadline)) {
    errors.push(`Formato de fecha inválido: ${deadline}. Usar YYYY-MM-DD`);
    return { valid: false, errors, warnings };
  }

  const deadlineDate = new Date(deadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Verificar que la fecha sea válida
  if (isNaN(deadlineDate.getTime())) {
    errors.push(`Fecha inválida: ${deadline}`);
    return { valid: false, errors, warnings };
  }

  // Advertir si la fecha está en el pasado
  if (deadlineDate < today) {
    warnings.push(`Fecha de vencimiento está en el pasado: ${deadline}`);
  }

  // Advertir si la fecha es muy lejana (más de 1 año)
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  if (deadlineDate > oneYearFromNow) {
    warnings.push(`Fecha de vencimiento es muy lejana (más de 1 año): ${deadline}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Valida un número de teléfono argentino
 */
export function validatePhoneNumber(phone: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!phone || phone.trim().length === 0) {
    warnings.push('Número de teléfono vacío');
    return { valid: true, errors, warnings }; // Es opcional
  }

  // Remover caracteres no numéricos
  const cleanPhone = phone.replace(/[^0-9]/g, '');

  if (cleanPhone.length === 0) {
    warnings.push('Número de teléfono no contiene dígitos');
    return { valid: true, errors, warnings };
  }

  // Validar longitud (Argentina: 10 dígitos sin código de país)
  if (cleanPhone.length < 10) {
    warnings.push(`Número de teléfono muy corto: ${cleanPhone} (mínimo 10 dígitos)`);
  }

  if (cleanPhone.length > 13) {
    warnings.push(`Número de teléfono muy largo: ${cleanPhone} (máximo 13 dígitos con código)`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Valida un SKU de producto
 */
export function validateSKU(sku: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!sku || sku.trim().length === 0) {
    errors.push('SKU no puede estar vacío');
  }

  if (sku.length < 3) {
    warnings.push('SKU muy corto (mínimo recomendado: 3 caracteres)');
  }

  if (sku.length > 50) {
    warnings.push('SKU muy largo (máximo recomendado: 50 caracteres)');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Valida datos completos de una venta antes de registrarla
 */
export function validateSale(params: {
  items: Array<{ product: Product; quantity: number }>;
  total: number;
  clientName: string;
}): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validar que haya items
  if (!params.items || params.items.length === 0) {
    errors.push('La venta debe tener al menos un item');
  }

  // Validar cada item
  params.items.forEach((item, index) => {
    const qtyValidation = validateStockQuantity(item.quantity, 'sale');
    qtyValidation.errors.forEach(e => errors.push(`Item ${index + 1}: ${e}`));
    qtyValidation.warnings.forEach(w => warnings.push(`Item ${index + 1}: ${w}`));

    const stockValidation = validateStockAvailability(item.product, item.quantity);
    stockValidation.errors.forEach(e => errors.push(`Item ${index + 1}: ${e}`));
    stockValidation.warnings.forEach(w => warnings.push(`Item ${index + 1}: ${w}`));
  });

  // Validar total
  const totalValidation = validateMoneyAmount(params.total, 'sale');
  errors.push(...totalValidation.errors);
  warnings.push(...totalValidation.warnings);

  // Validar que el total calculado coincida
  const calculatedTotal = params.items.reduce(
    (sum, item) => sum + (item.product.precio * item.quantity),
    0
  );

  if (Math.abs(calculatedTotal - params.total) > 0.01) {
    errors.push(
      `Total calculado ($${calculatedTotal.toLocaleString('es-AR')}) ` +
      `no coincide con total indicado ($${params.total.toLocaleString('es-AR')})`
    );
  }

  // Validar nombre del cliente
  if (!params.clientName || params.clientName.trim().length === 0) {
    errors.push('Nombre del cliente es requerido');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Combina múltiples resultados de validación
 */
export function combineValidations(...validations: ValidationResult[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  validations.forEach(v => {
    errors.push(...v.errors);
    warnings.push(...v.warnings);
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Formatea un resultado de validación como mensaje legible
 */
export function formatValidationResult(result: ValidationResult): string {
  let message = '';

  if (result.errors.length > 0) {
    message += '❌ *Errores:*\n';
    result.errors.forEach(err => {
      message += `  • ${err}\n`;
    });
  }

  if (result.warnings.length > 0) {
    if (message.length > 0) message += '\n';
    message += '⚠️ *Advertencias:*\n';
    result.warnings.forEach(warn => {
      message += `  • ${warn}\n`;
    });
  }

  if (result.valid && result.warnings.length === 0) {
    message = '✅ Validación exitosa';
  }

  return message;
}
