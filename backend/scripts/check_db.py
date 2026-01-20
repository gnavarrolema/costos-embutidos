#!/usr/bin/env python3
"""Script para verificar el contenido de la base de datos"""
import sqlite3
import os

# Buscar la base de datos
db_paths = [
    'costos_embutidos.db',
    '../costos_embutidos.db',
    'backend/costos_embutidos.db'
]

db_path = None
for path in db_paths:
    if os.path.exists(path):
        db_path = path
        break

if not db_path:
    print("❌ No se encontró la base de datos")
    exit(1)

print(f"📁 Base de datos encontrada: {os.path.abspath(db_path)}")
print(f"📏 Tamaño: {os.path.getsize(db_path)} bytes")
print(f"📅 Última modificación: {os.path.getmtime(db_path)}")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Listar tablas
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print(f"\n📊 Tablas encontradas: {[t[0] for t in tables]}")

# Verificar materias primas
print("\n=== MATERIAS PRIMAS ===")
cursor.execute("SELECT COUNT(*) FROM materias_primas")
total = cursor.fetchone()[0]
print(f"Total (incluyendo inactivas): {total}")

cursor.execute("SELECT COUNT(*) FROM materias_primas WHERE activo = 1")
activas = cursor.fetchone()[0]
print(f"Activas: {activas}")

cursor.execute("SELECT id, codigo, nombre, costo_unitario, activo FROM materias_primas ORDER BY id")
print("\nDetalle:")
for row in cursor.fetchall():
    estado = "✅" if row[4] else "❌"
    print(f"  {estado} ID {row[0]}: [{row[1]}] {row[2]} @ ${row[3]}")

# Verificar categorías
print("\n=== CATEGORÍAS ===")
cursor.execute("SELECT id, nombre, tipo FROM categorias ORDER BY id")
for row in cursor.fetchall():
    print(f"  ID {row[0]}: {row[1]} ({row[2]})")

# Verificar productos
print("\n=== PRODUCTOS ===")
cursor.execute("SELECT COUNT(*) FROM productos WHERE activo = 1")
productos = cursor.fetchone()[0]
print(f"Productos activos: {productos}")

cursor.execute("SELECT id, codigo, nombre, activo FROM productos ORDER BY id")
for row in cursor.fetchall():
    estado = "✅" if row[3] else "❌"
    print(f"  {estado} ID {row[0]}: [{row[1]}] {row[2]}")

conn.close()
