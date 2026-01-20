"""
Módulo de pruebas de estacionariedad para series de tiempo.
Implementa pruebas ADF (Augmented Dickey-Fuller) y KPSS.
"""
import logging
import numpy as np

logger = logging.getLogger(__name__)

# Lazy import para evitar fallas si statsmodels no está instalado
adfuller = None
kpss = None


def _ensure_statsmodels():
    """Importa statsmodels solo cuando se necesita"""
    global adfuller, kpss
    if adfuller is None:
        try:
            from statsmodels.tsa.stattools import adfuller as _adf, kpss as _kpss
            adfuller = _adf
            kpss = _kpss
        except ImportError:
            logger.warning("statsmodels no instalado. Pruebas de estacionariedad no disponibles.")
            raise ImportError("statsmodels no está instalado. Ejecute: pip install statsmodels")


def adf_test(series, significance=0.05):
    """
    Ejecuta la prueba Augmented Dickey-Fuller.
    
    H0 (hipótesis nula): La serie tiene una raíz unitaria (no estacionaria)
    H1 (hipótesis alternativa): La serie es estacionaria
    
    Args:
        series: Array o Series con los valores de la serie temporal
        significance: Nivel de significancia (default 0.05)
    
    Returns:
        dict con:
            - statistic: Valor del estadístico ADF
            - pvalue: p-valor del test
            - is_stationary: True si p < significance (rechazamos H0)
            - critical_values: Valores críticos al 1%, 5%, 10%
    """
    _ensure_statsmodels()
    
    series_clean = np.array(series).flatten()
    series_clean = series_clean[~np.isnan(series_clean)]
    
    if len(series_clean) < 10:
        return {
            'statistic': None,
            'pvalue': None,
            'is_stationary': None,
            'critical_values': {},
            'error': 'Serie muy corta para prueba ADF (mínimo 10 observaciones)'
        }
    
    try:
        result = adfuller(series_clean, autolag='AIC')
        return {
            'statistic': float(result[0]),
            'pvalue': float(result[1]),
            'is_stationary': bool(result[1] < significance),
            'critical_values': {k: float(v) for k, v in result[4].items()},
            'n_lags_used': int(result[2]),
            'n_obs': int(result[3])
        }
    except Exception as e:
        logger.error("adf_test.failed error=%s", str(e))
        return {
            'statistic': None,
            'pvalue': None,
            'is_stationary': None,
            'error': str(e)
        }


def kpss_test(series, regression='c', significance=0.05):
    """
    Ejecuta la prueba KPSS (Kwiatkowski-Phillips-Schmidt-Shin).
    
    H0 (hipótesis nula): La serie es estacionaria
    H1 (hipótesis alternativa): La serie tiene raíz unitaria (no estacionaria)
    
    NOTA: KPSS es complementaria a ADF. ADF tiene H0=no estacionaria,
    mientras KPSS tiene H0=estacionaria. Usar ambas da mayor certeza.
    
    Args:
        series: Array o Series con los valores de la serie temporal
        regression: 'c' para nivel constante, 'ct' para constante + tendencia
        significance: Nivel de significancia (default 0.05)
    
    Returns:
        dict con:
            - statistic: Valor del estadístico KPSS
            - pvalue: p-valor del test
            - is_stationary: True si p > significance (no rechazamos H0)
            - critical_values: Valores críticos
    """
    _ensure_statsmodels()
    
    series_clean = np.array(series).flatten()
    series_clean = series_clean[~np.isnan(series_clean)]
    
    if len(series_clean) < 10:
        return {
            'statistic': None,
            'pvalue': None,
            'is_stationary': None,
            'critical_values': {},
            'error': 'Serie muy corta para prueba KPSS (mínimo 10 observaciones)'
        }
    
    try:
        # El parámetro nlags='auto' calcula automáticamente el número óptimo de lags
        result = kpss(series_clean, regression=regression, nlags='auto')
        return {
            'statistic': float(result[0]),
            'pvalue': float(result[1]),
            'is_stationary': bool(result[1] > significance),  # KPSS: p alto = estacionaria
            'critical_values': {k: float(v) for k, v in result[3].items()},
            'n_lags_used': int(result[2])
        }
    except Exception as e:
        logger.error("kpss_test.failed error=%s", str(e))
        return {
            'statistic': None,
            'pvalue': None,
            'is_stationary': None,
            'error': str(e)
        }


def check_stationarity(series, significance=0.05):
    """
    Ejecuta pruebas ADF y KPSS para determinar estacionariedad.
    
    Interpretación combinada:
    - ADF: stationary=True + KPSS: stationary=True -> Serie estacionaria (confianza alta)
    - ADF: stationary=True + KPSS: stationary=False -> Serie estacionaria con tendencia
    - ADF: stationary=False + KPSS: stationary=True -> Posible estacionariedad con raíz unitaria
    - ADF: stationary=False + KPSS: stationary=False -> Serie no estacionaria (confianza alta)
    
    Args:
        series: Array o Series con los valores de la serie temporal
        significance: Nivel de significancia (default 0.05)
    
    Returns:
        dict con resultados de ambas pruebas y conclusión final
    """
    adf_result = adf_test(series, significance)
    kpss_result = kpss_test(series, significance=significance)
    
    # Determinar conclusión combinada
    adf_stationary = adf_result.get('is_stationary')
    kpss_stationary = kpss_result.get('is_stationary')
    
    if adf_stationary is None or kpss_stationary is None:
        conclusion = 'inconclusive'
        confidence = 'low'
        recommendation = 'Datos insuficientes para pruebas de estacionariedad'
    elif adf_stationary and kpss_stationary:
        conclusion = 'stationary'
        confidence = 'high'
        recommendation = 'No se requiere diferenciación'
    elif adf_stationary and not kpss_stationary:
        conclusion = 'trend_stationary'
        confidence = 'medium'
        recommendation = 'Considerar detrending o diferenciación'
    elif not adf_stationary and kpss_stationary:
        conclusion = 'difference_stationary'
        confidence = 'medium'
        recommendation = 'Aplicar diferenciación de primer orden'
    else:
        conclusion = 'non_stationary'
        confidence = 'high'
        recommendation = 'Aplicar diferenciación obligatoria'
    
    return {
        'adf': adf_result,
        'kpss': kpss_result,
        'conclusion': conclusion,
        'confidence': confidence,
        'recommendation': recommendation,
        'needs_differencing': bool(conclusion in ['non_stationary', 'difference_stationary', 'trend_stationary'])
    }


def suggest_differencing(series, max_diffs=2):
    """
    Sugiere el orden de diferenciación necesario para hacer la serie estacionaria.
    
    Args:
        series: Array o Series con los valores de la serie temporal
        max_diffs: Máximo número de diferenciaciones a probar
    
    Returns:
        dict con:
            - diff_order: Orden de diferenciación recomendado (0, 1, o 2)
            - tests_by_order: Resultados de pruebas para cada orden
    """
    series_clean = np.array(series).flatten()
    series_clean = series_clean[~np.isnan(series_clean)]
    
    tests_by_order = {}
    
    current_series = series_clean.copy()
    for d in range(max_diffs + 1):
        if d > 0:
            current_series = np.diff(current_series)
        
        if len(current_series) < 10:
            tests_by_order[d] = {'error': 'Serie muy corta después de diferenciación'}
            break
        
        result = check_stationarity(current_series)
        tests_by_order[d] = result
        
        if result['conclusion'] == 'stationary':
            return {
                'diff_order': d,
                'tests_by_order': tests_by_order,
                'recommendation': f'Usar diferenciación de orden {d}'
            }
    
    return {
        'diff_order': 1,  # Default a primera diferencia
        'tests_by_order': tests_by_order,
        'recommendation': 'Serie difícil de estabilizar. Usando diferenciación de orden 1 por defecto.'
    }
