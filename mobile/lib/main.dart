import 'package:flutter/material.dart';

import 'src/app_state.dart';
import 'src/screens/home_screen.dart';
import 'src/screens/login_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(RefaccionariaApp(state: AppState()));
}

class RefaccionariaApp extends StatefulWidget {
  const RefaccionariaApp({super.key, required this.state});

  final AppState state;

  @override
  State<RefaccionariaApp> createState() => _RefaccionariaAppState();
}

class _RefaccionariaAppState extends State<RefaccionariaApp> {
  @override
  void initState() {
    super.initState();
    widget.state.iniciar();
    widget.state.addListener(_onChange);
  }

  void _onChange() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    widget.state.removeListener(_onChange);
    widget.state.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.state;
    return MaterialApp(
      title: 'Refaccionaria',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0F6E56)),
        useMaterial3: true,
        inputDecorationTheme: const InputDecorationTheme(border: OutlineInputBorder()),
      ),
      home: !state.listo
          ? const Scaffold(body: Center(child: CircularProgressIndicator()))
          : state.user == null
              ? LoginScreen(state: state)
              : HomeScreen(state: state),
    );
  }
}
