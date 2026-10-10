import 'package:flutter/material.dart';

import '../app_state.dart';
import 'register_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.state});

  final AppState state;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _form = GlobalKey<FormState>();
  late final TextEditingController _servidor;
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _cargando = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _servidor = TextEditingController(text: widget.state.baseUrl);
  }

  @override
  void dispose() {
    _servidor.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _entrar() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _cargando = true;
      _error = null;
    });
    try {
      await widget.state.login(_email.text, _password.text, servidor: _servidor.text);
    } catch (error) {
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _cargando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            const SizedBox(height: 48),
            Text('Refaccionaria', style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 8),
            const Text(
              'Pega la misma dirección con la que abres el sitio en el navegador, sin /api al final.',
            ),
            const SizedBox(height: 24),
            Form(
              key: _form,
              child: Column(
                children: [
                  TextFormField(
                    controller: _servidor,
                    keyboardType: TextInputType.url,
                    decoration: const InputDecoration(
                      labelText: 'Servidor',
                      hintText: 'https://tu-app.onrender.com',
                    ),
                    validator: (value) {
                      final uri = Uri.tryParse(value?.trim() ?? '');
                      if (uri == null || uri.host.isEmpty || (uri.scheme != 'https' && uri.scheme != 'http')) {
                        return 'Dirección no válida';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    autofillHints: const [AutofillHints.email],
                    decoration: const InputDecoration(labelText: 'Correo'),
                    validator: (value) {
                      final email = value?.trim() ?? '';
                      if (!email.contains('@') || !email.contains('.')) return 'Correo no válido';
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _password,
                    obscureText: true,
                    decoration: const InputDecoration(labelText: 'Contraseña'),
                    validator: (value) =>
                        (value == null || value.length < 8) ? 'Mínimo 8 caracteres' : null,
                  ),
                ],
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ],
            if (widget.state.aviso != null) ...[
              const SizedBox(height: 12),
              Text(widget.state.aviso!),
            ],
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _cargando ? null : _entrar,
              child: Text(_cargando ? 'Entrando…' : 'Entrar'),
            ),
            TextButton(
              onPressed: () async {
                try {
                  await widget.state.usarServidor(_servidor.text);
                } catch (error) {
                  setState(() => _error = error.toString());
                  return;
                }
                if (!mounted) return;
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => RegisterScreen(state: widget.state)),
                );
              },
              child: const Text('Crear cuenta'),
            ),
          ],
        ),
      ),
    );
  }
}
