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
