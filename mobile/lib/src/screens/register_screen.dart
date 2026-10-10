import 'package:flutter/material.dart';

import '../app_state.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key, required this.state, this.entrar = true});

  final AppState state;
  final bool entrar;

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _form = GlobalKey<FormState>();
  final _nombre = TextEditingController();
  final _email = TextEditingController();
  final _telefono = TextEditingController();
  final _password = TextEditingController();
  bool _cargando = false;
  String? _error;

  @override
  void dispose() {
    _nombre.dispose();
    _email.dispose();
    _telefono.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _crear() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _cargando = true;
      _error = null;
    });
    try {
      final mensaje = await widget.state.registrar(
        nombre: _nombre.text,
        email: _email.text,
        password: _password.text,
        telefono: _telefono.text,
        entrar: widget.entrar,
      );
      if (!mounted) return;
      if (widget.state.user != null) {
        Navigator.of(context).pop();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(mensaje)));
        Navigator.of(context).pop();
      }
    } catch (error) {
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _cargando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Crear cuenta')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          const Text(
            'La primera cuenta del sistema queda como administrador. Las siguientes entran como clientes.',
          ),
          const SizedBox(height: 16),
          Form(
            key: _form,
            child: Column(
              children: [
                TextFormField(
                  controller: _nombre,
                  decoration: const InputDecoration(labelText: 'Nombre'),
                  validator: (value) =>
                      (value == null || value.trim().isEmpty) ? 'El nombre es obligatorio' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(labelText: 'Correo'),
                  validator: (value) {
                    final email = value?.trim() ?? '';
                    if (!email.contains('@') || !email.contains('.')) return 'Correo no válido';
                    return null;
                  },
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _telefono,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(labelText: 'Teléfono (opcional)'),
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
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _cargando ? null : _crear,
            child: Text(_cargando ? 'Guardando…' : 'Crear cuenta'),
          ),
        ],
      ),
    );
  }
}
