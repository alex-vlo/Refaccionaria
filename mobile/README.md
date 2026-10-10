# Cliente móvil

App Flutter para Refaccionaria. Guarda la sesión, los autos y las cuentas pendientes en SQLite. Al detectar red llama a `GET /api/health` y, si el servidor responde, sube lo pendiente y baja los autos del cliente.

## Funciones

- Login y creación de cuenta (la primera cuenta del sistema sigue siendo administrador).
- Administrador y empleado: sesión y alta de cuentas.
- Cliente: consulta de sus autos y alta. Si no hay red, el auto queda marcado como local y se envía en la siguiente sincronización.

## Arranque

El backend debe estar en el puerto 3000.

```powershell
cd mobile
flutter create . --project-name refaccionaria_movil
flutter pub get
flutter run --dart-define=API_BASE=http://10.0.2.2:3000
```

`flutter create .` genera las carpetas de Android e iOS sin borrar `lib/`. En un teléfono físico cambia `API_BASE` por la IP de la computadora, por ejemplo `http://192.168.1.20:3000`.

En Android, permite HTTP claro en debug. Dentro de `android/app/src/debug/AndroidManifest.xml`, en `<application>`:

```xml
android:usesCleartextTraffic="true"
```

Y en el manifiesto principal, el permiso `android.permission.INTERNET`.
