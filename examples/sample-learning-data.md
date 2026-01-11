# Datos de Ejemplo - Sistema de Aprendizaje

## Hoja: Observaciones

### Encabezados (Primera fila)
```
ID | Fecha | Tipo | Contexto | Acción Sugerida | Estado | Mensaje Usuario
```

### Ejemplos de Datos

Podés copiar y pegar estos ejemplos para probar:

```
OBS001 | 11/01/2025 | termino_nuevo | {"mensaje":"las de siempre","tool":"stock_check"} | Crear alias para producto frecuente | pendiente | ¿Cuánto stock tengo de las de siempre?

OBS002 | 11/01/2025 | correccion | {"mensaje":"No, Almacén López","tool":"client_search"} | Crear alias de cliente | implementada | No, me refería a Almacén López

OBS003 | 11/01/2025 | multiple_intento | {"intentos":3,"accion":"buscar_cliente"} | Mejorar búsqueda de clientes | revisada | Juan

OBS004 | 10/01/2025 | patron_frecuente | {"pedido":"López","items":"10 remeras negras XL"} | Crear patrón de venta | pendiente | Lo mismo que siempre para López
```

## Hoja: Preferencias

### Encabezados (Primera fila)
```
ID | Tipo | Término Usuario | Mapeo | Frecuencia | Última Vez | Aprobado | Contexto Adicional
```

### Ejemplos de Datos

#### Producto Alias
```
PREF001 | producto_alias | las de siempre | remera negro XL | 8 | 11/01/2025 | sí | Pedido más frecuente

PREF002 | producto_alias | las básicas | remera blanco M | 5 | 11/01/2025 | sí | Producto base

PREF003 | producto_alias | las de verano | remera blanco,remera rojo,remera azul talle M | 3 | 10/01/2025 | sí | Colección verano

PREF004 | producto_alias | lo que viene de Juan | remera negro XL proveedor Juan | 4 | 09/01/2025 | sí | Proveedor específico
```

#### Cliente Alias
```
PREF005 | cliente_alias | lópez | Almacén López | 15 | 11/01/2025 | sí | Cliente habitual

PREF006 | cliente_alias | el kiosco de juan | Kiosco Don Juan | 12 | 10/01/2025 | sí | Por ubicación

PREF007 | cliente_alias | el de la esquina | Despensa La Esquina | 8 | 10/01/2025 | sí | Referencia geográfica

PREF008 | cliente_alias | el que siempre debe | Almacén Pérez | 6 | 09/01/2025 | no | Mal pagador (pendiente de aprobación)
```

#### Abreviaciones
```
PREF009 | abreviacion | rne | remera negro XL | 20 | 11/01/2025 | sí | Shortcut personal

PREF010 | abreviacion | rbl | remera blanco L | 15 | 11/01/2025 | sí | Shortcut personal

PREF011 | abreviacion | jnm | jean negro M | 10 | 10/01/2025 | sí | Shortcut personal

PREF012 | abreviacion | stock | consultar stock general | 25 | 11/01/2025 | sí | Comando rápido
```

#### Patrones de Venta
```
PREF013 | patron_venta | lo de siempre para lópez | 10 remera negro XL, 5 jean azul L | 12 | 11/01/2025 | sí | Pedido recurrente semanal

PREF014 | patron_venta | el pedido chico | 5 remera blanco M, 5 remera negro M | 8 | 10/01/2025 | sí | Pedido estándar para clientes nuevos

PREF015 | patron_venta | la promo de verano | 3 remera blanco M + 1 short | 6 | 09/01/2025 | sí | Combo promocional
```

#### Contexto del Negocio
```
PREF016 | contexto | temporada alta | Octubre a Marzo, mayor demanda de verano | 5 | 11/01/2025 | sí | Estacionalidad

PREF017 | contexto | proveedor confiable | Juan Pérez Textiles, entrega puntual | 4 | 10/01/2025 | sí | Proveedores

PREF018 | contexto | zona norte | Belgrano, Núñez, Villa Urquiza | 3 | 09/01/2025 | sí | Áreas de entrega

PREF019 | contexto | stock crítico | menos de 10 unidades de productos populares | 7 | 11/01/2025 | sí | Definición de alerta
```

## Cómo Usar Estos Ejemplos

### Opción 1: Copiar y Pegar Directo

1. Creá las hojas `Observaciones` y `Preferencias`
2. En la primera fila poné los encabezados
3. Copiá las filas de ejemplo y pegalas desde la fila 2
4. Asegurate de que las columnas queden alineadas

### Opción 2: Dejar que el Bot Aprenda

1. Creá las hojas vacías (solo con encabezados)
2. Empezá a usar el bot normalmente
3. Enseñale términos cuando lo necesites
4. Las filas se van a ir llenando automáticamente

### Opción 3: Mix

1. Poné algunos ejemplos para empezar (los más comunes)
2. El resto que lo aprenda automáticamente con el uso

## Testing

Una vez que tengas algunos datos, probá:

```
# Test 1: Producto Alias
Vos: "¿Cuánto stock tengo de las de siempre?"
Bot: [Busca automáticamente "remera negro XL"]

# Test 2: Cliente Alias
Vos: "Vendí 10 remeras a lópez"
Bot: [Encuentra automáticamente "Almacén López"]

# Test 3: Abreviación
Vos: "Dame rne"
Bot: [Entiende que querés "remera negro XL"]

# Test 4: Patrón de Venta
Vos: "Haceme lo de siempre para lópez"
Bot: [Registra 10 remera negro XL + 5 jean azul L automáticamente]

# Test 5: Estadísticas
Vos: "¿Qué aprendiste?"
Bot: [Muestra todas las preferencias]
```

## Notas

- Los IDs son únicos, usá cualquier formato pero que no se repita
- La columna `Aprobado` debe ser exactamente `sí` o `no` (sin tildes alternativas)
- Las fechas pueden ser DD/MM/YYYY o YYYY-MM-DD
- El campo `Contexto` en Observaciones puede ser JSON o texto libre
- La columna `Frecuencia` se puede actualizar manualmente o dejar que el bot lo haga

## Personalización

Adaptá estos ejemplos a tu negocio:

- Cambiá los nombres de productos por los que uses
- Reemplazá los nombres de clientes
- Agregá tus propias abreviaciones
- Definí tus patrones de venta recurrentes
- Documentá el contexto específico de tu operación
