# Sistema de Aprendizaje Adaptativo - Nexo Bot

## 📚 Visión General

El bot ahora puede **aprender automáticamente** de tus interacciones y adaptarse a tu forma de hablar, tus términos personalizados y patrones de uso. La herramienta se adapta a vos, no vos a ella.

---

## 🎯 Características

### 1. Aprendizaje Automático Silencioso
El bot detecta automáticamente:
- Términos que no reconoce y usás frecuentemente
- Correcciones que hacés ("no, me refería a...")
- Múltiples intentos para lograr algo
- Patrones de uso repetidos
- Errores o situaciones confusas

**Ejemplo:**
```
Vos: "Entraron las remeras de siempre"
Bot: "¿Qué remeras son 'las de siempre'?"
Vos: "Las negras talle XL, las que siempre pido"
Bot: [Aprende automáticamente este término]

[Próxima vez]
Vos: "Entraron las remeras de siempre"
Bot: "Perfecto, registrando las remeras negras talle XL"
```

### 2. Enseñanza Manual
Podés enseñarle términos directamente:

```
Vos: "Recordá que cuando digo 'las básicas' me refiero a remeras blancas talle M"
Bot: ✓ Aprendido! Ya sé que cuando decís "las básicas" te referís a: remeras blancas talle M

Vos: "El kiosco de la esquina es el cliente Juan Pérez"
Bot: ✓ Aprendido! Cuando digas "kiosco de la esquina" voy a buscar a Juan Pérez
```

### 3. Estadísticas de Aprendizaje
```
Vos: "¿Qué aprendiste hasta ahora?"
Bot: 🧠 Estadísticas de aprendizaje:

📊 Total de preferencias aprendidas: 12
📝 Observaciones totales: 8
⏳ Observaciones pendientes: 2

Preferencias por tipo:
  • producto alias: 5
  • cliente alias: 3
  • abreviacion: 2
  • patron venta: 2
```

---

## 🗂️ Configuración de Google Sheets

### Paso 1: Crear Nuevas Hojas

En tu Google Sheet existente, agregá dos nuevas hojas:

#### Hoja: **Observaciones**

| Columna | Nombre | Tipo | Descripción |
|---------|--------|------|-------------|
| A | ID | Texto | Identificador único (ej: OBS001234) |
| B | Fecha | Fecha | Fecha de la observación |
| C | Tipo | Texto | Tipo de observación (termino_nuevo, correccion, etc.) |
| D | Contexto | Texto | Contexto JSON de la situación |
| E | Acción Sugerida | Texto | Qué hacer con esta observación |
| F | Estado | Texto | pendiente, revisada, implementada, descartada |
| G | Mensaje Usuario | Texto | Mensaje original del usuario |

**Configuración:**
1. Primera fila: Encabezados (ID, Fecha, Tipo, Contexto, Acción Sugerida, Estado, Mensaje Usuario)
2. Formato de fecha en columna B: DD/MM/YYYY
3. No se requieren fórmulas

#### Hoja: **Preferencias**

| Columna | Nombre | Tipo | Descripción |
|---------|--------|------|-------------|
| A | ID | Texto | Identificador único (ej: PREF001234) |
| B | Tipo | Texto | producto_alias, cliente_alias, abreviacion, patron_venta, contexto |
| C | Término Usuario | Texto | Lo que dice el usuario |
| D | Mapeo | Texto | A qué se traduce |
| E | Frecuencia | Número | Cuántas veces se usó |
| F | Última Vez | Fecha | Última vez que se usó |
| G | Aprobado | Texto | "sí" o "no" |
| H | Contexto Adicional | Texto | Información extra (opcional) |

**Configuración:**
1. Primera fila: Encabezados (ID, Tipo, Término Usuario, Mapeo, Frecuencia, Última Vez, Aprobado, Contexto Adicional)
2. Formato de fecha en columna F: DD/MM/YYYY
3. Columna E: Formato número
4. No se requieren fórmulas

### Paso 2: Verificar Nombres de Hojas

Asegurate que las hojas se llamen **exactamente**:
- `Observaciones` (sin tilde, con mayúscula)
- `Preferencias` (con mayúscula)

El bot busca estos nombres específicamente.

### Paso 3: Permisos

Las hojas deben tener los mismos permisos que las otras hojas del documento (compartidas con la Service Account de Google).

---

## 🚀 Uso del Sistema

### Tipos de Preferencias

#### 1. **Producto Alias**
Términos personalizados para productos:
```
"las de siempre" → Remera negra XL
"las básicas" → Remera blanca M
"lo que siempre viene" → Conjunto de productos específicos
```

#### 2. **Cliente Alias**
Formas informales de referirse a clientes:
```
"el kiosco de juan" → Cliente ID C001
"el que me debe" → Cliente específico
"el de la esquina" → Ubicación conocida
```

#### 3. **Abreviaciones**
Shortcuts que usás frecuentemente:
```
"rne" → Remera negra XL
"jnm" → Jean negro talle M
"stock" → Consultar stock general
```

#### 4. **Patrón de Venta**
Ventas que se repiten:
```
"el pedido habitual de López" → 10 remeras negras + 5 jeans azules
"lo de siempre para María" → Conjunto específico
```

#### 5. **Contexto del Negocio**
Información específica de tu operación:
```
"temporada alta" → Octubre a Marzo
"proveedor confiable" → Nombre específico
"zona norte" → Áreas de entrega definidas
```

---

## 💡 Ejemplos de Uso

### Ejemplo 1: Enseñanza Directa
```
Vos: "Recordá que 'las remeras de verano' son remeras blancas, rojas y azules talle M"
Bot: [Usa la tool learn_preference automáticamente]
Bot: ✓ Aprendido! Ya sé que cuando decís "las remeras de verano" te referís a: remeras blancas, rojas y azules talle M. Voy a recordarlo para la próxima.

[Luego...]
Vos: "¿Cuánto stock tengo de las remeras de verano?"
Bot: [Busca automáticamente remeras blancas M, rojas M y azules M]
```

### Ejemplo 2: Corrección Automática
```
Vos: "Vendí 10 remeras a López"
Bot: "No encontré el cliente López"
Vos: "No, me refería a Almacén López, el de siempre"
Bot: [Detecta la corrección y guarda una observación]
Bot: "Ah, Almacén López! Registrado. ¿Querés que recuerde que 'López' se refiere a 'Almacén López'?"
Vos: "Sí"
Bot: [Aprende la preferencia]
```

### Ejemplo 3: Términos Repetidos
```
[Primera vez]
Vos: "Entraron las de Juan"
Bot: "¿A qué productos te referís con 'las de Juan'?"
Vos: "Las remeras del proveedor Juan - negras y blancas XL"

[Segunda vez]
Vos: "Entraron las de Juan"
Bot: "¿Son las remeras negras y blancas XL del proveedor Juan?"
Vos: "Sí"
Bot: [Detecta el patrón y pregunta si querés que lo recuerde]
Bot: "¿Querés que recuerde que 'las de Juan' son siempre remeras negras y blancas XL?"
Vos: "Dale"
Bot: ✓ Listo, ya lo tengo guardado!

[Tercera vez en adelante]
Vos: "Entraron las de Juan"
Bot: [Automáticamente entiende] "Perfecto, registrando remeras negras y blancas XL del proveedor Juan"
```

---

## 🔍 Monitoreando el Aprendizaje

### Ver Estadísticas
```
Vos: "¿Qué aprendiste?"
Bot: [Muestra stats completos]
```

### Revisar Observaciones Pendientes

Las observaciones automáticas quedan en estado "pendiente" en la hoja. Podés:

1. Revisar la hoja **Observaciones** manualmente
2. Ver qué situaciones el bot detectó
3. Decidir si convertirlas en preferencias

### Aprobar Preferencias Manualmente

En la hoja **Preferencias**, podés:
- Cambiar "no" a "sí" en la columna Aprobado
- Editar el mapeo si no es correcto
- Eliminar preferencias que no querés

---

## ⚙️ Funcionamiento Técnico

### Flujo Automático

```
1. Usuario envía mensaje
   ↓
2. Sistema carga preferencias aprobadas
   ↓
3. Construye prompt dinámico con preferencias
   ↓
4. LLM procesa con contexto personalizado
   ↓
5. Ejecuta tool correspondiente
   ↓
6. Detecta situaciones de aprendizaje
   ↓
7. Registra observaciones automáticamente (silencioso)
   ↓
8. Responde al usuario
```

### Prompt Dinámico

El system prompt se construye dinámicamente:

```typescript
System Prompt Base
+
Preferencias Aprendidas del Usuario
=
Prompt Personalizado
```

Esto significa que el LLM "conoce" tus términos desde el inicio de cada interacción.

---

## 🛡️ Privacidad y Control

- **Todo local**: Las preferencias se guardan en TU Google Sheet
- **Control total**: Podés editar/eliminar preferencias manualmente
- **Transparente**: Podés ver exactamente qué aprendió
- **Sin sorpresas**: Las observaciones automáticas no se aplican hasta que las apruebes (opcional)

---

## 📈 Mejora Continua

El sistema mejora con el uso:
- Más interacciones = Más aprendizaje
- Más correcciones = Mejor adaptación
- Más patrones detectados = Más eficiencia

---

## 🎓 Tips para Mejores Resultados

1. **Sé consistente**: Usá los mismos términos para las mismas cosas
2. **Enseñá explícitamente**: No esperes que aprenda solo, enseñale directamente
3. **Corregí cuando sea necesario**: El bot aprende de tus correcciones
4. **Revisá las preferencias**: Cada tanto entrá a la hoja y verificá que sea correcto

---

## 🔄 Actualización del Sistema

**Cambios en el código:**
- ✅ Nuevo archivo: `src/sheets/learning.ts`
- ✅ Nuevo archivo: `src/ai/dynamic-prompt.ts`
- ✅ Modificado: `src/ai/agent.ts` (integración del sistema)
- ✅ Modificado: `src/ai/tools.ts` (2 tools nuevas)

**Nuevas Tools:**
- `learn_preference`: Aprender preferencia manualmente
- `learning_stats`: Ver estadísticas de aprendizaje

**Hojas nuevas en Google Sheets:**
- `Observaciones`: Situaciones detectadas automáticamente
- `Preferencias`: Términos y preferencias aprendidos

---

¿Preguntas? El bot puede responder sobre su propio sistema de aprendizaje. Preguntale: "¿Cómo funciona tu sistema de aprendizaje?"
