# 📚 Guía de Usuario - Sistema de Costeo de Embutidos

**Versión 1.5.0** | Guía completa para aprovechar todas las funcionalidades del sistema

---

## 📑 Índice

1. [Introducción](#introducción)
2. [Instalación y Ejecución](#instalación-y-ejecución-del-sistema)
3. [Primeros Pasos](#primeros-pasos)
4. [Flujo de Trabajo Recomendado](#flujo-de-trabajo-recomendado)
5. [Módulos del Sistema](#módulos-del-sistema)
   - [Dashboard](#-dashboard)
   - [Materias Primas](#-materias-primas)
   - [Productos](#-productos)
   - [Producción Programada](#-producción-programada)
   - [Costos Indirectos](#-costos-indirectos)
   - [Planificación](#-planificación-hoja-de-costos)
   - [Proyecciones ML](#-proyecciones-ml)
   - [Escenarios](#-escenarios-what-if-analysis)
6. [Preguntas Frecuentes](#preguntas-frecuentes)
7. [Solución de Problemas](#solución-de-problemas)

---

## Introducción

El **Sistema de Costeo de Embutidos** es una herramienta integral diseñada para planificar, controlar y analizar los costos de producción en la industria de embutidos. 

### ¿Qué puedo hacer con este sistema?

✅ Gestionar precios de materias primas  
✅ Formular productos con recetas  
✅ Calcular costos completos de producción (MP + Indirectos + Inflación)  
✅ Planificar producción con visibilidad total de costos  
✅ Analizar escenarios hipotéticos  
✅ Proyectar precios futuros con Machine Learning  

### 💾 Persistencia de Datos

**Todos sus datos se guardan automáticamente y de forma permanente** en la base de datos del sistema.

✅ **No necesita guardar manualmente** - Cada cambio se guarda automáticamente  
✅ **Los datos persisten** - Sus productos, precios, producción programada, etc. permanecen guardados entre sesiones  
✅ **Seguro y confiable** - La base de datos SQLite almacena toda la información en `backend/costos_embutidos.db`  

> 💡 **Tranquilidad**: Puede cerrar la aplicación en cualquier momento. Al volver a abrirla, todos sus datos estarán exactamente como los dejó.

---

## Instalación y Ejecución del Sistema

Esta sección le guiará a través de los pasos necesarios para instalar dependencias y ejecutar el sistema en **WSL Ubuntu 22.04**.

### 📋 Requisitos Previos

Antes de comenzar, asegúrese de tener instalado:
- **WSL Ubuntu 22.04** configurado en su sistema Windows
- **Node.js** (versión 16 o superior)
- **Python 3.8+**
- **pip** (gestor de paquetes de Python)

### 🔧 Paso 1: Verificar Requisitos

Abra una terminal de WSL Ubuntu y ejecute los siguientes comandos para verificar las versiones instaladas:

```bash
# Verificar Node.js
node --version

# Verificar npm
npm --version

# Verificar Python
python3 --version

# Verificar pip
pip3 --version
```

Si alguna de estas herramientas no está instalada, deberá instalarlas antes de continuar.

#### 📥 Instalación de Requisitos Previos (Si es necesario)

<details>
<summary><b>Click aquí si necesita instalar Node.js, Python o pip</b></summary>

##### Instalar Node.js y npm

```bash
# Instalar Node.js 18.x LTS (versión recomendada)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar instalación
node --version
npm --version
```

##### Instalar Python 3 y pip

```bash
# Actualizar repositorios
sudo apt update

# Instalar Python 3, pip y herramientas de desarrollo
sudo apt install -y python3 python3-pip python3-venv build-essential

# Verificar instalación
python3 --version
pip3 --version
```

##### Instalar dependencias de compilación (requeridas para algunos paquetes Python)

```bash
# Estas son necesarias para compilar ciertos paquetes Python
sudo apt install -y build-essential libssl-dev libffi-dev python3-dev
```

</details>


### 📦 Paso 2: Instalar Dependencias

#### 2.1 Navegar al directorio del proyecto

```bash
# Navegue al directorio del proyecto
cd /mnt/d/gnavarro/Escritorio/Desarrollos/costos-embutidos
```

> 💡 **Nota**: La ruta en WSL para `D:\` es `/mnt/d/`

#### 2.2 Instalar dependencias del Frontend

```bash
# Instalar dependencias de Node.js
npm install
```

Esto instalará todas las dependencias necesarias definidas en `package.json` (React, Vite, etc.)

#### 2.3 Instalar dependencias del Backend

```bash
# Si no existe el entorno virtual, créelo (solo necesario la primera vez)
python3 -m venv .venv

# Activar el entorno virtual
source .venv/bin/activate

# Instalar todas las dependencias de Python
pip install -r backend/requirements.txt
pip install -r backend/requirements-ml.txt
pip install -r backend/requirements-dev.txt
```

> 💡 **Nota**: El entorno virtual mantiene las dependencias del proyecto aisladas del sistema

> 💡 **Alternativa rápida**: Si ya ha clonado el proyecto, puede ejecutar el script automatizado:
> ```bash
> bash setup_env.sh
> ```
> Este script eliminará cualquier entorno duplicado, creará/actualizará `.venv` e instalará todas las dependencias automáticamente.

### 🚀 Paso 3: Ejecutar el Sistema

Necesitará **dos terminales separadas** para ejecutar el backend y el frontend simultáneamente.

#### Terminal 1: Ejecutar el Backend (Flask)

```bash
# En el directorio del proyecto, con el entorno virtual activado
cd /mnt/d/gnavarro/Escritorio/Desarrollos/costos-embutidos
source .venv/bin/activate

# Ejecutar el servidor Flask
python backend/app.py
```

**Salida esperada:**
```
 * Running on http://127.0.0.1:5000
 * Debug mode: on
```

> ✅ El backend estará disponible en `http://localhost:5000`

#### Terminal 2: Ejecutar el Frontend (React + Vite)

Abra una **nueva terminal de WSL** y ejecute:

```bash
# Navegar al directorio del proyecto
cd /mnt/d/gnavarro/Escritorio/Desarrollos/costos-embutidos

# Ejecutar el servidor de desarrollo de Vite
npm run dev
```

**Salida esperada:**
```
  VITE v5.x.x  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

> ✅ El frontend estará disponible en `http://localhost:5173`

#### 💻 Alternativa: Desde PowerShell/Windows Terminal

Si prefiere ejecutar desde PowerShell o Windows Terminal en lugar de abrir terminales WSL directamente:

**Terminal 1 (Backend) - PowerShell:**
```powershell
wsl -e bash -c "cd /mnt/d/gnavarro/Escritorio/Desarrollos/costos-embutidos && source .venv/bin/activate && python backend/app.py"
```

**Terminal 2 (Frontend) - PowerShell:**
```powershell
wsl -e bash -c "cd /mnt/d/gnavarro/Escritorio/Desarrollos/costos-embutidos && npm run dev"
```

> 💡 **Nota**: Ajuste la ruta `/mnt/d/gnavarro/Escritorio/Desarrollos/costos-embutidos` según la ubicación de su proyecto en WSL.

### 🌐 Paso 4: Acceder al Sistema

1. Abra su navegador web (Chrome, Firefox, Edge, etc.)
2. Navegue a: **`http://localhost:5173`**
3. El sistema debería cargar correctamente

### ✅ Verificar que Todo Funcione

Una vez abierto el sistema en el navegador:
- ✅ Debería ver la interfaz del Dashboard
- ✅ El menú lateral debería ser navegable
- ✅ No debería haber errores en la consola del navegador (F12)

### 🛑 Detener el Sistema

Para detener los servidores:

**En cada terminal:**
- Presione `Ctrl + C` para detener el proceso

**Para desactivar el entorno virtual de Python:**
```bash
deactivate
```

### 🔄 Ejecución en Sesiones Futuras

Para ejecutar el sistema en el futuro, simplemente repita el **Paso 3**:

**Desde WSL directamente:**
```bash
# Terminal 1: Backend
cd /mnt/d/gnavarro/Escritorio/Desarrollos/costos-embutidos
source .venv/bin/activate
python backend/app.py

# Terminal 2: Frontend
cd /mnt/d/gnavarro/Escritorio/Desarrollos/costos-embutidos
npm run dev
```

**Desde PowerShell/Windows Terminal:**
```powershell
# Terminal 1: Backend
wsl -e bash -c "cd /mnt/d/gnavarro/Escritorio/Desarrollos/costos-embutidos && source .venv/bin/activate && python backend/app.py"

# Terminal 2: Frontend
wsl -e bash -c "cd /mnt/d/gnavarro/Escritorio/Desarrollos/costos-embutidos && npm run dev"
```

```

---

## Primeros Pasos

### 1. Acceder al Sistema

Abra su navegador y vaya a: `http://localhost:5173`

### 2. Navegación

El menú lateral izquierdo contiene todos los módulos:

| Icono | Módulo | Descripción |
|-------|--------|-------------|
| 🏠 | Dashboard | Vista general y KPIs |
| 📦 | Materias Primas | Gestión de ingredientes |
| 🌭 | Productos | Gestión de productos |
| 📊 | Producción Programada | Planificación de producción |
| 💰 | Costos Indirectos | Gastos fijos y variables |
| 📋 | Planificación | Hoja de costos detallada |
| 📈 | Proyecciones | Predicciones ML |
| 🎯 | Escenarios | Análisis What-If |


---

## 🎓 Tutorial Completo: De Cero a Costos Finales

Esta guía paso a paso le enseñará a calcular los costos completos de sus productos desde cero. **No necesita experiencia previa**.

### 📋 Escenario de Ejemplo

Vamos a costear una **Salchicha Parrillera** con este escenario real:

**Información del producto**:
- Tamaño de lote (batch): 50 kg
- Tiempo de producción: 120 minutos por batch
- Producción planificada: 100 kg para Marzo 2025

**Ingredientes necesarios** (por cada 50 kg):
- Carne de cerdo: 30 kg @ $2,500/kg
- Carne de pollo: 15 kg @ $1,800/kg  
- Sal y condimentos: 3 kg @ $800/kg
- Envases: 50 unidades @ $50/unidad

**Costos indirectos del mes** (Febrero 2025 - mes base):
- Sueldos y aportes: $500,000
- Gastos de fabricación (GIF): $200,000
- Depreciación: $100,000

**Inflación**:
- Febrero a Marzo: 5%

---

### PASO 1: Cargar Materias Primas 📦

#### 1.1 Acceder al módulo
1. En el menú lateral, haga clic en **"📦 Materias Primas"**
2. Verá una lista de ingredientes (puede estar vacía al inicio)

#### 1.2 Agregar cada ingrediente

**Para Carne de Cerdo**:
1. Clic en **"+ Nueva Materia Prima"**
2. Complete el formulario:
   ```
   Nombre:          Carne de Cerdo
   Categoría:       CERDO
   Unidad:          Kg
   Precio/Unidad:   2500
   ```
3. Clic en **"Guardar"**

**Repita el proceso** para los demás ingredientes:
- Carne de Pollo (Categoría: POLLO, $1,800/kg)
- Sal y Condimentos (Categoría: INSUMOS, $800/kg)
- Envases (Categoría: ENVASES, Unidad: Unidad, $50/unidad)

#### ✅ Validación del Paso 1
En la lista de Materias Primas debería ver 4 ingredientes con sus precios.

---

### PASO 2: Crear el Producto 🌭

#### 2.1 Acceder al módulo
1. En el menú lateral, clic en **"🌭 Productos"**
2. Clic en **"+ Nuevo Producto"**

#### 2.2 Completar información básica
```
Código:           SAL-001
Nombre:           Salchicha Parrillera
Peso por Batch:   50        (kg)
Minutos MO/Kg:    2.4       (Ingresar valor unitario)
```

**Nota**: El sistema mostrará automáticamente:
```
Tiempo por Batch = 2.4 min/kg × 50 kg = 120 minutos
```

3. Clic en **"Guardar"**

#### ✅ Validación del Paso 2
El producto "Salchicha Parrillera" aparece en la lista de productos.

---

### PASO 3: Definir la Fórmula (Receta) 🧪

#### 3.1 Acceder a formulación
1. En la lista de productos, busque "Salchicha Parrillera"
2. Clic en el botón **"Fórmula"** o **"Editar Fórmula"**

#### 3.2 Agregar ingredientes

Para cada ingrediente, clic en **"+ Agregar Ingrediente"**:

**Ingrediente 1**: Carne de Cerdo
```
Materia Prima:   Carne de Cerdo
Cantidad:        30    (kg por batch de 50 kg)
```

**Ingrediente 2**: Carne de Pollo
```
Materia Prima:   Carne de Pollo
Cantidad:        15    (kg por batch de 50 kg)
```

**Ingrediente 3**: Sal y Condimentos
```
Materia Prima:   Sal y Condimentos
Cantidad:        3     (kg por batch de 50 kg)
```

**Ingrediente 4**: Envases
```
Materia Prima:   Envases
Cantidad:        50    (unidades por batch de 50 kg)
```

#### 3.3 Verificar el costo calculado

El sistema calcula automáticamente:
```
Carne Cerdo:      30 kg × $2,500 = $75,000
Carne Pollo:      15 kg × $1,800 = $27,000
Sal y Condimentos: 3 kg × $800   = $2,400
Envases:          50 un × $50    = $2,500
─────────────────────────────────────────
TOTAL BATCH:                       $106,900
COSTO POR KG:     $106,900 ÷ 50 kg = $2,138/kg
```

#### ✅ Validación del Paso 3
- La fórmula muestra 4 ingredientes
- El costo total por batch es $106,900
- El costo por kg es $2,138

#### 📌 Importante: Cómo Funciona la Merma

El sistema calcula la **merma** (o **rendimiento**) de la siguiente manera:

> **Concepto**: El **Peso por Batch** que ingresó (50 kg) representa el peso **bruto de los ingredientes** que pone en la procesadora/mezcladora, NO el peso del producto terminado.

**Ejemplo con Merma del 3.6%:**

```
Ingredientes totales (peso bruto):  50 kg
Merma de proceso:                   3.6%
Rendimiento:                        96.4%
Producto final obtenido:            50 kg × 0.964 = 48.2 kg
```

**¿Cómo afecta al costo por kg?**

```
Costo Total Batch:     $106,900
Peso Neto (rendimiento): 48.2 kg   (NO 50 kg)
────────────────────────────────────
Costo por Kg Real:     $106,900 ÷ 48.2 kg = $2,217.84/kg
```

**Sin considerar merma (INCORRECTO)**:
- $106,900 ÷ 50 kg = $2,138/kg

**Considerando merma (CORRECTO)**:
- $106,900 ÷ 48.2 kg = $2,217.84/kg

> 💡 **Conclusión**: La merma aumenta el costo por kg porque obtienes menos producto final con el mismo costo de ingredientes.

El **% de Merma** se configura en el módulo **Productos** al crear o editar cada producto.

---

### PASO 4: Configurar Costos Indirectos 💰

> ⚠️ **IMPORTANTE**: Los costos indirectos se configuran **por mes**. Debe ingresar los costos para cada mes donde planifique producción.

#### 4.1 Acceder al módulo
1. En el menú lateral, clic en **"💰 Costos Indirectos"**

#### 4.2 Configurar costos para Febrero (mes base)
1. En el selector de mes, elija **"Febrero 2025"**
2. Este será nuestro mes base de referencia

#### 4.3 Ingresar costos por tipo

**Sueldos y Aportes Patronales (SP)**:
```
Cuenta:   Sueldos Personal Planta
Tipo:     SP
Monto:    500000
```
Clic en **"Guardar"**

**Gastos Indirectos de Fabricación (GIF)**:
```
Cuenta:   Servicios y Mantenimiento
Tipo:     GIF
Monto:    200000
```
Clic en **"Guardar"**

**Depreciación (DEP)**:
```
Cuenta:   Depreciación Maquinaria
Tipo:     DEP
Monto:    100000
```
Clic en **"Guardar"**

#### 4.4 Configurar costos para Marzo (mes de producción)

**CRÍTICO**: Ahora debe configurar los costos también para Marzo:

1. En el selector de mes, cambie a **"Marzo 2025"**
2. Ingrese los mismos costos (en este ejemplo, se mantienen igual):
   - Sueldos: $500,000 (tipo SP)
   - Servicios: $200,000 (tipo GIF)
   - Depreciación: $100,000 (tipo DEP)

> 💡 **¿Por qué hacer esto?**: El sistema toma los costos indirectos del mes de producción y les aplica la inflación desde el mes base. Si no hay costos para Marzo, aparecerían en $0.

#### ✅ Validación del Paso 4
- Febrero 2025 tiene costos totales de $800,000
- Marzo 2025 tiene costos totales de $800,000 (o los valores reales del mes)
- Ambos meses muestran resumen completo

#### 4.5 Concepto: Mes Base vs Mes de Producción

**Entender esta diferencia es clave:**

| Concepto | Definición | Uso |
|----------|------------|-----|
| **Mes Base** | Mes de referencia con costos "congelados" | Para comparar y aplicar inflación |
| **Mes de Producción** | Mes donde realmente se produce | Se calculan costos con inflación aplicada |

**Ejemplo práctico:**
```
Febrero (Mes Base):
- Costos cerrados: $800,000
- Precios MP: Fijos

Marzo (Mes Producción):
- Costos base: $800,000 (mismos que Febrero)
- Inflación: +5%
- Costos ajustados: $840,000
```

> 💡 **Flujo recomendado**: Configure costos del mes anterior (cerrado) como "mes base" y del mes actual/futuro como "mes de producción" con la misma estructura, permitiendo que el sistema aplique inflación automáticamente.

---

### PASO 5: Configurar Inflación 📈

#### 5.1 Abrir configuración de inflación
1. Dentro de **"Costos Indirectos"**, clic en **"📈 Configurar Inflación"**
2. Se abre una tabla con 12 meses

#### 5.2 Ingresar tasa de inflación
Para nuestro ejemplo, solo necesitamos configurar Marzo 2025:

```
Mes:          Marzo 2025
Porcentaje:   5.0        (igual a 5%)
```

3. Clic en **"Guardar"**

#### Cómo se calcula la inflación acumulada:

Si planificamos producción en Marzo (mes producción) con costos base de Febrero (mes base):

```
Inflación Marzo: 5%
Factor de inflación: 1.05

Todos los costos se multiplicarán por 1.05
```

#### ✅ Validación del Paso 5
La tabla de inflación muestra 5.0% para Marzo 2025.

---

### PASO 6: Planificar Producción 📊

Ahora vamos a planificar la producción real y ver los costos completos.

#### 6.1 Acceder al módulo
1. En el menú lateral, clic en **"📊 Producción Programada"**

#### 6.2 Seleccionar mes de producción
1. En el selector de mes principal, elija **"Marzo 2025"**
2. El sistema automáticamente usará los costos de Marzo que configuramos en el Paso 4.4

> 💡 **Nota sobre Mes Base**: En escenarios más complejos, si NO tiene costos para el mes de producción, puede usar el botón ⚙️ para seleccionar un "mes base" diferente. El sistema tomará esos costos y aplicará inflación. En este tutorial no es necesario porque ya configuramos costos para Marzo.

#### 6.4 Agregar producción
1. Clic en **"+ Agregar"**
2. Complete:
   ```
   Producto:   Salchicha Parrillera
   Fecha:      15/03/2025
   Batches:    2           (produciremos 2 batches = 100 kg)
   ```
3. Clic en **"Guardar"**

#### 6.5 Revisar los costos calculados

El sistema mostrará una tabla con:

| Columna | Valor Esperado | Explicación |
|---------|----------------|-------------|
| **Batches** | 2.00 | Cantidad de lotes |
| **Kg Total** | 100 kg | 2 batches × 50 kg/batch |
| **MP/Kg** | $2,244.90 | $2,138 × 1.05 (con inflación) |
| **Ind/Kg** | ≈ $8,400 | Costos indirectos distribuidos |
| **TOTAL/Kg** | ≈ $10,645 | MP + Indirectos (ambos con inflación) |
| **Costo Total** | ≈ $1,064,500 | 100 kg × TOTAL/Kg |

#### 🧮 Cómo se calculan los Costos Indirectos:

**Supongamos que solo producimos este producto en Marzo** (100 kg total del mes):

1. **Costos Indirectos Inflados**:
   ```
   SP inflado:  $500,000 × 1.05 = $525,000
   GIF inflado: $200,000 × 1.05 = $210,000
   DEP inflado: $100,000 × 1.05 = $105,000
   ─────────────────────────────────────
   Total Ind:                   $840,000
   ```

2. **Distribución**:
   - **SP**: Se distribuye por minutos
     ```
     Minutos totales = 100 kg × 2.4 min/kg = 240 min
     SP por minuto = $525,000 ÷ 240 min = $2,187.50/min
     SP para producto = 240 min × $2,187.50 = $525,000
     SP por Kg = $525,000 ÷ 100 kg = $5,250/kg
     ```

   > Nota: si en el mes la MO total resulta 0 (por ejemplo, productos con `Minutos MO/Kg = 0`),
   > el sistema distribuye **SP por Kg** como fallback para no “perder” el costo ni sobre-asignarlo.

   - **GIF y DEP**: Se distribuyen por Kg
     ```
     GIF por Kg = $210,000 ÷ 100 kg = $2,100/kg
     DEP por Kg = $105,000 ÷ 100 kg = $1,050/kg
     ```

   - **Total Indirectos por Kg**:
     ```
     Ind/Kg = $5,250 + $2,100 + $1,050 = $8,400/kg
     ```

3. **Costo Total por Kg**:
   ```
   MP/Kg:          $2,244.90
   Ind/Kg:         $8,400.00
   ───────────────────────────
   TOTAL/Kg:       $10,644.90
   ```

#### ✅ Validación del Paso 6
- La tabla muestra 1 registro de producción
- Los KPIs superiores muestran totales correctos
- El gráfico de composición muestra % de MP vs Indirectos

---

### PASO 7: Generar Hoja de Costos (Opcional) 📋

Para un reporte detallado y oficial:

#### 7.1 Acceder al módulo
1. En el menú lateral, clic en **"📋 Planificación"**

#### 7.2 Calcular costos del mes
1. Seleccionar **Año: 2025** y **Mes: Marzo**
2. Clic en **"Calcular Costos"**

#### 7.3 Revisar el reporte
El sistema genera un desglose detallado:
- Costo de cada ingrediente
- Distribución de cada costo indirecto
- Total por producto
- Comparativas

#### 7.4 Exportar (opcional)
1. Clic en **"Exportar a Excel"**
2. Se descarga un archivo con todos los detalles

---

### 🎯 Resumen del Tutorial

¡Felicidades! Acaba de completar el proceso completo de costeo:

✅ **PASO 1**: Cargó 4 materias primas con sus precios  
✅ **PASO 2**: Creó el producto "Salchicha Parrillera"  
✅ **PASO 3**: Definió la fórmula con 4 ingredientes → Costo MP: $2,138/kg  
✅ **PASO 4**: Configuró $800,000 en costos indirectos para Febrero  
✅ **PASO 5**: Estableció 5% de inflación para Marzo  
✅ **PASO 6**: Planificó 100 kg en Marzo → **Costo Final: $10,645/kg**  
✅ **PASO 7**: Generó reporte oficial  

### 📊 Fórmula General del Costo Final

```
COSTO FINAL POR KG = (MP/Kg base × Factor Inflación) + Indirectos/Kg

Donde:
- MP/Kg base: Costo de ingredientes en precio actual
- Factor Inflación: (1 + inflación acumulada %)
- Indirectos/Kg: (SP + GIF + DEP) distribuidos y con inflación
```

### ⚠️ Errores Comunes a Evitar

1. **Olvidar configurar el mes base** en Producción Programada
   - ❌ Resultado: Costos indirectos en $0
   - ✅ Solución: Configurar mes base con ⚙️

2. **No calcular minutos MO/Kg correctamente**
   - ❌ Error: Poner minutos totales del batch en el campo de minutos por kg
   - ✅ Solución: Ingrese el **Minuto por Kg** (el sistema le mostrará el Tiempo Total del Batch como referencia).

3. **Confundir batch con kilogramos**
   - ❌ Error: Poner cantidad en Kg en campo "Batches"
   - ✅ Correcto: Cantidad de lotes (batches)

4. **No aplicar inflación**
   - ❌ Error: Mes de producción = mes base → inflación 0%
   - ✅ Correcto: Mes de producción ≠ mes base → aplica inflación

5. **Fórmula incorrecta**
   - ❌ Error: Poner cantidades para 1 kg en vez de 1 batch
   - ✅ Correcto: Cantidades para el batch completo

### 🔄 Flujo Mensual Recurrente

Una vez configurado el sistema inicial, siga este proceso cada mes:

#### Opción A: Costear el Mes Actual (Escenario Real)

**Al inicio de cada mes (ej: Abril 2025)**:

1. **Actualizar Precios de MP** (si cambiaron)
   - Ir a **Materias Primas**
   - Actualizar precios uno por uno, o usar "Ajuste Masivo" por porcentaje

2. **Configurar Costos Indirectos del Mes**
   - Ir a **Costos Indirectos**
   - Seleccionar **Abril 2025**
   - Ingresar costos reales del mes (sueldos, GIF, depreciación)

3. **Actualizar Inflación**
   - En **Costos Indirectos** → **Configurar Inflación**
   - Ingresar el % de inflación de Abril

4. **Planificar Producción**
   - Ir a **Producción Programada**
   - Seleccionar mes: **Abril 2025**
   - Agregar los productos y cantidades a producir
   - El sistema calcula automáticamente todos los costos

5. **Generar Reporte** (opcional)
   - Ir a **Planificación**
   - Generar Hoja de Costos para Abril
   - Exportar a Excel si necesita

#### Opción B: Proyectar Meses Futuros (Planificación)

**Para planificar Mayo 2025 estando en Abril**:

1. **No actualice precios** - Use los actuales como base

2. **Configure inflación proyectada**
   - Ingrese el % estimado de inflación para Mayo

3. **Use el último mes como base**
   - En **Producción Programada**, seleccione Mayo
   - Configure mes base: Abril (usando ⚙️)
   - El sistema aplicará inflación sobre costos de Abril

4. **Opciones de Proyección**:
   - **Manual**: Ingrese cantidades estimadas
   - **Con ML**: Use **Proyecciones ML** para predecir
   - **Escenarios**: Use **Escenarios** para simular "qué pasaría si..."

### 💡 Consejos Pro

- **Guarde frecuentemente**: El sistema guarda automáticamente, pero siempre verifique
- **Use nombres descriptivos**: Facilita buscar productos más tarde
- **Revise los KPIs**: Valida que los números tengan sentido
- **Exporte reportes**: Útil para auditorías y análisis
- **Configure todos los costos indirectos**: Aunque sean $0, regístrelos para trazabilidad

---


## Flujo de Trabajo Recomendado

Para obtener costos precisos, siga este orden:

```
┌─────────────────────────────────────────────────────────────┐
│  PASO 1: Configurar Materias Primas                         │
│  Cargar ingredientes con precios actualizados               │
├─────────────────────────────────────────────────────────────┤
│  PASO 2: Crear Productos                                    │
│  Definir recetas y tiempos de producción                    │
├─────────────────────────────────────────────────────────────┤
│  PASO 3: Configurar Costos Indirectos                       │
│  Establecer sueldos, GIF y depreciación por mes             │
├─────────────────────────────────────────────────────────────┤
│  PASO 4: Configurar Inflación                               │
│  Ingresar tasas mensuales de inflación                      │
├─────────────────────────────────────────────────────────────┤
│  PASO 5: Calcular Costos                                    │
│  Generar "Hoja de Costos" para consolidar                   │
├─────────────────────────────────────────────────────────────┤
│  PASO 6: Planificar Producción                              │
│  Usar Producción Programada con costos completos            │
└─────────────────────────────────────────────────────────────┘
```

---

## Módulos del Sistema

### 🏠 Dashboard

**Propósito**: Vista rápida del estado general del sistema.

#### Secciones:

1. **KPIs Principales**
   - Total de productos
   - Total de materias primas
   - Costo promedio por Kg

2. **Alertas**
   - Precios desactualizados (más de 30 días sin actualizar)
   - Productos sin costeo

3. **Accesos Rápidos**
   - Botones directos a módulos más usados

---

### 📦 Materias Primas

**Propósito**: Gestionar los ingredientes utilizados en la producción.

#### Funcionalidades:

##### Agregar Materia Prima
1. Clic en **"+ Nueva Materia Prima"**
2. Completar:
   - **Nombre**: Nombre del ingrediente
   - **Categoría**: Clasificación (Carnes, Especias, Aditivos, etc.)
   - **Unidad**: Kg, Lt, Unidad, etc.
   - **Precio por unidad**: Costo actual

##### Actualización Masiva de Precios
1. Clic en **"Ajuste Masivo"**
2. Elegir tipo de ajuste:
   - **Por porcentaje**: Aplicar % de aumento/disminución
   - **Por categoría**: Ajustar solo una categoría específica
3. Confirmar cambios

##### Importar desde Excel
1. Clic en **"Importar Excel"**
2. Seleccionar archivo con formato:
   ```
   | Nombre | Categoría | Unidad | Precio |
   |--------|-----------|--------|--------|
   | Carne  | Carnes    | Kg     | 5500   |
   ```
3. Verificar datos y confirmar

##### Exportar a Excel
1. Clic en **"Exportar"**
2. Se descarga archivo con todas las materias primas

---

### 🌭 Productos

**Propósito**: Crear y gestionar productos con sus recetas.

#### Crear Producto:

1. Clic en **"+ Nuevo Producto"**
2. Completar información básica:
   - **Nombre**: Nombre del producto
   - **Descripción**: Detalles adicionales
   - **Kg por Batch**: Cantidad producida por lote
   - **Minutos por Batch**: Tiempo de producción

3. Agregar Fórmula (Receta):
   - Clic en **"Editar Fórmula"** o ir a módulo **Formulación**
   - Agregar ingredientes con cantidades por Kg de producto
   - El sistema calcula automáticamente el costo por Kg

#### Campos Importantes:

| Campo | Descripción | Uso |
|-------|-------------|-----|
| Kg/Batch | Kilogramos producidos por lote | Calcular batches necesarios |
| Min/Batch | Minutos por lote | **Automático**: Referencia del tiempo total (Min/Kg × Kg/Batch) |
| min_mo_kg | Minutos de mano de obra por Kg | **Dato de entrada**: Tiempo para producir 1 Kg (base para distribución SP) |

---

### 📊 Producción Programada

**Propósito**: Planificar la producción con **visibilidad completa de costos**.

> 💡 **Este es el módulo central para planificar producción con costos reales**

#### Interfaz Principal:

##### Barra de Contexto
```
📊 Base: Enero 2025 ▼  |  📈 Inflación: +5.2%
```
- **Mes Base**: Mes del cual se toman los costos (costos indirectos y MP)
- **Inflación**: % acumulado desde mes base hasta mes de producción

##### KPIs
| KPI | Descripción |
|-----|-------------|
| 📦 Batches | Total de lotes programados |
| ⚖️ Peso Total | Kilogramos totales a producir |
| 💵 Costo Total | Suma de todos los costos de producción |
| 📊 Costo Prom/Kg | Costo promedio ponderado |

##### Tabla de Producción

| Columna | Descripción |
|---------|-------------|
| Producto | Nombre del producto |
| Fecha | Fecha de producción programada |
| Batch | Cantidad de lotes |
| Kg | Kilogramos totales (Batch × Kg/Batch) |
| MP/Kg | Costo materias primas por Kg |
| Ind/Kg | Costo indirecto por Kg (SP + GIF + DEP) |
| TOTAL/Kg | Costo total por Kg (con inflación) |
| Costo Total | Kg × TOTAL/Kg |

##### Composición de Costos
Barra visual que muestra la proporción:
```
[████████████░░░░] MP: 75% | Ind: 25%
```

#### Uso del Módulo:

##### 1. Configurar Mes Base
1. Clic en ⚙️ (engranaje) en la barra superior
2. Seleccionar el mes que tiene costos calculados
3. El sistema detecta automáticamente el último mes con "Hoja de Costos"

##### 2. Agregar Producción
1. Clic en **"+ Nueva Producción"**
2. Seleccionar:
   - **Producto**: De la lista de productos
   - **Fecha**: Fecha de producción
   - **Batches**: Cantidad de lotes

##### 3. Ver Costos Completos
El sistema automáticamente:
- Toma costos del mes base seleccionado
- Calcula inflación acumulada hasta el mes de producción
- Aplica inflación a todos los costos
- Muestra desglose completo

##### 4. Cargar desde ML
1. Clic en **"🔮 Cargar desde ML"**
2. El sistema carga predicciones del módulo de Proyecciones
3. Se crean registros de producción basados en predicciones

#### Ejemplo Práctico:

```
Escenario:
- Mes Base: Enero 2025 (con costos calculados)
- Producción: Marzo 2025
- Inflación Ene-Mar: 8%

Cálculo:
- MP/Kg (base): $5,000
- Ind/Kg (base): $1,200
- Total base: $6,200/Kg
- Con inflación: $6,200 × 1.08 = $6,696/Kg
```

---

### 💰 Costos Indirectos

**Propósito**: Gestionar los costos que no son materias primas.

#### Categorías de Costos:

| Categoría | Abreviatura | Descripción | Distribución |
|-----------|-------------|-------------|--------------|
| Sueldos y Aportes Patronales | SP | Mano de obra | Por minutos de producción |
| Gastos Indirectos de Fabricación | GIF | Servicios, insumos, etc. | Por Kg producido |
| Depreciación | DEP | Amortización de maquinaria | Por Kg producido |

#### Configurar Costos:

1. Seleccionar **Mes** en el selector superior
2. Para cada categoría:
   - Ingresar el monto mensual total
   - Clic en **"Guardar"**

#### Configurar Inflación:

1. Clic en **"📈 Configurar Inflación"**
2. Se abre tabla de 12 meses
3. Ingresar tasa mensual para cada mes (ej: 4.5 para 4.5%)
4. El sistema calcula inflación acumulada automáticamente

> ⚠️ **Importante**: Los costos indirectos deben configurarse ANTES de calcular la "Hoja de Costos"

---

### 📋 Planificación (Hoja de Costos)

**Propósito**: Generar el costeo detallado de cada producto para un mes específico.

#### ¿Qué calcula?

1. **Costo de Materias Primas**
   - Suma de (Cantidad × Precio) de cada ingrediente
   - Por Kg de producto

2. **Costos Indirectos Distribuidos**
   - **SP**: Total SP ÷ Minutos totales × Minutos del producto
   - **GIF**: Total GIF ÷ Kg totales × Kg del producto
   - **DEP**: Total DEP ÷ Kg totales × Kg del producto

3. **Costo Total**
   - MP/Kg + SP/Kg + GIF/Kg + DEP/Kg

#### Pasos:

1. Seleccionar **Año** y **Mes**
2. Verificar que hay:
   - ✅ Producción programada para ese mes
   - ✅ Costos indirectos configurados
3. Clic en **"Calcular Costos"**
4. Ver desglose por producto:
   - Materias primas por ingrediente
   - Cada componente de costo indirecto
   - Total por Kg

#### Exportar:

- Clic en **"Exportar a Excel"** para descargar reporte detallado

> 📝 **Nota sobre el Volumen de Producción**:
> Si para el mes seleccionado **no hay producción programada ni proyecciones guardadas**, el sistema utilizará un **cálculo teórico base** (asumiendo 1 batch de cada producto). 
> - Esto permite ver un costo unitario estimado incluso sin planes de producción.
> - Para ver la **dilución real** de costos indirectos, asegúrese de cargar la producción estimada o las proyecciones del mes.

---

### 📈 Proyecciones ML

**Propósito**: Predecir cantidades de producción futura usando Machine Learning (XGBoost) basado en datos históricos.

> 💡 **Concepto Clave**: El sistema entrena modelos predictivos con su historial de producción real para estimar cuánto producirá de cada producto en meses futuros.

---

#### 📂 Formato de Archivo Excel

El sistema acepta archivos Excel (.xlsx o .xls) con datos históricos de producción.

**Formato Esperado del Archivo**:

| Columna | Tipo | Descripción | Ejemplo |
|---------|------|-------------|---------|
| **Codigo** | Texto | Código del producto | SAL-001 |
| **Fecha** | Fecha | Fecha de producción | 15/01/2024 |
| **Producto** | Texto | Nombre del producto (opcional) | Salchicha Parrillera |
| **Producto Terminado** | Número | Cantidad en Kg | 1,500.50 |

**Formato de Números**: El sistema acepta formato argentino (ej: `1.500,50`) o internacional (ej: `1500.5`)

---

#### 🚀 Flujo de Trabajo Completo

##### **PASO 1: Importar Datos Históricos**

1. Ir a **"📈 Proyecciones ML"** en el menú lateral
2. Verificar la sección **"Estado del Modelo"**:
   - 📊 **Datos Históricos**: Muestra cuántos registros hay en la base de datos
   - 📦 **Productos con Datos**: Cuántos productos tienen historial
3. Preparar su archivo Excel con el formato requerido (ver abajo)
4. Clic en **"Seleccionar Excel"** y elija su archivo
5. Clic en **"Importar"**

**Formato del Archivo Excel:**

| Columna | Tipo | Descripción | Ejemplo |
|---------|------|-------------|---------|
| **Codigo** | Texto | Código del producto | SAL-001 |
| **Fecha** | Fecha | Fecha de producción | 15/01/2024 |
| **Producto** | Texto | Nombre del producto (opcional) | Salchicha Parrillera |
| **Producto Terminado** | Número | Cantidad en Kg | 1,500.50 |

> 💡 **Nota**: El sistema acepta formato argentino (ej: `1.500,50`) o internacional (ej: `1500.5`)

**¿Qué hace este proceso?**
- Lee el archivo Excel que usted seleccionó
- Importa los datos a la base de datos interna
- Crea productos nuevos automáticamente si no existen
- Actualiza registros existentes si la fecha ya está cargada
- Muestra mensaje de confirmación con estadísticas

**Salida Esperada**:
```
✅ Importación exitosa: 
   - X productos creados
   - Y registros importados
   - Z registros actualizados
```

##### **PASO 2: Entrenar el Modelo ML**

1. Una vez importados los datos, clic en **"🚀 Entrenar Modelo"**
2. El sistema ejecutará el entrenamiento con algoritmo XGBoost
3. Esto puede tomar entre 30 segundos y 2 minutos dependiendo del volumen de datos

**¿Qué hace el entrenamiento?**
- Analiza patrones históricos de producción por producto
- Crea modelos predictivos individuales para productos con suficientes datos (≥ 6 meses)
- Genera un modelo global para productos con pocos datos
- Aplica técnicas avanzadas:
  - ✅ Pruebas de estacionariedad (ADF/KPSS)
  - ✅ Diferenciación si es necesario
  - ✅ Features con lags (lookback periods)
- Guarda los modelos en `backend/models/`

**Salida Esperada**:
```
✅ Modelo entrenado: X productos con modelo propio
```

**Estado del Modelo Actualizado**:
- ✅ Modelo: **Entrenado**
- 🧠 **Modelos Individuales**: Cantidad de productos con modelo propio
- 🕒 **Último Entrenamiento**: Fecha y hora
- 📅 **Rango de Datos**: Periodo cubierto (ej: 2024-01 → 2024-12)

##### **PASO 3: Configurar Mes Base para Costos**

> ⚠️ **IMPORTANTE**: Las predicciones solo generan **cantidades en Kg**. Para calcular costos, debe configurar un mes base.

1. En la sección **"⚙️ Configuración de Costos"**
2. Seleccionar **"Mes Base (Costos Indirectos)"**
3. Elegir un mes que tenga costos indirectos configurados (ej: Febrero 2025)

**¿Para qué sirve?**
- Toma los costos indirectos de ese mes como base
- Aplica inflación desde ese mes hasta el mes de predicción
- Permite calcular costo total por Kg proyectado

##### **PASO 4: Generar Predicciones**

1. En la sección **"Generar Predicciones"**:
   - Seleccionar **Mes**: Mes que desea predecir (ej: Abril)
   - Seleccionar **Año**: Año (ej: 2025)
2. Clic en **"🔮 Generar Predicciones"**

**El sistema calculará**:
- 📊 **Cantidad Proyectada** (Kg) para cada producto
- 💰 **Costo de MP/Kg** (con inflación aplicada)
- 💼 **Costo Indirectos/Kg** (distribuidos)
- 🎯 **Costo Total/Kg** (MP + Indirectos)
- 📈 **Nivel de Confianza** (0-100%)

**Resultados Esperados**:

**Resumen del Mes**:
```
📦 Total Producción:    X,XXX kg
💰 Costo Total Mes:     $X,XXX,XXX
📊 Costo Promedio/Kg:   $X,XXX
📈 Inflación Acumulada: +X.X%
```

**Tabla de Productos**:
- Lista de todos los productos con predicción disponible
- Kg proyectados, costos desglosados, confianza del modelo

##### **PASO 5: Guardar en Producción Programada** (Opcional)

1. Revisar las predicciones generadas
2. Clic en **"💾 Guardar en Producción"**
3. El sistema creará automáticamente registros en **Producción Programada**
4. Ahora puede ir a ese módulo y ver/ajustar las cantidades

> 💡 **Flexibilidad**: Puede editar manualmente las cantidades en Producción Programada después de guardar.

---

#### 🔄 Mantenimiento de Datos Históricos

##### **Actualizar con Nuevos Datos**

**Cuándo**: Al final de cada mes, cuando tenga los datos reales de producción

**Cómo**:
1. Abrir su archivo Excel de históricos con Excel
2. Agregar nuevas filas con los datos del mes:
   ```
   Codigo    Fecha        Producto              Producto Terminado
   SAL-001   15/03/2025   Salchicha Parrillera  1.523,70
   CER-002   15/03/2025   Cervelat              890,20
   ...
   ```
3. Guardar el archivo
4. En la aplicación, ir a **Proyecciones ML**
5. Clic en **"Seleccionar Excel"** y elegir el archivo actualizado
6. Clic en **"Importar"**
7. Clic en **"🚀 Entrenar Modelo"** para actualizar predicciones

**Frecuencia Recomendada**: Mensual (cada vez que cierre un mes de producción)

##### **¿Qué pasa si no actualizo?**
- ⚠️ Las predicciones se vuelven menos precisas con el tiempo
- ⚠️ El modelo no aprende de datos recientes
- ⚠️ Cambios en tendencias de producción no se reflejan

##### **Backup del Archivo**
Se recomienda mantener copias de seguridad de su archivo Excel de históricos.

---

#### 📊 Interpretación de Resultados

##### **Nivel de Confianza**

| Confianza | Color | Significado |
|-----------|-------|-------------|
| **80-100%** | 🟢 Verde | Alta confianza - Datos históricos abundantes y estables |
| **50-79%** | 🟡 Amarillo | Confianza media - Datos limitados o con variabilidad |
| **0-49%** | 🔴 Rojo | Baja confianza - Pocos datos o alta variabilidad |

##### **Método de Predicción**

El sistema usa diferentes métodos según disponibilidad de datos:

| Método | Descripción |
|--------|-------------|
| **individual** | Modelo propio del producto (≥ 6 meses de datos) |
| **global** | Modelo basado en todos los productos (< 6 meses) |
| **promedio** | Media histórica simple (fallback si ML falla) |

---

#### ⚠️ Errores Comunes y Soluciones

| Error | Causa | Solución |
|-------|-------|----------|
| "No se envió ningún archivo" | No seleccionó archivo | Haga clic en "Seleccionar Excel" primero |
| "El archivo debe ser un Excel" | Formato incorrecto | Use archivos .xlsx o .xls |
| "Columnas requeridas no encontradas" | Formato Excel incorrecto | Verifique que tiene columnas: Codigo, Fecha, Producto Terminado |
| "Modelo no entrenado" | No se entrenó el modelo después de importar | Haga clic en "🚀 Entrenar Modelo" |
| "No hay predicciones disponibles" | Productos sin suficientes datos | Verifique que los productos tienen ≥ 3 meses de historial |
| "Costo $0" | Producto sin fórmula definida | Vaya a Formulación y defina ingredientes |
| "Seleccione mes base" | No configuró mes base de costos | Configure mes base en la sección de configuración |

---

#### 💡 Consejos y Mejores Prácticas

1. **Re-entrene mensualmente**: Cada vez que agregue datos nuevos, re-entrene el modelo
2. **Verifique la calidad de datos**: Asegúrese de que las fechas y cantidades estén correctas en el Excel
3. **No elimine datos antiguos**: Más historial = mejores predicciones
4. **Use nombres consistentes**: Los códigos de productos deben coincidir entre el Excel y el sistema
5. **Revise antes de guardar**: Las predicciones son estimaciones - ajuste si es necesario
6. **Configure inflación**: Para proyecciones futuras, configure tasas de inflación estimadas

---

#### 🔗 Integración con Otros Módulos

**Flujo Completo de Planificación con ML**:

```
1. Proyecciones ML
   └─ Generar predicciones para próximo mes
   └─ Guardar en Producción Programada

2. Producción Programada
   └─ Revisar/ajustar cantidades
   └─ Ver costos completos calculados

3. Planificación (Hoja de Costos)
   └─ Generar reporte oficial
   └─ Exportar a Excel

4. Escenarios
   └─ Simular "qué pasaría si..." con las proyecciones
```

---

#### 📝 Notas Técnicas

**Modelo ML Utilizado**: XGBoost (Extreme Gradient Boosting)
- Algoritmo de aprendizaje supervisado
- Especializado en series temporales
- Maneja automáticamente estacionalidad y tendencias

**Features Utilizadas** (Características de entrada al modelo):
- ✅ Mes del año (1-12)
- ✅ Año
- ✅ Lags (valores históricos de meses anteriores)
- ✅ Features temporales (trimestre, semestre)

**Almacenamiento de Modelos**:
- Ubicación: `backend/models/`
- Archivos:
  - `production_model.pkl` (modelo entrenado)
  - `production_model.meta.json` (metadatos)

**Dependencias Python** (ya instaladas):
```
xgboost>=2.0.0
pandas>=2.0.0
numpy>=1.24.0
statsmodels>=0.14.0  # Para pruebas de estacionariedad
```

> ⚠️ **Importante**: Las proyecciones **NO se guardan automáticamente** en Producción Programada. 
> - Debe hacer clic en "💾 Guardar en Producción" para que el sistema las considere en cálculos de costos. 
> - Si solo genera la proyección visualmente pero no la guarda, los costos seguirán calculándose sobre la producción programada existente.

### 🎯 Escenarios (What-If Analysis)

**Propósito**: Analizar el impacto de cambios hipotéticos en los costos.

#### Tipos de Escenarios:

| Tipo | Descripción | Ejemplo |
|------|-------------|---------|
| Inflación | Simular diferente tasa | ¿Qué pasa si inflación sube a 10%? |
| Precios MP | Cambiar precio de materia prima | ¿Si la carne sube 20%? |
| Categoría | Ajustar toda una categoría | ¿Si las especias bajan 5%? |
| Costos Indirectos | Modificar SP, GIF o DEP | ¿Si sueldos aumentan 15%? |
| Volumen | Cambiar cantidad producida | ¿Si producimos 50% más? |

#### Crear Escenario:

1. Clic en **"+ Nuevo Escenario"**
2. Nombrar el escenario (ej: "Aumento inflación Q2")
3. Seleccionar tipo de cambio
4. Ingresar parámetros
5. Clic en **"Calcular"**

#### Comparar:

- Ver tabla comparativa: Escenario vs Base
- Diferencias absolutas y porcentuales
- Identificar productos más afectados

---

## 📖 Glosario de Términos

Esta sección define los términos técnicos y abreviaciones utilizados en el sistema:

| Término | Significado | Descripción |
|---------|-------------|-------------|
| **Batch** | Lote de producción | Cantidad de producto producida en un ciclo de producción (ej: 50 kg) |
| **MP** | Materia Prima | Ingredientes y materiales utilizados en la producción |
| **SP** | Sueldos y Aportes Patronales | Costos de mano de obra directa e indirecta |
| **GIF** | Gastos Indirectos de Fabricación | Servicios, mantenimiento, insumos generales |
| **DEP** | Depreciación | Amortización del costo de maquinaria y equipos |
| **Ind/Kg** | Indirectos por Kilogramo | Suma de SP + GIF + DEP distribuidos por kg |
| **min_mo_kg** | Minutos MO por Kilogramo | Tiempo de mano de obra necesario para producir 1 kg |
| **Mes Base** | Mes de Referencia | Mes con costos "congelados" para comparación |
| **Mes de Producción** | Mes Proyectado | Mes donde se planifica la producción real |
| **Inflación Acumulada** | Factor de Ajuste | Inflación compuesta desde mes base hasta mes de producción |
| **Costo por Kg** | Costo Unitario | Precio total dividido entre kilogramos producidos |

### Componentes de Costo

| Componente | Fórmula | Qué Incluye |
|------------|---------|-------------|
| **MP/Kg** | Σ(cantidad × precio) ÷ kg batch | Carnes, especias, envases, aditivos |
| **SP/Kg** | SP total × (min producto / min totales) ÷ kg | Sueldos planta, aportes patronales |
| **GIF/Kg** | GIF total × (kg producto / kg totales) | Electricidad, gas, mantenimiento |
| **DEP/Kg** | DEP total × (kg producto / kg totales) | Desgaste de maquinaria |
| **TOTAL/Kg** | (MP + SP + GIF + DEP) × (1 + inflación) | Costo completo inflado |

---

## Preguntas Frecuentes

### ¿Por qué los costos en Producción Programada muestran $0?

**Causa**: No hay "Hoja de Costos" calculada para el mes base seleccionado.

**Solución**:
1. Ir a **Planificación**
2. Seleccionar el mes que quiere usar como base
3. Clic en **"Calcular Costos"**
4. Volver a **Producción Programada**
5. Seleccionar ese mes como "Mes Base" en configuración (⚙️)

### ¿Cómo funciona la inflación?

La inflación se aplica acumulativamente a **todos los componentes de costo**:

- ✅ **Materias Primas (MP)**: Los costos de ingredientes se ajustan por inflación
- ✅ **Costos Indirectos (SP, GIF, DEP)**: Sueldos, gastos de fabricación y depreciación se ajustan por inflación

**Cálculo de inflación acumulada**:

```
Mes Base: Enero
Inflación mensual: 4%
Producción: Marzo

Inflación acumulada = (1.04)² - 1 = 8.16%
```

**Aplicación**:

Los costos del mes base se multiplican por (1 + inflación acumulada).

```
Ejemplo:
- MP base: $1,000/kg
- Inflación acumulada: 8.16%
- MP ajustado: $1,000 × 1.0816 = $1,081.60/kg
```

> 💡 **Nota**: El sistema aplica la inflación automáticamente cuando se selecciona un mes de producción diferente al mes base en "Producción Programada".

### ¿Cómo se distribuyen los costos indirectos?

| Costo | Fórmula |
|-------|---------|
| SP (por producto) | (Minutos producto / Minutos totales mes) × SP total |
| GIF (por producto) | (Kg producto / Kg totales mes) × GIF total |
| DEP (por producto) | (Kg producto / Kg totales mes) × DEP total |

### ¿Qué significa cada componente de costo?

- **MP/Kg**: Costo de materias primas por kilogramo
- **SP/Kg**: Sueldos y aportes distribuidos por kilogramo
- **GIF/Kg**: Gastos indirectos de fabricación por kilogramo
- **DEP/Kg**: Depreciación de maquinaria por kilogramo
- **Ind/Kg**: SP + GIF + DEP (total indirectos)
- **TOTAL/Kg**: MP + Ind (con inflación aplicada)

---

## Solución de Problemas

### El sistema no carga / páginas en blanco

1. Verificar que el backend está corriendo:
   ```bash
   cd backend
   python app.py
   ```
2. Verificar que hay datos:
   ```bash
   python seed_data.py
   ```
3. Verificar frontend:
   ```bash
   npm run dev
   ```

### Los precios no se actualizan

- Los precios de MP se toman al momento de calcular "Hoja de Costos"
- Para actualizar, recalcular la Hoja de Costos

### Error al importar Excel

Verificar formato del archivo:
- Primera fila: encabezados
- Columnas requeridas: Nombre, Categoría, Unidad, Precio
- Sin filas vacías intermedias

### Las proyecciones ML no funcionan

- Se requiere historial de al menos 3 meses de datos
- Verificar que hay producción registrada

### Error: Puerto ya en uso (Port already in use)

Si ve el error `EADDRINUSE` o "Address already in use":

```bash
# Para el puerto 5000 (Backend)
lsof -i :5000
# Identificar el PID (número en segunda columna) y ejecutar:
kill -9 [PID]

# Para el puerto 5173 (Frontend)
lsof -i :5173
kill -9 [PID]

# Alternativamente, puede cambiar el puerto en package.json (frontend)
# o usar otra configuración para Flask (backend)
```

### Error: Módulo no encontrado (ModuleNotFoundError)

Si ve `ModuleNotFoundError` al ejecutar el backend:

**1. Verificar que el entorno virtual está activado:**
```bash
which python
# Debe mostrar: /ruta/proyecto/.venv/bin/python
# Si muestra /usr/bin/python, el entorno NO está activado
```

**2. Activar el entorno virtual:**
```bash
source .venv/bin/activate
```

**3. Reinstalar dependencias:**
```bash
pip install -r backend/requirements.txt
pip install -r backend/requirements-ml.txt
```

### Error al crear entorno virtual

Si falla `python3 -m venv .venv`:

```bash
# Instalar python3-venv
sudo apt install python3-venv

# Intentar nuevamente
python3 -m venv .venv
```

### Error de permisos en WSL

Si ve errores de permisos al instalar paquetes:

```bash
# NO usar sudo con pip dentro del entorno virtual
# En su lugar, asegúrese de que .venv está activado:
source .venv/bin/activate

# Luego instale sin sudo:
pip install -r backend/requirements.txt
```

### Error de conexión Frontend-Backend

Si el frontend no puede conectarse al backend:

**1. Verificar que el backend está corriendo:**
```bash
# Debería ver: "Running on http://127.0.0.1:5000"
```

**2. Verificar CORS en el navegador:**
- Abrir DevTools (F12) → Pestaña Console
- Si ve errores CORS, verificar que el backend tiene CORS habilitado

**3. Verificar la URL del API:**
- El frontend está configurado para `http://localhost:5000`
- Si cambió el puerto del backend, actualizar `src/api.js`

### Los logs del sistema

El sistema guarda automáticamente logs de todas las operaciones:

**Ubicación:**
```bash
backend/logs/app.log
```

**Ver logs en tiempo real:**
```bash
tail -f backend/logs/app.log
```

**Buscar errores específicos:**
```bash
grep ERROR backend/logs/app.log
grep "producto.created" backend/logs/app.log
```

**Los logs son útiles para:**
- ✅ Debugging de operaciones fallidas
- ✅ Auditoría de cambios en productos/precios
- ✅ Rastreo de entrenamiento ML
- ✅ Identificación de problemas de performance

---

## Contacto y Soporte

Para reportar problemas o sugerencias, crear un issue en el repositorio del proyecto.

---

**© 2024 Sistema de Costeo de Embutidos** | Versión 1.5.0

