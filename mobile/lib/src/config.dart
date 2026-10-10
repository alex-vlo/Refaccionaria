/// Base del API Node. El emulador de Android llega al PC por 10.0.2.2.
/// En un teléfono físico usa la IP de la máquina, por ejemplo:
/// flutter run --dart-define=API_BASE=http://192.168.1.20:3000
const String apiBase = String.fromEnvironment(
  'API_BASE',
  defaultValue: 'http://10.0.2.2:3000',
);
