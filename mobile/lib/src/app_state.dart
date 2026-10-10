import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:uuid/uuid.dart';

import 'api_client.dart';
import 'local_db.dart';
import 'models.dart';

class AppState extends ChangeNotifier {
  AppState({ApiClient? api, LocalDb? db})
      : _api = api ?? ApiClient(),
        _db = db ?? LocalDb();

  final ApiClient _api;
  final LocalDb _db;
  final _uuid = const Uuid();

  AppUser? user;
  String? token;
  List<Auto> autos = [];
  bool listo = false;
  bool sincronizando = false;
  bool enLinea = false;
  String? aviso;
  String baseUrl = '';

  StreamSubscription<List<ConnectivityResult>>? _red;

  Future<void> iniciar() async {
    final guardada = await _db.readBaseUrl();
    if (guardada != null && guardada.isNotEmpty) {
      baseUrl = guardada;
      _api.baseUrl = guardada;
    }
    final sesion = await _db.readSession();
    if (sesion != null) {
      token = sesion.token;
      user = sesion.user;
      _api.token = sesion.token;
      autos = await _db.autos();
    }
    listo = true;
    notifyListeners();
    _red = Connectivity().onConnectivityChanged.listen((_) {
      sincronizar();
    });
    await sincronizar();
  }

  Future<void> usarServidor(String url) async {
    var limpio = url.trim();
    if (limpio.endsWith('/')) limpio = limpio.substring(0, limpio.length - 1);
    final uri = Uri.tryParse(limpio);
    if (uri == null || (uri.scheme != 'https' && uri.scheme != 'http') || uri.host.isEmpty) {
      throw ApiException('Escribe la dirección del sitio, por ejemplo https://tu-app.onrender.com');
    }
    baseUrl = limpio;
    _api.baseUrl = limpio;
    await _db.saveBaseUrl(limpio);
  }

  Future<void> login(String email, String password, {required String servidor}) async {
    await usarServidor(servidor);
    final result = await _api.login(email.trim(), password);
    await _guardarSesion(result.token, result.user);
    await sincronizar();
  }

  Future<String> registrar({
    required String nombre,
    required String email,
    required String password,
    String? telefono,
    bool entrar = true,
  }) async {
    final limpio = telefono?.trim();
    if (baseUrl.isEmpty) {
      throw ApiException('Primero indica la dirección del servidor');
    }
    if (await _api.isReachable()) {
      final result = await _api.register(
        nombre: nombre.trim(),
        email: email.trim(),
        password: password,
        telefono: limpio,
      );
      if (entrar && token == null) {
        await _guardarSesion(result.token, result.user);
        await sincronizar();
      }
      return 'Cuenta creada';
    }

    await _db.enqueueAccount(
      nombre: nombre.trim(),
      email: email.trim().toLowerCase(),
      password: password,
      telefono: limpio == null || limpio.isEmpty ? null : limpio,
    );
    aviso = 'Sin conexión. La cuenta quedó guardada y se creará al sincronizar.';
    notifyListeners();
    return aviso!;
  }

  Future<void> compartirUbicacion() async {
    if (token == null) throw ApiException('Debes iniciar sesión');
    final servicio = await Geolocator.isLocationServiceEnabled();
    if (!servicio) {
      throw ApiException('Activa el GPS del teléfono');
    }
    var permiso = await Geolocator.checkPermission();
    if (permiso == LocationPermission.denied) {
      permiso = await Geolocator.requestPermission();
    }
    if (permiso == LocationPermission.denied) {
      throw ApiException('Se necesita permiso de ubicación para guardar tu posición');
    }
    if (permiso == LocationPermission.deniedForever) {
      throw ApiException('El permiso de ubicación está bloqueado. Actívalo en los ajustes del teléfono');
    }
    final posicion = await Geolocator.getCurrentPosition();
    await _api.enviarUbicacion(
      latitud: posicion.latitude,
      longitud: posicion.longitude,
      precisionMetros: posicion.accuracy,
    );
    aviso = 'Ubicación enviada';
    notifyListeners();
  }

  Future<void> agregarAuto({
    required String marca,
    required String modelo,
    required int anio,
    String? placas,
    String? vin,
    String? color,
  }) async {
    final actual = user;
    if (actual == null || !actual.esCliente) {
      throw ApiException('Solo un cliente puede registrar su auto');
    }

    final body = Auto(
      id: 'local-${_uuid.v4()}',
      marca: marca.trim(),
      modelo: modelo.trim(),
      anio: anio,
      placas: _opcional(placas)?.toUpperCase(),
      vin: _opcional(vin)?.toUpperCase(),
      color: _opcional(color),
      usuarioId: actual.id,
      createdAt: DateTime.now().toUtc().toIso8601String(),
      pendiente: true,
    );

    if (enLinea && token != null) {
      try {
        final remoto = await _api.crearAuto(body.toApiBody());
        await _db.upsertAuto(remoto);
        autos = await _db.autos();
        notifyListeners();
        return;
      } on ApiException {
        rethrow;
      }
    }

    await _db.upsertAuto(body);
    autos = await _db.autos();
    aviso = 'Auto guardado en el teléfono. Se enviará cuando haya conexión.';
    notifyListeners();
  }

  Future<void> sincronizar() async {
    if (sincronizando) return;
    sincronizando = true;
    notifyListeners();
    try {
      enLinea = await _api.isReachable();
      if (!enLinea) return;

      await _subirCuentas();
      if (token == null) return;

      try {
        final remoto = await _api.me();
        user = remoto;
        await _db.saveSession(token!, remoto);
      } on ApiException catch (error) {
        if (error.status == 401) {
          await cerrarSesion();
          aviso = 'La sesión expiró. Vuelve a entrar.';
          return;
        }
      }

      if (user?.esCliente == true) {
        await _subirAutos();
        final remotos = await _api.autos();
        await _db.replaceSyncedAutos(remotos);
        autos = await _db.autos();
      }
      aviso = null;
    } catch (error) {
      aviso = error is ApiException ? error.message : 'No se pudo sincronizar';
    } finally {
      sincronizando = false;
      notifyListeners();
    }
  }

  Future<void> cerrarSesion() async {
    token = null;
    user = null;
    autos = [];
    _api.token = null;
    await _db.clearSession();
    notifyListeners();
  }

  Future<void> _guardarSesion(String nuevoToken, AppUser nuevoUser) async {
    token = nuevoToken;
    user = nuevoUser;
    _api.token = nuevoToken;
    await _db.saveSession(nuevoToken, nuevoUser);
    if (nuevoUser.esCliente) {
      autos = await _db.autos();
    }
    notifyListeners();
  }

  Future<void> _subirCuentas() async {
    final pendientes = await _db.pendingAccounts();
    for (final cuenta in pendientes) {
      try {
        await _api.register(
          nombre: cuenta.nombre,
          email: cuenta.email,
          password: cuenta.password,
          telefono: cuenta.telefono,
        );
        await _db.deletePendingAccount(cuenta.id);
      } on ApiException catch (error) {
        if (error.status != null && error.status! >= 400 && error.status! < 500) {
          await _db.deletePendingAccount(cuenta.id);
          aviso = 'No se pudo crear ${cuenta.email}: ${error.message}';
        } else {
          break;
        }
      }
    }
  }

  Future<void> _subirAutos() async {
    final locales = await _db.autos();
    for (final auto in locales.where((item) => item.pendiente)) {
      try {
        final remoto = await _api.crearAuto(auto.toApiBody());
        await _db.deleteAuto(auto.id);
        await _db.upsertAuto(remoto);
      } on ApiException catch (error) {
        if (error.status != null && error.status! >= 400 && error.status! < 500 && error.status != 401) {
          await _db.deleteAuto(auto.id);
          aviso = error.message;
        } else {
          break;
        }
      }
    }
  }

  String? _opcional(String? value) {
    final limpio = value?.trim();
    if (limpio == null || limpio.isEmpty) return null;
    return limpio;
  }

  @override
  void dispose() {
    _red?.cancel();
    super.dispose();
  }
}
