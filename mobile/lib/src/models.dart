class AppUser {
  AppUser({
    required this.id,
    required this.nombre,
    required this.email,
    this.telefono,
    required this.rol,
    this.createdAt,
  });

  final String id;
  final String nombre;
  final String email;
  final String? telefono;
  final String rol;
  final String? createdAt;

  bool get esCliente => rol == 'cliente';
  bool get esAdmin => rol == 'admin';

  factory AppUser.fromJson(Map<String, dynamic> json) {
    return AppUser(
      id: json['id'] as String,
      nombre: json['nombre'] as String,
      email: json['email'] as String,
      telefono: json['telefono'] as String?,
      rol: json['rol'] as String,
      createdAt: json['created_at'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'nombre': nombre,
        'email': email,
        'telefono': telefono,
        'rol': rol,
        'created_at': createdAt,
      };
}

class Auto {
  Auto({
    required this.id,
    required this.marca,
    required this.modelo,
    required this.anio,
    this.placas,
    this.vin,
    this.color,
    this.usuarioId,
    this.createdAt,
    this.pendiente = false,
  });

  final String id;
  final String marca;
  final String modelo;
  final int anio;
  final String? placas;
  final String? vin;
  final String? color;
  final String? usuarioId;
  final String? createdAt;
  final bool pendiente;

  String get titulo => '$marca $modelo ($anio)';

  factory Auto.fromJson(Map<String, dynamic> json, {bool pendiente = false}) {
    return Auto(
      id: json['id'] as String,
      marca: json['marca'] as String,
      modelo: json['modelo'] as String,
      anio: (json['anio'] as num).toInt(),
      placas: json['placas'] as String?,
      vin: json['vin'] as String?,
      color: json['color'] as String?,
      usuarioId: json['usuario_id'] as String?,
      createdAt: json['created_at'] as String?,
      pendiente: pendiente,
    );
  }

  factory Auto.fromRow(Map<String, Object?> row) {
    return Auto(
      id: row['id'] as String,
      marca: row['marca'] as String,
      modelo: row['modelo'] as String,
      anio: row['anio'] as int,
      placas: row['placas'] as String?,
      vin: row['vin'] as String?,
      color: row['color'] as String?,
      usuarioId: row['usuario_id'] as String?,
      createdAt: row['created_at'] as String?,
      pendiente: (row['pendiente'] as int? ?? 0) == 1,
    );
  }

  Map<String, Object?> toRow() => {
        'id': id,
        'marca': marca,
        'modelo': modelo,
        'anio': anio,
        'placas': placas,
        'vin': vin,
        'color': color,
        'usuario_id': usuarioId,
        'created_at': createdAt,
        'pendiente': pendiente ? 1 : 0,
      };

  Map<String, dynamic> toApiBody() => {
        'marca': marca,
        'modelo': modelo,
        'anio': anio,
        if (placas != null && placas!.isNotEmpty) 'placas': placas,
        if (vin != null && vin!.isNotEmpty) 'vin': vin,
        if (color != null && color!.isNotEmpty) 'color': color,
      };
}
