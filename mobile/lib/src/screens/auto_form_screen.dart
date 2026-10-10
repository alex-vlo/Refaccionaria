import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../app_state.dart';

class AutoFormScreen extends StatefulWidget {
  const AutoFormScreen({super.key, required this.state});

  final AppState state;

  @override
  State<AutoFormScreen> createState() => _AutoFormScreenState();
}

class _AutoFormScreenState extends State<AutoFormScreen> {
  final _form = GlobalKey<FormState>();
  final _marca = TextEditingController();
  final _modelo = TextEditingController();
  final _anio = TextEditingController();
  final _placas = TextEditingController();
  final _vin = TextEditingController();
  final _color = TextEditingController();
  bool _cargando = false;
  String? _error;

  @override
  void dispose() {
    _marca.dispose();
    _modelo.dispose();
    _anio.dispose();
    _placas.dispose();
    _vin.dispose();
    _color.dispose();
    super.dispose();
  }

  Future<void> _guardar() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _cargando = true;
      _error = null;
    });
    try {
      await widget.state.agregarAuto(
        marca: _marca.text,
        modelo: _modelo.text,
        anio: int.parse(_anio.text.trim()),
        placas: _placas.text,
        vin: _vin.text,
        color: _color.text,
      );
      if (mounted) Navigator.of(context).pop();
    } catch (error) {
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _cargando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final maxAnio = DateTime.now().year + 1;
    return Scaffold(
      appBar: AppBar(title: const Text('Agregar auto')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Form(
            key: _form,
            child: Column(
              children: [
                TextFormField(
                  controller: _marca,
                  decoration: const InputDecoration(labelText: 'Marca'),
                  validator: _requerido,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _modelo,
                  decoration: const InputDecoration(labelText: 'Modelo'),
                  validator: _requerido,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _anio,
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  decoration: const InputDecoration(labelText: 'Año'),
                  validator: (value) {
                    final anio = int.tryParse(value?.trim() ?? '');
                    if (anio == null || anio < 1900 || anio > maxAnio) {
                      return 'Año entre 1900 y $maxAnio';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _placas,
                  textCapitalization: TextCapitalization.characters,
                  decoration: const InputDecoration(labelText: 'Placas (opcional)'),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _vin,
                  textCapitalization: TextCapitalization.characters,
                  decoration: const InputDecoration(labelText: 'VIN (opcional)'),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _color,
                  decoration: const InputDecoration(labelText: 'Color (opcional)'),
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
            onPressed: _cargando ? null : _guardar,
            child: Text(_cargando ? 'Guardando…' : 'Guardar'),
          ),
        ],
      ),
    );
  }

  String? _requerido(String? value) {
    if (value == null || value.trim().isEmpty) return 'Campo obligatorio';
    return null;
  }
}
