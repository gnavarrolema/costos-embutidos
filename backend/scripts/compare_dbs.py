#!/usr/bin/env python3
"""Script para comparar dos bases de datos"""
import sqlite3
import os

os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

print("=== BD EN RAÍZ (costos_embutidos.db) ===")
if os.path.exists("costos_embutidos.db"):
    conn = sqlite3.connect("costos_embutidos.db")
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM materias_primas WHERE activo=1")
    mp = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM productos WHERE activo=1")
    prod = c.fetchone()[0]
    c.execute("SELECT id, nombre FROM materias_primas WHERE activo=1 LIMIT 5")
    mps = c.fetchall()
    print(f"  Materias primas activas: {mp}")
    print(f"  Productos activos: {prod}")
    if mps:
        print("  Primeras MP:", mps)
    conn.close()
else:
    print("  NO EXISTE")

print("\n=== BD EN BACKEND (backend/costos_embutidos.db) ===")
if os.path.exists("backend/costos_embutidos.db"):
    conn = sqlite3.connect("backend/costos_embutidos.db")
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM materias_primas WHERE activo=1")
    mp = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM productos WHERE activo=1")
    prod = c.fetchone()[0]
    c.execute("SELECT id, nombre FROM materias_primas WHERE activo=1 LIMIT 5")
    mps = c.fetchall()
    print(f"  Materias primas activas: {mp}")
    print(f"  Productos activos: {prod}")
    if mps:
        print("  Primeras MP:", mps)
    conn.close()
else:
    print("  NO EXISTE")
