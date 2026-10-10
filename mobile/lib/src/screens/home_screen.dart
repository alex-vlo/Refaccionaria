import 'package:flutter/material.dart';

import '../app_state.dart';
import '../models.dart';
import 'auto_form_screen.dart';
import 'register_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key, required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    final user = state.user!;
    return Scaffold(
      appBar: AppBar(
        title: Text(user.esCliente ? 'Mis autos' : 'Refaccionaria'),
        actions: [
          IconButton(
            tooltip: 'Sincronizar',
            onPressed: state.sincronizando ? null : state.sincronizar,
            icon: state.sincronizando
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.sync),
          ),
          IconButton(
            tooltip: 'Cerrar sesión',
            onPressed: state.cerrarSesion,
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      floatingActionButton: user.esCliente
          ? FloatingActionButton.extended(
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => AutoFormScreen(state: state)),
                );
              },
              icon: const Icon(Icons.directions_car),
              label: const Text('Agregar auto'),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: state.sincronizar,
        child: user.esCliente ? _ListaAutos(state: state) : _PanelStaff(state: state),
      ),
    );
  }
}

class _PanelStaff extends StatelessWidget {
  const _PanelStaff({required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    final user = state.user!;
    final rol = user.esAdmin ? 'Administrador' : 'Empleado';
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(24),
      children: [
        _Estado(state: state),
        const SizedBox(height: 16),
        Text(user.nombre, style: Theme.of(context).textTheme.headlineSmall),
        Text('$rol · ${user.email}'),
        const SizedBox(height: 16),
        _UbicacionButton(state: state),
        const SizedBox(height: 16),
        const Text(
          'En el móvil el administrador inicia sesión y puede crear cuentas. '
          'Consultar y agregar autos es una función del cliente.',
        ),
        const SizedBox(height: 20),
        FilledButton(
          onPressed: () {
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => RegisterScreen(state: state, entrar: false),
              ),
            );
          },
          child: const Text('Crear cuenta'),
        ),
      ],
    );
  }
}

class _ListaAutos extends StatelessWidget {
  const _ListaAutos({required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    final autos = state.autos;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
      children: [
        _Estado(state: state),
        const SizedBox(height: 12),
        _UbicacionButton(state: state),
        const SizedBox(height: 12),
        if (autos.isEmpty)
          const Padding(
            padding: EdgeInsets.only(top: 48),
            child: Text('Todavía no hay autos. Agrega el tuyo o desliza para sincronizar.'),
          )
        else
          ...autos.map((auto) => _AutoTile(auto: auto)),
      ],
    );
  }
}

class _AutoTile extends StatelessWidget {
  const _AutoTile({required this.auto});

  final Auto auto;

  @override
  Widget build(BuildContext context) {
    final detalle = [
      if (auto.placas != null) auto.placas,
      if (auto.color != null) auto.color,
      if (auto.vin != null) 'VIN ${auto.vin}',
    ].whereType<String>().join(' · ');

    return Card(
      child: ListTile(
        title: Text(auto.titulo),
        subtitle: Text(detalle.isEmpty ? 'Sin placas' : detalle),
        trailing: auto.pendiente
            ? const Chip(label: Text('Local'))
            : const Icon(Icons.cloud_done_outlined),
      ),
    );
  }
}

class _UbicacionButton extends StatefulWidget {
  const _UbicacionButton({required this.state});

  final AppState state;

  @override
  State<_UbicacionButton> createState() => _UbicacionButtonState();
}

class _UbicacionButtonState extends State<_UbicacionButton> {
  bool _enviando = false;

  Future<void> _compartir() async {
    setState(() => _enviando = true);
    try {
      await widget.state.compartirUbicacion();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Ubicación guardada')),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: _enviando ? null : _compartir,
      icon: const Icon(Icons.my_location),
      label: Text(_enviando ? 'Obteniendo GPS…' : 'Compartir mi ubicación'),
    );
  }
}

class _Estado extends StatelessWidget {
  const _Estado({required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    final texto = state.enLinea ? 'Conectado. Los cambios locales se envían al servidor.' : 'Sin conexión. Los datos se leen desde el teléfono.';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(texto),
        if (state.aviso != null) ...[
          const SizedBox(height: 8),
          Text(state.aviso!),
        ],
      ],
    );
  }
}
