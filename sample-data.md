# Datos de Ejemplo para Google Sheets

Estos son datos de muestra que podés usar para poblar tu Google Sheet y probar el bot.

## Hoja "Productos"

| ID   | SKU      | Nombre    | Categoria | Color  | Talle | Descripción           | Temporada    | Proveedor      | Foto URL | Stock | Stock Mínimo | Precio |
|------|----------|-----------|-----------|--------|-------|-----------------------|--------------|----------------|----------|-------|--------------|--------|
| P001 | REM-NEG-S | Remera   | Remera    | Negro  | S     | Remera básica         | Todo el año  | Textil Sur     |          | 15    | 5            | 8000   |
| P002 | REM-NEG-M | Remera   | Remera    | Negro  | M     | Remera básica         | Todo el año  | Textil Sur     |          | 25    | 10           | 8000   |
| P003 | REM-NEG-L | Remera   | Remera    | Negro  | L     | Remera básica         | Todo el año  | Textil Sur     |          | 20    | 10           | 8000   |
| P004 | REM-BLA-M | Remera   | Remera    | Blanco | M     | Remera básica         | Todo el año  | Textil Sur     |          | 18    | 10           | 8000   |
| P005 | REM-BLA-L | Remera   | Remera    | Blanco | L     | Remera básica         | Todo el año  | Textil Sur     |          | 12    | 5            | 8000   |
| P006 | JEA-AZU-38 | Jean    | Jean      | Azul   | 38    | Jean clásico          | Todo el año  | Denim Factory  |          | 8     | 3            | 25000  |
| P007 | JEA-AZU-40 | Jean    | Jean      | Azul   | 40    | Jean clásico          | Todo el año  | Denim Factory  |          | 10    | 3            | 25000  |
| P008 | JEA-NEG-38 | Jean    | Jean      | Negro  | 38    | Jean clásico          | Todo el año  | Denim Factory  |          | 5     | 3            | 25000  |
| P009 | CAM-BLA-M | Camisa   | Camisa    | Blanco | M     | Camisa lisa           | Todo el año  | Camisería Elite |         | 12    | 5            | 15000  |
| P010 | CAM-AZU-L | Camisa   | Camisa    | Azul   | L     | Camisa lisa           | Todo el año  | Camisería Elite |         | 8     | 5            | 15000  |
| P011 | BUZ-GRI-M | Buzo     | Buzo      | Gris   | M     | Buzo con capucha      | Invierno     | Textil Sur     |          | 15    | 5            | 18000  |
| P012 | BUZ-NEG-L | Buzo     | Buzo      | Negro  | L     | Buzo con capucha      | Invierno     | Textil Sur     |          | 10    | 5            | 18000  |

## Hoja "Clientes"

| ID   | Nombre              | Teléfono    | Dirección          | Notas                    | Fecha Alta |
|------|---------------------|-------------|-------------------|--------------------------|------------|
| C001 | María González      | 3815551234  | Av. Mitre 450     | Paga siempre a tiempo    | 2025-01-10 |
| C002 | Juan Pérez          | 3815555678  | San Martín 1200   | A veces se atrasa        | 2025-01-10 |
| C003 | Laura Fernández     | 3815559999  | Belgrano 789      | Cliente VIP              | 2025-01-11 |
| C004 | Carlos Rodríguez    | 3815558888  | Tucumán 345       |                          | 2025-01-12 |
| C005 | Ana López           | 3815557777  | Salta 567         |                          | 2025-01-12 |
| C006 | Pedro Martínez      | 3815559876  | Av. Mate de Luna 1500 | Buen cliente         | 2025-01-08 |

## Hoja "Pedidos"

| ID   | Fecha      | Cliente ID | Cliente Nombre    | Items (JSON)                                                                                    | Total | Estado     | Pagado |
|------|-----------|------------|-------------------|-------------------------------------------------------------------------------------------------|-------|------------|--------|
| V001 | 2025-01-10 | C001       | María González    | [{"producto":"P002","cantidad":3,"color":"Negro","talle":"M"},{"producto":"P006","cantidad":1,"color":"Azul","talle":"38"}] | 49000 | entregado  | no     |
| V002 | 2025-01-10 | C002       | Juan Pérez        | [{"producto":"P004","cantidad":2,"color":"Blanco","talle":"M"}]                                 | 16000 | entregado  | no     |
| V003 | 2025-01-11 | C003       | Laura Fernández   | [{"producto":"P011","cantidad":2,"color":"Gris","talle":"M"}]                                   | 36000 | entregado  | si     |

## Hoja "Pagos"

| ID     | Fecha      | Cliente ID | Cliente Nombre    | Monto | Método      | Pedido ID | Notas         |
|--------|-----------|------------|-------------------|-------|-------------|-----------|---------------|
| PAY001 | 2025-01-10 | C002       | Juan Pérez        | 10000 | efectivo    | V002      | Pago parcial  |
| PAY002 | 2025-01-11 | C003       | Laura Fernández   | 36000 | transferencia | V003     | Pago completo |

## Hoja "Movimientos Stock"

| ID   | Fecha      | Producto ID | Producto Nombre   | Cantidad | Tipo    | Referencia | Notas                  |
|------|-----------|-------------|-------------------|----------|---------|------------|------------------------|
| M001 | 2025-01-09 | P002        | Remera Negro M    | +30      | entrada | -          | Pedido proveedor       |
| M002 | 2025-01-10 | P002        | Remera Negro M    | -3       | venta   | V001       | -                      |
| M003 | 2025-01-10 | P006        | Jean Azul 38      | -1       | venta   | V001       | -                      |
| M004 | 2025-01-10 | P004        | Remera Blanco M   | -2       | venta   | V002       | -                      |
| M005 | 2025-01-11 | P011        | Buzo Gris M       | -2       | venta   | V003       | -                      |

---

## Cómo cargar estos datos

1. Abrí tu Google Sheet
2. Copiá y pegá cada tabla en su hoja correspondiente
3. Asegurate de que los encabezados coincidan exactamente
4. El bot ya puede empezar a funcionar con estos datos de ejemplo

## Pruebas sugeridas después de cargar los datos

Una vez que hayas cargado los datos, probá estos comandos en el bot:

```
# Stock
¿Cuántas remeras negras tengo?
¿Cómo estamos de stock?

# Clientes
¿Qué onda con María?
¿Qué onda con Juan Pérez?

# Deudas
¿Quién me debe?
¿Cuánto debe Juan?

# Ventas
¿Qué vendí hoy?
```

Después probá registrar una nueva venta:

```
Vendí a María: 2 remeras negras talle M y 1 jean azul talle 40
```

El bot debería:
1. Encontrar los productos
2. Verificar que hay stock
3. Calcular el total
4. Preguntar si pagó o va a cuenta
5. Actualizar el stock automáticamente
