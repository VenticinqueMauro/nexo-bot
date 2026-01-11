# Scripts de Utilidad

## Verificar Estructura de Google Sheets

Este script verifica que todas las hojas de tu Google Sheet tengan la estructura correcta.

### Setup

1. **Crear archivo .env:**
   ```bash
   cp .env.example .env
   ```

2. **Obtener tus credenciales:**

   Necesitás copiar los valores de tus secretos de Cloudflare Workers al archivo `.env`.

   Los secretos están en tu cuenta de Cloudflare, pero no se pueden leer directamente. Opciones:

   **Opción A - Usar los valores originales:**
   - Abrí tu `wrangler.toml` (si los guardaste ahí)
   - O buscá el archivo original de credenciales de Google

   **Opción B - Desde la consola de Cloudflare:**
   - Ve a Workers & Pages > Tu worker > Settings > Variables
   - Copiá los valores (si están como variables, no secretos)

   **Opción C - Desde wrangler.toml:**
   ```toml
   [vars]
   GOOGLE_SHEETS_ID = "tu-sheet-id"
   ```

3. **Completar .env con estos valores:**
   ```env
   GOOGLE_SHEETS_ID=1nQ7HLM3H7MafYahnEubP_WwPSj8iYpN8K3et...
   GOOGLE_SERVICE_ACCOUNT_EMAIL=nexo-bot@tu-proyecto.iam.gserviceaccount.com
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```

### Ejecución

```bash
npm run verify-sheets
```

### Qué Verifica

El script verifica cada hoja:

1. ✅ **Productos** - 13 columnas
2. ✅ **Clientes** - 6 columnas
3. ✅ **Pedidos** - 8 columnas
4. ✅ **Pagos** - 8 columnas
5. ✅ **Movimientos Stock** - 8 columnas
6. ✅ **Observaciones** - 7 columnas (Sistema de Aprendizaje)
7. ✅ **Preferencias** - 8 columnas (Sistema de Aprendizaje)

Para cada hoja verifica:
- Que exista
- Que tenga encabezados
- Que tenga todas las columnas requeridas
- Que las columnas estén en el orden correcto
- Advertencias sobre columnas extra o fuera de orden

### Salida de Ejemplo

```
🔍 Verificando estructura de Google Sheets...

📊 Sheet ID: 1nQ7HLM3H7MafYahn...

Verificando: Productos...
Verificando: Clientes...
Verificando: Pedidos...
Verificando: Pagos...
Verificando: Movimientos Stock...
Verificando: Observaciones...
Verificando: Preferencias...

================================================================================
RESULTADOS DE VERIFICACIÓN
================================================================================

✅ Productos
   📏 Columnas: 13, Filas: 15
   ✓ Estructura correcta

✅ Clientes
   📏 Columnas: 6, Filas: 8
   ✓ Estructura correcta

❌ Observaciones
   ⚠️  La hoja NO EXISTE

❌ Preferencias
   📏 Columnas: 7, Filas: 1
   ❌ Columnas faltantes: Contexto Adicional

================================================================================
```

### Troubleshooting

**Error: "Variables de entorno no configuradas"**
- Asegurate de haber creado el archivo `.env`
- Verificá que tenga las 3 variables requeridas

**Error: "Error al leer la hoja"**
- Verificá que el `GOOGLE_SHEETS_ID` sea correcto
- Verificá que la Service Account tenga permisos sobre el Sheet
- Verificá que el `GOOGLE_PRIVATE_KEY` esté correctamente formateado

**La hoja NO EXISTE**
- Creá la hoja en tu Google Sheet con el nombre exacto
- Los nombres son case-sensitive: "Observaciones" ≠ "observaciones"

**Columnas faltantes**
- Agregá las columnas faltantes a la hoja
- Ver `SETUP_LEARNING.md` para la estructura exacta
