# Cómo Agregar Usuarios Autorizados al Bot

El bot ahora soporta múltiples usuarios autorizados. Aquí te explico cómo agregar nuevos usuarios.

---

## 📋 Pasos para Autorizar un Nuevo Usuario

### 1️⃣ Obtener el Telegram ID del Usuario

El nuevo usuario debe:

1. Abrir Telegram
2. Buscar el bot: `@tu_bot_username`
3. Enviar el comando: `/whoami`
4. El bot responderá con su **ID de Usuario** (un número)
5. Compartir ese número contigo

**Ejemplo de respuesta:**
```
👤 Tu información de Telegram:

• ID de Usuario: 1234567890
• Nombre: Juan Pérez

Compartí este ID con el administrador para obtener acceso al bot.
```

### 2️⃣ Agregar el ID a la Variable de Entorno

Tienes que actualizar la variable `OWNER_TELEGRAM_ID` en Cloudflare Workers.

#### Opción A: Usando Wrangler (Recomendado)

```bash
# Ir al directorio del proyecto
cd nexo-bot

# Actualizar la variable con múltiples IDs separados por comas
wrangler secret put OWNER_TELEGRAM_ID
```

Cuando te pida el valor, ingresa:
```
TU_ID_ACTUAL,1234567890,OTRO_ID_SI_HAY
```

Por ejemplo:
```
7856132212,1234567890,9876543210
```

#### Opción B: Usando el Dashboard de Cloudflare

1. Ve a: https://dash.cloudflare.com
2. Workers & Pages → Tu worker (`nexo-bot`)
3. Settings → Variables
4. Encuentra `OWNER_TELEGRAM_ID`
5. Click en "Edit variables"
6. Cambia el valor a: `TU_ID_ACTUAL,NUEVO_ID,OTRO_ID`
7. Click "Save and deploy"

### 3️⃣ Verificar el Acceso

1. El nuevo usuario abre el bot
2. Envía `/start`
3. Si todo está bien, debería ver el mensaje de bienvenida
4. Si no está autorizado, verá: "❌ No estás autorizado para usar este bot"

---

## 📝 Ejemplos

### Autorizar 1 Usuario (Original)
```
OWNER_TELEGRAM_ID = 7856132212
```

### Autorizar 2 Usuarios
```
OWNER_TELEGRAM_ID = 7856132212,1234567890
```

### Autorizar 5 Usuarios
```
OWNER_TELEGRAM_ID = 7856132212,1234567890,9876543210,5555666677,1112223334
```

---

## 🔧 Comandos Útiles

### Ver Usuarios Autorizados Actuales
```bash
wrangler secret list
```

### Actualizar Lista de Usuarios
```bash
wrangler secret put OWNER_TELEGRAM_ID
# Ingresa: ID1,ID2,ID3
```

### Ver Logs (Para Debugging)
```bash
wrangler tail
```

Si alguien intenta usar el bot sin autorización, verás:
```
Usuario no autorizado intentó usar el bot: 9999999999
```

---

## ⚠️ Importante

1. **No compartas IDs públicamente** - Son identificadores únicos de usuarios
2. **Separa con comas** - Sin espacios después de las comas está bien
3. **Solo números** - Los IDs de Telegram son solo números
4. **Redeploy no necesario** - Los cambios en variables toman efecto inmediatamente
5. **Prueba primero** - Verifica que el nuevo usuario puede acceder antes de agregarlo

---

## 🧪 Testing

### Para Probar con el Nuevo Usuario:

1. **El usuario envía**: `/whoami`
   - Verifica que el ID que te dio es correcto

2. **Tú agregas el ID** a la variable

3. **El usuario envía**: `/start`
   - Debería ver el mensaje de bienvenida

4. **El usuario prueba**: "¿Cuántas remeras hay?"
   - Debería funcionar normalmente

---

## 🚨 Solución de Problemas

### Problema: "No estás autorizado"
**Solución:**
1. Verifica que el ID sea correcto con `/whoami`
2. Verifica que agregaste el ID a la variable
3. Espera 10-20 segundos después de actualizar
4. Prueba `/start` de nuevo

### Problema: No responde
**Solución:**
1. Verifica que el webhook esté configurado: `/setup-webhook`
2. Verifica logs: `wrangler tail`
3. Verifica que el bot esté corriendo: `curl https://nexo-bot.mauro25qe.workers.dev/health`

### Problema: Funciona para ti pero no para el nuevo usuario
**Solución:**
1. Verifica que **agregaste el ID con coma**
2. Formato correcto: `ID_TUYO,ID_NUEVO` (sin espacios extras)
3. Verifica en logs que el ID sea el correcto

---

## 📞 Necesitas Ayuda?

Si tienes problemas:

1. Revisa los logs: `wrangler tail`
2. Verifica la configuración: `wrangler secret list`
3. Prueba en modo desarrollo: `wrangler dev`

---

## ✅ Checklist Rápido

- [ ] Obtuve el Telegram ID del nuevo usuario (`/whoami`)
- [ ] Actualicé la variable `OWNER_TELEGRAM_ID` con el nuevo ID
- [ ] Separé los IDs con comas
- [ ] El nuevo usuario probó `/start` y funcionó
- [ ] El nuevo usuario puede usar el bot normalmente

---

**Última actualización:** 2026-01-11
