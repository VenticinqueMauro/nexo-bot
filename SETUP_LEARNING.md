# Setup Rápido - Sistema de Aprendizaje

## 🚀 Instalación en 5 Minutos

### Paso 1: Agregar Hojas a Google Sheets

Abrí tu Google Sheet y creá **2 nuevas hojas** (pestañas) con estos nombres exactos:

#### Hoja: `Observaciones`

**Primera fila (encabezados):**
```
ID | Fecha | Tipo | Contexto | Acción Sugerida | Estado | Mensaje Usuario
```

**Formato:**
- Columna A: Texto
- Columna B: Fecha (DD/MM/YYYY)
- Columnas C-G: Texto

**Ejemplo de datos:**
```
OBS001234 | 11/01/2025 | termino_nuevo | {"mensaje":"las de siempre"} | Crear alias | pendiente | Entraron las de siempre
```

#### Hoja: `Preferencias`

**Primera fila (encabezados):**
```
ID | Tipo | Término Usuario | Mapeo | Frecuencia | Última Vez | Aprobado | Contexto Adicional
```

**Formato:**
- Columna A: Texto
- Columna B: Texto
- Columnas C-D: Texto
- Columna E: Número
- Columna F: Fecha (DD/MM/YYYY)
- Columna G: Texto ("sí" o "no")
- Columna H: Texto

**Ejemplo de datos:**
```
PREF001234 | producto_alias | las de siempre | remera negro XL | 5 | 11/01/2025 | sí | Pedido frecuente
```

### Paso 2: Verificar Nombres

IMPORTANTE: Los nombres de las hojas deben ser **exactamente**:
- ✅ `Observaciones` (con O mayúscula, sin tildes)
- ✅ `Preferencias` (con P mayúscula)

El bot busca estos nombres específicamente.

### Paso 3: Deploy

El código ya está listo. Solo necesitás deployar:

```bash
npm run deploy
# o
wrangler deploy
```

### Paso 4: ¡Listo!

Ya podés empezar a usar el sistema de aprendizaje.

## 🧪 Probar el Sistema

### Test 1: Enseñanza Manual

Enviá este mensaje al bot en Telegram:

```
Recordá que cuando digo "las básicas" me refiero a remeras blancas talle M
```

El bot debería responder:
```
✓ Aprendido! Ya sé que cuando decís "las básicas" te referís a: remeras blancas talle M.
Voy a recordarlo para la próxima.
```

**Verificá:** En la hoja `Preferencias` debería aparecer una nueva fila con:
- Tipo: `producto_alias`
- Término Usuario: `las básicas`
- Mapeo: `remeras blancas talle M`
- Aprobado: `sí`

### Test 2: Ver Estadísticas

Enviá:
```
¿Qué aprendiste hasta ahora?
```

El bot debería mostrar:
```
🧠 Estadísticas de aprendizaje:

📊 Total de preferencias aprendidas: 1
📝 Observaciones totales: 0
⏳ Observaciones pendientes: 0

Preferencias por tipo:
  • producto alias: 1
```

### Test 3: Usar lo Aprendido

Ahora enviá:
```
¿Cuánto stock tengo de las básicas?
```

El bot debería automáticamente buscar "remeras blancas talle M" porque ya aprendió ese término.

## 🔍 Verificar que Funciona

1. **Prompt Dinámico**: El bot construye el prompt con tus preferencias
2. **Detección Automática**: Cuando no encuentra algo, guarda observaciones
3. **Aprendizaje Manual**: Podés enseñarle términos directamente

## 📊 Monitoreo

### Ver Observaciones Pendientes

Entrá a la hoja `Observaciones` en Google Sheets. Ahí vas a ver:
- Todas las situaciones que el bot detectó automáticamente
- Estado de cada observación
- Qué acción sugiere

### Aprobar Preferencias Manualmente

En la hoja `Preferencias`:
1. Buscá la preferencia que querés aprobar
2. Cambiá la columna `Aprobado` de `no` a `sí`
3. El bot la va a usar en la próxima interacción

### Editar Preferencias

Podés editar directamente en Google Sheets:
- Cambiar el mapeo si no es correcto
- Actualizar el término del usuario
- Eliminar preferencias que ya no querés

## 🛠️ Troubleshooting

### El bot no encuentra las hojas

**Error:** `Observaciones not found`

**Solución:**
- Verificá que las hojas se llamen exactamente `Observaciones` y `Preferencias`
- Asegurate de que tengan la primera fila con encabezados
- Verificá que el Google Sheet tenga permisos para la Service Account

### Las preferencias no se aplican

**Problema:** Enseñaste algo pero el bot no lo usa

**Solución:**
1. Verificá en la hoja `Preferencias` que la columna `Aprobado` sea `sí` (no "si" sin tilde)
2. El bot carga preferencias al inicio de cada mensaje, probá enviar un mensaje nuevo
3. Verificá el tipo de preferencia sea correcto (`producto_alias`, `cliente_alias`, etc.)

### Observaciones no se guardan

**Problema:** El bot no detecta situaciones de aprendizaje

**Solución:**
- Esto es normal en la primera versión. La detección automática mejora con el tiempo.
- Podés enseñar manualmente con "Recordá que..."
- Verificá en los logs si hay errores de escritura en Google Sheets

## 💡 Tips

1. **Empezá enseñando manualmente**: No esperes que el bot aprenda solo al principio
2. **Sé específico**: "Recordá que 'las de juan' son remeras negras XL del proveedor Juan Pérez"
3. **Revisá las hojas**: Cada tanto entrá a verificar qué aprendió
4. **Usá términos consistentes**: Si hoy decís "las básicas" y mañana "básicas", el bot los trata como términos diferentes

## 📚 Documentación Completa

Para más detalles, leé `LEARNING_SYSTEM.md` que incluye:
- Todos los tipos de preferencias
- Ejemplos de uso avanzado
- Funcionamiento técnico completo
- Casos de uso reales

---

**¿Preguntas?** El bot puede responder sobre su propio sistema de aprendizaje. Preguntale en Telegram: "¿Cómo funciona tu sistema de aprendizaje?"
