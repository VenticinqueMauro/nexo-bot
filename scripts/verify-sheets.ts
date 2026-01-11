/**
 * Script para verificar la estructura de todas las hojas de Google Sheets
 *
 * Setup:
 * 1. Copiar .env.example a .env
 * 2. Completar con tus credenciales de Google Sheets
 * 3. Ejecutar: npm run verify-sheets
 */

import { config } from 'dotenv';
import { getSheetValues } from '../src/sheets/client';

// Cargar variables de entorno desde .env
config();

// Tipos para las verificaciones
interface SheetStructure {
  name: string;
  requiredColumns: string[];
  minRows?: number;
}

const EXPECTED_STRUCTURES: SheetStructure[] = [
  {
    name: 'Productos',
    requiredColumns: [
      'ID',
      'SKU',
      'Nombre',
      'Categoria',
      'Color',
      'Talle',
      'Descripcion',
      'Temporada',
      'Proveedor',
      'Foto URL',
      'Stock',
      'Stock Mínimo',
      'Precio',
    ],
  },
  {
    name: 'Clientes',
    requiredColumns: [
      'ID',
      'Nombre',
      'Teléfono',
      'Dirección',
      'Notas',
      'Fecha Alta',
    ],
  },
  {
    name: 'Pedidos',
    requiredColumns: [
      'ID',
      'Fecha',
      'Cliente ID',
      'Cliente Nombre',
      'Items (JSON)',
      'Total',
      'Estado',
      'Pagado',
    ],
  },
  {
    name: 'Pagos',
    requiredColumns: [
      'ID',
      'Fecha',
      'Cliente ID',
      'Cliente Nombre',
      'Monto',
      'Método',
      'Pedido ID',
      'Notas',
    ],
  },
  {
    name: 'Movimientos Stock',
    requiredColumns: [
      'ID',
      'Fecha',
      'Producto ID',
      'Producto Nombre',
      'Cantidad',
      'Tipo',
      'Referencia',
      'Notas',
    ],
  },
  {
    name: 'Observaciones',
    requiredColumns: [
      'ID',
      'Fecha',
      'Tipo',
      'Contexto',
      'Acción Sugerida',
      'Estado',
      'Mensaje Usuario',
    ],
  },
  {
    name: 'Preferencias',
    requiredColumns: [
      'ID',
      'Tipo',
      'Término Usuario',
      'Mapeo',
      'Frecuencia',
      'Última Vez',
      'Aprobado',
      'Contexto Adicional',
    ],
  },
];

interface VerificationResult {
  sheetName: string;
  exists: boolean;
  hasHeaders: boolean;
  correctColumns: boolean;
  missingColumns?: string[];
  extraColumns?: string[];
  columnCount?: number;
  rowCount?: number;
  errors: string[];
  warnings: string[];
}

async function verifySheet(
  env: any,
  structure: SheetStructure
): Promise<VerificationResult> {
  const result: VerificationResult = {
    sheetName: structure.name,
    exists: false,
    hasHeaders: false,
    correctColumns: false,
    errors: [],
    warnings: [],
  };

  try {
    // Intentar leer la hoja
    const rows = await getSheetValues(env, structure.name);

    result.exists = true;
    result.rowCount = rows.length;

    if (rows.length === 0) {
      result.errors.push('La hoja está vacía. Debe tener al menos una fila con encabezados.');
      return result;
    }

    // Verificar encabezados (primera fila)
    const headers = rows[0];
    result.hasHeaders = headers.length > 0;
    result.columnCount = headers.length;

    if (!result.hasHeaders) {
      result.errors.push('No se encontraron encabezados en la primera fila.');
      return result;
    }

    // Normalizar encabezados (quitar espacios extras, comparar case-insensitive)
    const normalizedHeaders = headers.map((h: string) => h.trim());
    const normalizedExpected = structure.requiredColumns.map(c => c.trim());

    // Verificar columnas faltantes
    const missingColumns = normalizedExpected.filter(
      expected => !normalizedHeaders.some(
        (header: string) => header.toLowerCase() === expected.toLowerCase()
      )
    );

    if (missingColumns.length > 0) {
      result.missingColumns = missingColumns;
      result.errors.push(`Columnas faltantes: ${missingColumns.join(', ')}`);
    }

    // Verificar columnas extra (advertencia, no error)
    const extraColumns = normalizedHeaders.filter(
      (header: string) => !normalizedExpected.some(
        expected => expected.toLowerCase() === header.toLowerCase()
      ) && header !== '' // Ignorar columnas vacías
    );

    if (extraColumns.length > 0) {
      result.extraColumns = extraColumns;
      result.warnings.push(`Columnas extra encontradas: ${extraColumns.join(', ')}`);
    }

    // Verificar orden de columnas
    const orderCorrect = normalizedExpected.every((expected, index) => {
      if (index >= normalizedHeaders.length) return false;
      return normalizedHeaders[index].toLowerCase() === expected.toLowerCase();
    });

    if (!orderCorrect && missingColumns.length === 0) {
      result.warnings.push(
        'Las columnas están presentes pero no en el orden esperado. ' +
        'Esto puede causar problemas. Esperado: ' + normalizedExpected.join(', ')
      );
    }

    result.correctColumns = missingColumns.length === 0;

    // Verificar cantidad mínima de filas (si aplica)
    if (structure.minRows && rows.length < structure.minRows) {
      result.warnings.push(
        `Se esperaban al menos ${structure.minRows} filas, pero solo hay ${rows.length}`
      );
    }

  } catch (error: any) {
    result.errors.push(`Error al leer la hoja: ${error.message}`);
  }

  return result;
}

async function main() {
  console.log('🔍 Verificando estructura de Google Sheets...\n');

  // Crear objeto Env mock con las variables de entorno
  const env = {
    GOOGLE_SHEETS_ID: process.env.GOOGLE_SHEETS_ID,
    GOOGLE_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };

  // Verificar que las variables de entorno existen
  if (!env.GOOGLE_SHEETS_ID || !env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_PRIVATE_KEY) {
    console.error('❌ Error: Variables de entorno no configuradas');
    console.log('\nAsegurate de tener configurado:');
    console.log('- GOOGLE_SHEETS_ID');
    console.log('- GOOGLE_SERVICE_ACCOUNT_EMAIL');
    console.log('- GOOGLE_PRIVATE_KEY');
    console.log('\nPodés obtenerlas con: wrangler secret list');
    process.exit(1);
  }

  console.log(`📊 Sheet ID: ${env.GOOGLE_SHEETS_ID.substring(0, 20)}...\n`);

  const results: VerificationResult[] = [];

  // Verificar cada hoja
  for (const structure of EXPECTED_STRUCTURES) {
    console.log(`Verificando: ${structure.name}...`);
    const result = await verifySheet(env, structure);
    results.push(result);
  }

  // Mostrar resultados
  console.log('\n' + '='.repeat(80));
  console.log('RESULTADOS DE VERIFICACIÓN');
  console.log('='.repeat(80) + '\n');

  let allCorrect = true;
  let hasWarnings = false;

  for (const result of results) {
    const icon = result.exists && result.correctColumns && result.errors.length === 0 ? '✅' : '❌';
    console.log(`${icon} ${result.sheetName}`);

    if (!result.exists) {
      console.log('   ⚠️  La hoja NO EXISTE');
      allCorrect = false;
    } else {
      console.log(`   📏 Columnas: ${result.columnCount}, Filas: ${result.rowCount}`);

      if (result.errors.length > 0) {
        allCorrect = false;
        result.errors.forEach(error => {
          console.log(`   ❌ ${error}`);
        });
      }

      if (result.warnings.length > 0) {
        hasWarnings = true;
        result.warnings.forEach(warning => {
          console.log(`   ⚠️  ${warning}`);
        });
      }

      if (result.errors.length === 0 && result.warnings.length === 0) {
        console.log('   ✓ Estructura correcta');
      }
    }
    console.log('');
  }

  // Resumen final
  console.log('='.repeat(80));
  if (allCorrect && !hasWarnings) {
    console.log('✅ TODAS LAS HOJAS TIENEN LA ESTRUCTURA CORRECTA');
  } else if (allCorrect) {
    console.log('⚠️  TODAS LAS HOJAS EXISTEN PERO HAY ADVERTENCIAS');
  } else {
    console.log('❌ HAY ERRORES QUE DEBEN SER CORREGIDOS');
  }
  console.log('='.repeat(80));

  process.exit(allCorrect ? 0 : 1);
}

main().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
