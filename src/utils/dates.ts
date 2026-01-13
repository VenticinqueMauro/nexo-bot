export function parseNaturalDate(input: string): string | null {
    const now = new Date();
    const text = input.trim().toLowerCase();

    // YYYY-MM-DD (fecha ya formateada en formato ISO) - DEBE IR PRIMERO
    const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
        // Ya está en formato correcto, validar que sea fecha válida
        const year = parseInt(isoMatch[1]);
        const month = parseInt(isoMatch[2]) - 1; // JS months 0-11
        const day = parseInt(isoMatch[3]);
        const testDate = new Date(year, month, day);

        // Verificar que la fecha sea válida
        if (testDate.getFullYear() === year &&
            testDate.getMonth() === month &&
            testDate.getDate() === day) {
            return text; // Ya está en formato correcto
        }
    }

    // "en X dias"
    const enDiasMatch = text.match(/en (\d+) d[ií]as?/);
    if (enDiasMatch) {
        const days = parseInt(enDiasMatch[1]);
        const target = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
        return target.toISOString().split('T')[0]; // YYYY-MM-DD
    }

    // "mañana"
    if (text.includes('mañana')) {
        const target = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        return target.toISOString().split('T')[0];
    }

    // "el X" (asumir mes actual o proximo si ya pasó)
    const elDiaMatch = text.match(/^el (\d{1,2})$/);
    if (elDiaMatch) {
        const day = parseInt(elDiaMatch[1]);
        const target = new Date(now.getFullYear(), now.getMonth(), day);
        if (target < now) {
            target.setMonth(target.getMonth() + 1);
        }
        return formatDateISO(target);
    }

    // "DD/MM" o "DD-MM" (sin año)
    // Hacemos más restrictiva la regex para que no matchee años (máximo 2 dígitos)
    const dateMatch = text.match(/^(\d{1,2})[\/-](\d{1,2})$/);
    if (dateMatch) {
        const day = parseInt(dateMatch[1]);
        const month = parseInt(dateMatch[2]) - 1; // JS months 0-11
        let year = now.getFullYear();
        const target = new Date(year, month, day);

        // Si la fecha es muy vieja (ej: diciembre 2024 estando en enero 2025), sumar año
        if (target.getTime() < now.getTime() - 90 * 24 * 60 * 60 * 1000) {
            target.setFullYear(year + 1);
        }
        return formatDateISO(target);
    }

    // "DD/MM/YYYY" o "DD-MM-YYYY" (con año completo)
    const fullDateMatch = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (fullDateMatch) {
        const day = parseInt(fullDateMatch[1]);
        const month = parseInt(fullDateMatch[2]) - 1; // JS months 0-11
        const year = parseInt(fullDateMatch[3]);
        const target = new Date(year, month, day);
        return formatDateISO(target);
    }

    return null;
}

function formatDateISO(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}
