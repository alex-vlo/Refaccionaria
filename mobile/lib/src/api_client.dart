import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import 'config.dart';
import 'models.dart';

class ApiException implements Exception {
  ApiException(this.message, {this.status});
  final String message;
  final int? status;

  @override
  String toString() => message;
}

class ApiClient {
  ApiClient({http.Client? client, this.token, String? baseUrl})
      : _client = client ?? http.Client(),
        baseUrl = baseUrl ?? apiBase;

  final http.Client _client;
  String? token;
  String baseUrl;

  Uri _uri(String path) => Uri.parse('$baseUrl$path');

  Future<bool> isReachable() async {
    try {
      final response = await _client
          .get(_uri('/api/health'))
          .timeout(const Duration(seconds: 40));
      if (response.statusCode != 200) return false;
      final body = jsonDecode(response.body);
      return body is Map && body['ok'] == true;
    } catch (_) {
      return false;
    }
  }

  Future<({String token, AppUser user})> login(String email, String password) async {
    final data = await _send(
      'POST',
      '/api/auth/login',
      body: {'email': email, 'password': password},
      auth: false,
    );
    return (
      token: data['token'] as String,
      user: AppUser.fromJson(data['user'] as Map<String, dynamic>),
    );
  }

  Future<({String token, AppUser user})> register({
    required String nombre,
    required String email,
    required String password,
    String? telefono,
  }) async {
    final data = await _send(
      'POST',
      '/api/auth/register',
      body: {
        'nombre': nombre,
        'email': email,
        'password': password,
        if (telefono != null && telefono.isNotEmpty) 'telefono': telefono,
      },
      auth: false,
    );
    return (
      token: data['token'] as String,
      user: AppUser.fromJson(data['user'] as Map<String, dynamic>),
    );
  }

  Future<AppUser> me() async {
    final data = await _send('GET', '/api/auth/me');
    return AppUser.fromJson(data as Map<String, dynamic>);
  }

  Future<List<Auto>> autos() async {
    final data = await _send('GET', '/api/autos');
    final list = data as List<dynamic>;
    return list.map((item) => Auto.fromJson(item as Map<String, dynamic>)).toList();
  }

  Future<void> enviarUbicacion({
    required double latitud,
    required double longitud,
    double? precisionMetros,
  }) async {
    await _send('POST', '/api/ubicaciones', body: {
      'latitud': latitud,
      'longitud': longitud,
      if (precisionMetros != null) 'precision_m': precisionMetros,
    });
  }

  Future<Auto> crearAuto(Map<String, dynamic> body) async {
    final data = await _send('POST', '/api/autos', body: body);
    return Auto.fromJson(data as Map<String, dynamic>);
  }

  Future<dynamic> _send(
    String method,
    String path, {
    Map<String, dynamic>? body,
    bool auth = true,
  }) async {
    final headers = <String, String>{'Accept': 'application/json'};
    if (body != null) headers['Content-Type'] = 'application/json';
    if (auth) {
      final current = token;
      if (current == null || current.isEmpty) {
        throw ApiException('Debes iniciar sesión', status: 401);
      }
      headers['Authorization'] = 'Bearer $current';
    }

    http.Response response;
    try {
      final uri = _uri(path);
      final encoded = body == null ? null : jsonEncode(body);
      switch (method) {
        case 'POST':
          response = await _client
              .post(uri, headers: headers, body: encoded)
              .timeout(const Duration(seconds: 45));
        case 'GET':
          response = await _client.get(uri, headers: headers).timeout(const Duration(seconds: 45));
        default:
          throw ApiException('Método no soportado');
      }
    } on SocketException {
      throw ApiException('No se pudo conectar con el servidor');
    } on TimeoutException {
      throw ApiException('El servidor tardó demasiado. Si Render estaba dormido, espera un momento y vuelve a intentar.');
    } catch (error) {
      if (error is ApiException) rethrow;
      throw ApiException('No se pudo conectar con el servidor');
    }

    Map<String, dynamic>? payload;
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic>) payload = decoded;
    } catch (_) {
      payload = null;
    }

    if (response.statusCode >= 400 || payload == null || payload['ok'] == false) {
      throw ApiException(
        payload?['error'] as String? ?? 'No se pudo completar la solicitud',
        status: response.statusCode,
      );
    }
    return payload['data'];
  }
}
