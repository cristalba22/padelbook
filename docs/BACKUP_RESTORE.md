# Backups y recuperación de PadelBook

## Política

- El workflow `MongoDB encrypted backup` corre todos los días a las 03:17 de Argentina y también puede ejecutarse manualmente.
- Cada archivo se comprime y cifra con AES 256 GCM antes de salir del proceso.
- GitHub conserva el artefacto cifrado durante 30 días.
- Objetivo inicial del piloto: RPO de 24 horas y RTO de 2 horas.

## Secretos requeridos en GitHub

- `MONGODB_URI`: conexión de MongoDB Atlas con permiso de lectura sobre la base del club.
- `BACKUP_ENCRYPTION_KEY`: 32 bytes aleatorios, expresados como 64 caracteres hexadecimales o base64.
- Variable `MONGODB_DB_NAME`: actualmente `padelbook_club_piloto`.

La clave de cifrado debe guardarse además en un gestor de contraseñas fuera de GitHub. Sin ella el backup no se puede recuperar.

## Verificación y simulacro de restauración

```powershell
$env:MONGODB_URI="mongodb+srv://..."
$env:MONGODB_DB_NAME="padelbook_club_piloto"
$env:BACKUP_ENCRYPTION_KEY="..."
npm run db:backup -- --output backups/piloto.pbk
npm run db:backup -- --verify-only backups/piloto.pbk
npm run db:restore -- --input backups/piloto.pbk --target-db padelbook_restore_drill
```

Después del restore se debe iniciar una API temporal contra `padelbook_restore_drill`, verificar login, canchas, reservas y cobros, y borrar la base del simulacro. La prueba automatizada `tests/backupRestore.test.mjs` ejecuta ese ciclo completo contra MongoDB efímero y también comprueba documentos, fechas e índices.

## Protección contra restauración accidental

El comando rechaza restaurar sobre la base configurada como producción. Para una emergencia real exige a la vez `--allow-production` y que `RESTORE_CONFIRM_DATABASE` coincida exactamente con el nombre de la base. Antes de esa acción se debe detener la escritura de nuevas reservas y conservar el backup previo.
