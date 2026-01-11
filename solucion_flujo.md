# Solución y Mejoras al Flujo

Se han realizado correcciones en el código del bot para resolver los problemas identificados en `flujo.md`.

## Problemas Resueltos

### 1. Bucles de Ambigüedad (SKUs Duplicados)
**Problema:** El usuario podía crear dos productos distintos (ej: "Remera manga corta celeste M" y "Remera manga corta de mujer celeste Celeste M") que generaban el *mismo SKU* (`REM-CEL-M`). Al buscar o intentar vender, el bot encontraba múltiples coincidencias y pedía el SKU para desempatar, pero como el SKU era idéntico, se entraba en un bucle infinito.

**Solución Implementada (`src/sheets/stock.ts`):**
- Se modificó la función `createProduct`.
- Ahora, antes de crear un producto, verifica si el SKU generado ya existe en el sistema.
- Si existe, le agrega automáticamente un sufijo único (basado en el ID interno) para asegurar que cada producto tenga un SKU único (ej: `REM-CEL-M-1234`).

### 2. Fallas en Búsqueda (Plurales)
**Problema:** Búsquedas naturales como "remeras celestes" fallaban porque el sistema buscaba la palabra exacta "remeras" y el producto se llamaba "Remera".

**Solución Implementada (`src/sheets/stock.ts`):**
- Se mejoró la función `findProducts`.
- Ahora el buscador es más inteligente: si una palabra de búsqueda termina en "s" (ej: "remeras"), también busca su versión singular ("remera").
- Esto permite que "compro 2 remeras" encuentre correctamente el producto "Remera".

### 3. IDs en Comprobantes de Venta
**Problema:** Al confirmar una venta, el bot mostraba el ID interno del sistema (ej: `PMK9O51I3IGM5N`) en lugar del nombre legible del producto.
```
- 2 PMK9O51I3IGM5N negro M: $58.000
```

**Solución Implementada (`src/utils/formatters.ts`):**
- Se corrigió la función `formatOrder`.
- Ahora busca el nombre del producto usando el ID y muestra el nombre amigable (ej: "Remera Negra M") en el resumen del pedido.

## Verificación del Nuevo Flujo

Con estos cambios, el flujo documentado funcionaría así:

1. **Creación:** Si intentás crear un segundo producto muy similar, el bot le asignará un SKU distinto (ej: `REM-CEL-M-XY`).
2. **Búsqueda:** Si buscás "Remeras", encontrará "Remera".
3. **Desempate:** Si hay ambigüedad, el bot te pedirá el SKU. Como ahora los SKUs son únicos, al ingresar el SKU correcto, el bot seleccionará el producto sin dudar ni volver a preguntar.
4. **Resumen de Venta:** Verás "Remera manga corta celeste" en lugar de `PMK9O51...`.

### 4. Confirmación de Pago (Botones)
**Problema:** Al registrar una venta, el bot asumía "Cuenta Corriente" si no se especificaba el pago, sin dar opción a confirmar. Además, faltaban los botones interactivos.

**Solución Implementada (`src/ai/agent.ts` + `handlers.ts`):**
- Se modificó la tool `sale_register` para que devuelva un código especial (`NECESITA_CONFIRMACION:PAGO`) cuando no se aclara el estado del pago.
- El bot detecta este código y muestra automáticamente los botones "💰 Pagado" y "📋 A Cuenta", permitiendo al usuario elegir con un clic en lugar de escribir.

### 5. Prevención de Alucinaciones
**Problema:** A veces el bot respondía "Venta registrada" falsamente simular la acción sin realmente guardar los datos en la hoja de cálculo (ni llamar a la tool).

**Solución Implementada (`src/ai/agent.ts` + `prompts.ts`):**
- Se agregaron patrones de detección para frases como "Venta registrada", "Pago registrado", etc.
- Si el bot usa estas frases sin haber llamado a una tool, el sistema lo intercepta, lo considera una alucinación y fuerza un reintento con instrucciones estrictas para que SÍ ejecute la acción.
- Si el bot usa estas frases sin haber llamado a una tool, el sistema lo intercepta, lo considera una alucinación y fuerza un reintento con instrucciones estrictas para que SÍ ejecute la acción.
- Se reforzó el "System Prompt" para prohibir explícitamente estas simulaciones.

### 6. Validación Estricta de Pago y Fechas
**Problema:** Si el usuario no decía nada sobre el pago, a veces el bot asumía "no pagado" sin preguntar. Y al preguntar fecha de vencimiento, no daba opciones rápidas.

**Solución Implementada (`src/ai/agent.ts` + `handlers.ts`):**
- Si el modelo predice "no pagado" (`false`) pero el usuario no dijo explícitamente "cuenta corriente" o palabras clave, el sistema fuerza la pregunta de confirmación.
- **[NUEVO]** Lo mismo aplica si predice "pagado" (`true`) pero no hay palabras clave de pago (efectivo, tarjeta, etc.). Esto evita que asuma que se pagó por error.
- Se agregaron botones rápidos para fechas de vencimiento (7 días, 15 días, etc.) cuando se confirma una deuda.

### 7. Búsqueda de Productos Más Estricta
**Problema:** Al buscar "Remera Celeste", el bot a veces traía "Remera Negra" porque hacía coincidencia difusa (fuzzy match) con la palabra "Remera" e ignoraba el resto.

**Solución Implementada (`src/sheets/stock.ts`):**
- Se ajustó la lógica de búsqueda: Si la búsqueda tiene varias palabras (ej: "remera celeste"), ahora se exige que TODAS las palabras coincidan (ya sea exacta o parcialmente) con el producto.
- La coincidencia difusa "laxa" (donde basta que una parte coincida) ahora solo se aplica si buscás una sola palabra.
- Esto asegura que "Remera Celeste" nunca traiga una "Remera Negra".
