import 'dart:convert';

import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

import 'models.dart';

class PendingAccount {
  PendingAccount({
    required this.id,
    required this.nombre,
    required this.email,
    required this.password,
    this.telefono,
  });

  final int id;
  final String nombre;
  final String email;
  final String password;
  final String? telefono;
}

class LocalDb {
  Database? _db;

  Future<Database> get database async {
    final current = _db;
    if (current != null) return current;
    final dir = await getDatabasesPath();
    final opened = await openDatabase(
      p.join(dir, 'refaccionaria.db'),
      version: 1,
      onOpen: (db) async {
        await db.execute('''
          CREATE TABLE IF NOT EXISTS ajustes (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            base_url TEXT NOT NULL
          )
        ''');
      },
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE session (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            token TEXT NOT NULL,
            user_json TEXT NOT NULL
          )
        ''');
        await db.execute('''
          CREATE TABLE autos (
            id TEXT PRIMARY KEY,
            marca TEXT NOT NULL,
            modelo TEXT NOT NULL,
            anio INTEGER NOT NULL,
            placas TEXT,
            vin TEXT,
            color TEXT,
            usuario_id TEXT,
            created_at TEXT,
            pendiente INTEGER NOT NULL DEFAULT 0
          )
        ''');
        await db.execute('''
          CREATE TABLE cuentas_pendientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            email TEXT NOT NULL,
            password TEXT NOT NULL,
            telefono TEXT
          )
        ''');
      },
    );
    _db = opened;
    return opened;
  }

  Future<void> saveSession(String token, AppUser user) async {
    final db = await database;
    await db.insert(
      'session',
      {'id': 1, 'token': token, 'user_json': jsonEncode(user.toJson())},
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<({String token, AppUser user})?> readSession() async {
    final db = await database;
    final rows = await db.query('session', where: 'id = 1', limit: 1);
    if (rows.isEmpty) return null;
    final row = rows.first;
    return (
      token: row['token'] as String,
      user: AppUser.fromJson(jsonDecode(row['user_json'] as String) as Map<String, dynamic>),
    );
  }

  Future<String?> readBaseUrl() async {
    final db = await database;
    final rows = await db.query('ajustes', where: 'id = 1', limit: 1);
    if (rows.isEmpty) return null;
    return rows.first['base_url'] as String;
  }

  Future<void> saveBaseUrl(String url) async {
    final db = await database;
    await db.insert(
      'ajustes',
      {'id': 1, 'base_url': url},
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<void> clearSession() async {
    final db = await database;
    await db.delete('session');
  }

  Future<List<Auto>> autos() async {
    final db = await database;
    final rows = await db.query('autos', orderBy: 'pendiente DESC, created_at DESC');
    return rows.map(Auto.fromRow).toList();
  }

  Future<void> upsertAuto(Auto auto) async {
    final db = await database;
    await db.insert('autos', auto.toRow(), conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<void> replaceSyncedAutos(List<Auto> remotos) async {
    final db = await database;
    await db.transaction((txn) async {
      await txn.delete('autos', where: 'pendiente = 0');
      for (final auto in remotos) {
        await txn.insert('autos', auto.toRow(), conflictAlgorithm: ConflictAlgorithm.replace);
      }
    });
  }

  Future<void> deleteAuto(String id) async {
    final db = await database;
    await db.delete('autos', where: 'id = ?', whereArgs: [id]);
  }

  Future<int> enqueueAccount({
    required String nombre,
    required String email,
    required String password,
    String? telefono,
  }) async {
    final db = await database;
    return db.insert('cuentas_pendientes', {
      'nombre': nombre,
      'email': email,
      'password': password,
      'telefono': telefono,
    });
  }

  Future<List<PendingAccount>> pendingAccounts() async {
    final db = await database;
    final rows = await db.query('cuentas_pendientes', orderBy: 'id ASC');
    return rows
        .map(
          (row) => PendingAccount(
            id: row['id'] as int,
            nombre: row['nombre'] as String,
            email: row['email'] as String,
            password: row['password'] as String,
            telefono: row['telefono'] as String?,
          ),
        )
        .toList();
  }

  Future<void> deletePendingAccount(int id) async {
    final db = await database;
    await db.delete('cuentas_pendientes', where: 'id = ?', whereArgs: [id]);
  }
}
