"""
Módulo de predicción de producción usando XGBoost.
Analiza datos históricos y genera sugerencias de producción.

Mejoras para series de tiempo (v2.0):
- Pruebas de estacionariedad (ADF, KPSS)
- Features de lags (lag_1, lag_2, lag_3, lag_12)
- Rolling statistics (media y desv. est. móvil)
- Detección automática de no-estacionariedad
"""
import os
import pickle
import logging
import json
from datetime import datetime, date
import numpy as np

logger = logging.getLogger(__name__)

# Estas librerías se importan solo cuando se necesitan
# para evitar errores si no están instaladas
xgboost = None
pd = None

# Lazy import de módulo de estacionariedad
_stationarity_module = None


def _get_stationarity_module():
    """Importa el módulo de estacionariedad solo cuando se necesita"""
    global _stationarity_module
    if _stationarity_module is None:
        try:
            from stationarity import check_stationarity, suggest_differencing
            _stationarity_module = {
                'check_stationarity': check_stationarity,
                'suggest_differencing': suggest_differencing
            }
        except ImportError as e:
            logger.warning("stationarity module not available: %s", str(e))
            _stationarity_module = {}
    return _stationarity_module




def _ensure_imports():
    """Importa las librerías de ML solo cuando se necesitan"""
    global xgboost, pd
    if xgboost is None:
        import xgboost as xgb
        xgboost = xgb
    if pd is None:
        import pandas
        pd = pandas


class ProductionPredictor:
    """
    Predictor de producción basado en XGBoost.
    Entrena un modelo por producto o un modelo global con features de producto.
    """
    
    MODEL_PATH = os.path.join(os.path.dirname(__file__), 'models', 'production_model.pkl')
    META_PATH = os.path.join(os.path.dirname(__file__), 'models', 'production_model.meta.json')
    
    def __init__(self, *, load_models=False):
        self.models = {}  # producto_id -> modelo entrenado
        self.global_model = None
        self.product_encodings = {}  # producto_id -> código numérico
        self.is_trained = False
        self.metadata = {}
        self._models_loaded = False

        # Por performance, evitamos des-picklear modelos en endpoints como /api/ml/status.
        # Se cargan bajo demanda al predecir o entrenar.
        if load_models:
            self._load_model()
        else:
            self._load_metadata()

    def _load_metadata(self):
        """Carga metadata liviana (sin des-picklear modelos)."""
        try:
            if not os.path.exists(self.META_PATH):
                return
            with open(self.META_PATH, 'r', encoding='utf-8') as f:
                meta = json.load(f) or {}
            self.is_trained = bool(meta.get('is_trained', False))
            self.metadata = meta.get('metadata', {}) or {}
        except Exception as e:
            logger.warning("predictor.meta_load_failed path=%s error=%s", self.META_PATH, str(e))

    def _ensure_models_loaded(self):
        """Carga el pickle del modelo solo cuando es necesario (predict/train)."""
        if self._models_loaded:
            return
        self._load_model()
    
    def _load_model(self):
        """Carga modelo guardado si existe"""
        if os.path.exists(self.MODEL_PATH):
            try:
                with open(self.MODEL_PATH, 'rb') as f:
                    data = pickle.load(f)
                    self.models = data.get('models', {})
                    self.global_model = data.get('global_model')
                    self.product_encodings = data.get('product_encodings', {})
                    self.is_trained = data.get('is_trained', False)
                    self.metadata = data.get('metadata', {})
                self._models_loaded = True
                logger.info("predictor.model_loaded path=%s models=%s", self.MODEL_PATH, len(self.models))
            except Exception as e:
                logger.error("predictor.model_load_failed path=%s error=%s", self.MODEL_PATH, str(e))
                self._models_loaded = False
    
    def _save_model(self):
        """Guarda el modelo entrenado"""
        os.makedirs(os.path.dirname(self.MODEL_PATH), exist_ok=True)
        with open(self.MODEL_PATH, 'wb') as f:
            pickle.dump({
                'models': self.models,
                'global_model': self.global_model,
                'product_encodings': self.product_encodings,
                'is_trained': self.is_trained,
                'metadata': self.metadata
            }, f)
        logger.info("predictor.model_saved path=%s models=%s", self.MODEL_PATH, len(self.models))
        self._save_metadata_only()

    def _save_metadata_only(self):
        """Guarda metadata liviana para que /api/ml/status no requiera des-picklear el modelo."""
        try:
            meta_payload = {
                'is_trained': self.is_trained,
                'productos_con_modelo': len(self.models),
                'tiene_modelo_global': self.global_model is not None,
                'metadata': self.metadata or {}
            }
            with open(self.META_PATH, 'w', encoding='utf-8') as f:
                json.dump(meta_payload, f, ensure_ascii=False)
            logger.info("predictor.meta_saved path=%s", self.META_PATH)
        except Exception as e:
            logger.warning("predictor.meta_save_failed path=%s error=%s", self.META_PATH, str(e))

    def _time_split_last_n(self, df, n_last=2):
        """Split temporal (train/val) tomando las últimas n observaciones como validación."""
        _ensure_imports()
        if df is None or len(df) <= n_last:
            return df, None
        df_sorted = df.sort_values(['año', 'mes']).reset_index(drop=True)
        df_train = df_sorted.iloc[:-n_last].copy()
        df_val = df_sorted.iloc[-n_last:].copy()
        return df_train, df_val

    @staticmethod
    def _rmse(y_true, y_pred):
        y_true = np.asarray(y_true, dtype=float)
        y_pred = np.asarray(y_pred, dtype=float)
        return float(np.sqrt(np.mean((y_true - y_pred) ** 2)))

    @staticmethod
    def _mape(y_true, y_pred, eps=1e-9):
        y_true = np.asarray(y_true, dtype=float)
        y_pred = np.asarray(y_pred, dtype=float)
        denom = np.maximum(np.abs(y_true), eps)
        return float(np.mean(np.abs((y_true - y_pred) / denom)) * 100.0)
    
    def _create_features(self, df, include_lags=False, target_col='cantidad_kg'):
        """
        Crea features para el modelo a partir de las fechas.
        
        Features base:
        - mes: 1-12
        - año: normalizado
        - trimestre: 1-4
        - es_fin_año: diciembre
        - es_verano: dic, ene, feb
        - mes_sin: componente seno del mes (ciclicidad)
        - mes_cos: componente coseno del mes (ciclicidad)
        
        Features con lags (si include_lags=True):
        - lag_1, lag_2, lag_3: valores de meses anteriores
        - lag_12: valor del mismo mes año anterior (estacionalidad)
        - rolling_mean_3: media móvil de 3 meses
        - rolling_std_3: desv. estándar móvil de 3 meses
        - diff_1: primera diferencia
        
        Args:
            df: DataFrame con columnas 'mes', 'año' y opcionalmente target_col
            include_lags: Si True, incluye features de lags (requiere df ordenado cronológicamente)
            target_col: Columna objetivo para calcular lags
        
        Returns:
            DataFrame con features
        """
        _ensure_imports()
        
        features = pd.DataFrame(index=df.index)
        features['mes'] = df['mes'].values
        features['año'] = df['año'].values
        features['trimestre'] = ((df['mes'] - 1) // 3) + 1
        features['es_diciembre'] = (df['mes'] == 12).astype(int)
        features['es_verano'] = df['mes'].isin([12, 1, 2]).astype(int)
        features['es_invierno'] = df['mes'].isin([6, 7, 8]).astype(int)
        # Codificación cíclica del mes
        features['mes_sin'] = np.sin(2 * np.pi * df['mes'] / 12)
        features['mes_cos'] = np.cos(2 * np.pi * df['mes'] / 12)
        
        # Features de lags para series de tiempo
        if include_lags and target_col in df.columns:
            # IMPORTANTE: df debe estar ordenado cronológicamente
            target = df[target_col].values
            
            # Lags de corto plazo
            features['lag_1'] = pd.Series(target).shift(1).values
            features['lag_2'] = pd.Series(target).shift(2).values
            features['lag_3'] = pd.Series(target).shift(3).values
            
            # Lag estacional (mismo mes año anterior)
            features['lag_12'] = pd.Series(target).shift(12).values
            
            # Rolling statistics
            series = pd.Series(target)
            features['rolling_mean_3'] = series.rolling(window=3, min_periods=1).mean().values
            features['rolling_std_3'] = series.rolling(window=3, min_periods=1).std().fillna(0).values
            
            # Primera diferencia
            features['diff_1'] = series.diff(1).fillna(0).values
            
            # Ratio respecto al lag_1 (momentum)
            features['momentum'] = np.where(
                features['lag_1'] > 0,
                target / features['lag_1'],
                1.0
            )
        
        return features
    
    def _check_series_stationarity(self, series):
        """
        Verifica estacionariedad de una serie usando ADF y KPSS.
        
        Args:
            series: Array o Series con valores de la serie temporal
        
        Returns:
            dict con resultados de las pruebas o None si no disponible
        """
        stationarity = _get_stationarity_module()
        if not stationarity:
            return None
        
        try:
            check_fn = stationarity.get('check_stationarity')
            if check_fn:
                return check_fn(series)
        except Exception as e:
            logger.warning("stationarity_check.failed error=%s", str(e))
        
        return None

    def _fit_xgb_regressor(self, model, X_train, y_train, X_val=None, y_val=None):
        """Entrena un XGBRegressor con early-stopping de forma compatible entre versiones."""
        _ensure_imports()

        if X_val is None or y_val is None or len(X_val) == 0:
            model.fit(X_train, y_train)
            return

        # XGBoost 3.x removió early_stopping_rounds del wrapper sklearn.
        # Intentamos primero el API clásico y si falla, usamos callbacks.
        try:
            model.fit(
                X_train,
                y_train,
                eval_set=[(X_val, y_val)],
                verbose=False,
                early_stopping_rounds=30
            )
            return
        except TypeError:
            pass

        try:
            early_stop = xgboost.callback.EarlyStopping(rounds=30, save_best=True)
            model.fit(
                X_train,
                y_train,
                eval_set=[(X_val, y_val)],
                verbose=False,
                callbacks=[early_stop]
            )
        except Exception:
            # Fallback: entrenar sin early stopping
            model.fit(X_train, y_train)
    
    def train(self, historico_data, *, cutoff_ym=None):
        """
        Entrena el modelo con datos históricos.
        
        Args:
            historico_data: Lista de dicts con keys: producto_id, año, mes, cantidad_kg
            cutoff_ym: str opcional con formato YYYY-MM. Si se provee, entrena solo con
                registros <= cutoff (útil para backtesting y para evitar entrenar con
                "futuro" respecto de un horizonte de predicción).
        
        Returns:
            dict con métricas del entrenamiento
        """
        _ensure_imports()

        # Entrenar siempre desde cero (evita depender de modelos previos)
        self.models = {}
        self.global_model = None
        self.product_encodings = {}
        self._models_loaded = True
        
        if not historico_data or len(historico_data) < 3:
            return {'success': False, 'error': 'Datos insuficientes (mínimo 3 registros)'}
        
        df = pd.DataFrame(historico_data)

        # Cutoff temporal opcional (evita mezclar futuro en escenarios de backtesting)
        if cutoff_ym:
            try:
                cutoff_period = pd.Period(str(cutoff_ym), freq='M')
                df['_period'] = pd.PeriodIndex(pd.to_datetime(df['año'].astype(str) + '-' + df['mes'].astype(str).str.zfill(2) + '-01'), freq='M')
                df = df[df['_period'] <= cutoff_period].drop(columns=['_period'])
            except Exception:
                # Si el cutoff viene malformado, no bloquear entrenamiento
                logger.warning("predictor.train.invalid_cutoff cutoff_ym=%s", str(cutoff_ym))
        
        # Agrupar por producto y mes/año (sumar si hay múltiples registros del mismo mes)
        df_grouped = df.groupby(['producto_id', 'año', 'mes']).agg({
            'cantidad_kg': 'sum'
        }).reset_index()
        
        # === PRUEBA DE ESTACIONARIEDAD ===
        # Ejecutar sobre serie agregada para diagnosticar comportamiento general
        stationarity_result = None
        try:
            # Agregar todo para obtener serie temporal agregada
            df_agg_monthly = df_grouped.groupby(['año', 'mes'])['cantidad_kg'].sum().reset_index()
            df_agg_monthly = df_agg_monthly.sort_values(['año', 'mes'])
            if len(df_agg_monthly) >= 12:
                stationarity_result = self._check_series_stationarity(df_agg_monthly['cantidad_kg'].values)
                if stationarity_result:
                    logger.info(
                        "predictor.stationarity_check conclusion=%s confidence=%s recommendation=%s",
                        stationarity_result.get('conclusion', 'unknown'),
                        stationarity_result.get('confidence', 'unknown'),
                        stationarity_result.get('recommendation', '')
                    )
        except Exception as e:
            logger.warning("predictor.stationarity_check.failed error=%s", str(e))
        
        # Entrenar modelo por producto si hay suficientes datos
        productos = df_grouped['producto_id'].unique()
        metrics = {
            'productos_entrenados': 0,
            'productos_sin_datos': 0,
            'stationarity_check': stationarity_result,
            'validacion': {
                'productos_con_validacion': 0,
                'rmse_promedio': None,
                'mape_promedio': None
            }
        }

        rmse_list = []
        mape_list = []
        
        for producto_id in productos:
            df_prod = df_grouped[df_grouped['producto_id'] == producto_id].copy()
            
            if len(df_prod) >= 6:  # Mínimo 6 meses para entrenar
                # IMPORTANTE: Ordenar cronológicamente para lags correctos
                df_prod = df_prod.sort_values(['año', 'mes']).reset_index(drop=True)
                
                # Validación temporal: si hay suficiente historia, separa últimos 2 meses
                df_train, df_val = (df_prod, None)
                if len(df_prod) >= 12:
                    df_train, df_val = self._time_split_last_n(df_prod, n_last=2)

                # Crear features CON lags si hay suficiente historia
                use_lags = len(df_train) >= 13  # Necesita al menos 13 para lag_12 + 1 fila válida
                X_train = self._create_features(df_train, include_lags=use_lags, target_col='cantidad_kg')
                y_train = df_train['cantidad_kg'].values
                
                # Filtrar filas con NaN por lags (primeras 12 filas con lag_12)
                if use_lags:
                    valid_mask = ~X_train.isna().any(axis=1)
                    X_train = X_train[valid_mask]
                    y_train = y_train[valid_mask]

                model = xgboost.XGBRegressor(
                    n_estimators=500,
                    max_depth=3,
                    learning_rate=0.05,
                    subsample=0.9,
                    colsample_bytree=0.9,
                    objective='reg:squarederror',
                    random_state=42,
                    n_jobs=1
                )

                if df_val is not None and len(df_val) > 0:
                    # Para validación, usamos la serie completa hasta val para tener lags correctos
                    df_for_val = pd.concat([df_train, df_val], ignore_index=True)
                    X_all = self._create_features(df_for_val, include_lags=use_lags, target_col='cantidad_kg')
                    X_val = X_all.iloc[-len(df_val):]
                    y_val = df_val['cantidad_kg'].values
                    
                    # Filtrar NaN en validación
                    if use_lags:
                        valid_val_mask = ~X_val.isna().any(axis=1)
                        X_val = X_val[valid_val_mask]
                        y_val = np.array(y_val)[valid_val_mask.values]
                    
                    if len(X_val) > 0 and len(X_train) > 0:
                        self._fit_xgb_regressor(model, X_train, y_train, X_val=X_val, y_val=y_val)
                        y_pred = model.predict(X_val)
                        rmse = self._rmse(y_val, y_pred)
                        mape = self._mape(y_val, y_pred)
                        rmse_list.append(rmse)
                        mape_list.append(mape)
                        metrics['validacion']['productos_con_validacion'] += 1
                    else:
                        self._fit_xgb_regressor(model, X_train, y_train)
                else:
                    if len(X_train) > 0:
                        self._fit_xgb_regressor(model, X_train, y_train)

                self.models[producto_id] = model
                metrics['productos_entrenados'] += 1
            else:
                metrics['productos_sin_datos'] += 1
        
        # Entrenar modelo global para productos sin suficientes datos
        if len(df_grouped) >= 12:
            # Codificar producto_id
            for i, pid in enumerate(productos):
                self.product_encodings[pid] = i
            
            df_global = df_grouped.copy()
            df_global['producto_encoded'] = df_global['producto_id'].map(self.product_encodings)
            
            # Split temporal global por las últimas 2 observaciones (ordenadas por año/mes)
            df_global_sorted = df_global.sort_values(['año', 'mes']).reset_index(drop=True)
            df_g_train, df_g_val = (df_global_sorted, None)
            if len(df_global_sorted) >= 24:
                df_g_train, df_g_val = self._time_split_last_n(df_global_sorted, n_last=2)

            X_g_train = self._create_features(df_g_train)
            X_g_train['producto_encoded'] = df_g_train['producto_encoded']
            y_g_train = df_g_train['cantidad_kg'].values

            self.global_model = xgboost.XGBRegressor(
                n_estimators=700,
                max_depth=4,
                learning_rate=0.05,
                subsample=0.9,
                colsample_bytree=0.9,
                objective='reg:squarederror',
                random_state=42,
                n_jobs=1
            )

            if df_g_val is not None and len(df_g_val) > 0:
                X_g_val = self._create_features(df_g_val)
                X_g_val['producto_encoded'] = df_g_val['producto_encoded']
                y_g_val = df_g_val['cantidad_kg'].values
                self._fit_xgb_regressor(self.global_model, X_g_train, y_g_train, X_val=X_g_val, y_val=y_g_val)
                y_g_pred = self.global_model.predict(X_g_val)
                metrics['validacion']['rmse_global'] = self._rmse(y_g_val, y_g_pred)
                metrics['validacion']['mape_global'] = self._mape(y_g_val, y_g_pred)
            else:
                self._fit_xgb_regressor(self.global_model, X_g_train, y_g_train)
            metrics['modelo_global'] = True
        else:
            metrics['modelo_global'] = False
        
        # Agregar métricas agregadas si hubo validación por producto
        if rmse_list:
            metrics['validacion']['rmse_promedio'] = float(np.mean(rmse_list))
        if mape_list:
            metrics['validacion']['mape_promedio'] = float(np.mean(mape_list))

        # Metadata del entrenamiento
        try:
            df_grouped_sorted = df_grouped.sort_values(['año', 'mes'])
            start_ym = f"{int(df_grouped_sorted.iloc[0]['año'])}-{int(df_grouped_sorted.iloc[0]['mes']):02d}" if len(df_grouped_sorted) else None
            end_ym = f"{int(df_grouped_sorted.iloc[-1]['año'])}-{int(df_grouped_sorted.iloc[-1]['mes']):02d}" if len(df_grouped_sorted) else None
        except Exception:
            start_ym, end_ym = None, None

        # Guardar historial reciente por producto para uso en predicción con lags
        product_histories = {}
        for producto_id in productos:
            df_prod = df_grouped[df_grouped['producto_id'] == producto_id].copy()
            df_prod = df_prod.sort_values(['año', 'mes']).reset_index(drop=True)
            # Guardar últimos 15 meses para tener suficiente para lag_12 + buffer
            recent = df_prod.tail(15)[['año', 'mes', 'cantidad_kg']].to_dict('records')
            product_histories[str(producto_id)] = recent

        self.metadata = {
            'trained_at': datetime.utcnow().isoformat() + 'Z',
            'cutoff_ym': cutoff_ym,
            'data_range': {'start_ym': start_ym, 'end_ym': end_ym},
            'n_registros': int(len(df_grouped)),
            'stationarity': {
                'conclusion': stationarity_result.get('conclusion') if stationarity_result else None,
                'confidence': stationarity_result.get('confidence') if stationarity_result else None,
                'recommendation': stationarity_result.get('recommendation') if stationarity_result else None,
                'adf_pvalue': stationarity_result.get('adf', {}).get('pvalue') if stationarity_result else None,
                'kpss_pvalue': stationarity_result.get('kpss', {}).get('pvalue') if stationarity_result else None
            },
            'features_version': 'v2.0_with_lags',
            'product_histories': product_histories
        }



        self.is_trained = True
        self._save_model()
        
        metrics['success'] = True
        return metrics
    
    def predict(self, producto_id, año, mes, producto_similar_id=None):
        """
        Predice la producción para un producto en un mes específico.
        
        Args:
            producto_id: ID del producto
            año: Año a predecir
            mes: Mes a predecir (1-12)
            producto_similar_id: Para productos nuevos, usar este como referencia
        
        Returns:
            dict con predicción y confianza
        """
        _ensure_imports()

        # Cargar modelos si aún no están en memoria
        self._ensure_models_loaded()
        
        if not self.is_trained:
            return {
                'cantidad_kg': None,
                'confianza': 0,
                'metodo': 'sin_modelo',
                'mensaje': 'Modelo no entrenado. Ejecute el entrenamiento primero.'
            }
        
        # Crear features para la predicción
        # NOTA: Para predicción con lags, necesitamos el historial del producto.
        # Si no tenemos historial almacenado, usamos features básicas sin lags.
        df_pred = pd.DataFrame([{'año': año, 'mes': mes}])
        
        # Intentar obtener historial para lags
        product_history = self.metadata.get('product_histories', {}).get(str(producto_id))
        
        if product_history and len(product_history) >= 3:
            # Reconstruir DataFrame con historial + nueva predicción
            hist_df = pd.DataFrame(product_history)
            hist_df = hist_df.sort_values(['año', 'mes']).reset_index(drop=True)
            
            # Agregar fila de predicción sin valor conocido
            pred_row = pd.DataFrame([{'año': año, 'mes': mes, 'cantidad_kg': np.nan}])
            df_with_hist = pd.concat([hist_df, pred_row], ignore_index=True)
            
            # Crear features con lags
            X_all = self._create_features(df_with_hist, include_lags=True, target_col='cantidad_kg')
            X = X_all.iloc[[-1]]  # Solo la última fila (predicción)
            
            # Los lags ya tienen valores de historial; reemplazar NaN en momentum por 1
            X = X.fillna({'momentum': 1.0, 'diff_1': 0.0})
            
            # Si aún hay NaN (por ejemplo lag_12 sin historial suficiente), usar features sin lags
            if X.isna().any().any():
                X = self._create_features(df_pred, include_lags=False)
        else:
            # Sin historial: usar features sin lags (fallback al modelo global)
            X = self._create_features(df_pred, include_lags=False)
        
        # Método 1: Modelo específico del producto
        if producto_id in self.models:
            try:
                prediccion = self.models[producto_id].predict(X)[0]
                return {
                    'cantidad_kg': float(max(0, round(float(prediccion), 2))),
                    'confianza': 0.85,
                    'metodo': 'modelo_producto',
                    'mensaje': f'Predicción basada en historial del producto'
                }
            except ValueError as e:
                # Fallback si hay mismatch de features
                logger.warning("predict.feature_mismatch producto_id=%s error=%s", producto_id, str(e))
                X = self._create_features(df_pred, include_lags=False)
        
        # Método 2: Producto similar como referencia
        if producto_similar_id and producto_similar_id in self.models:
            prediccion = self.models[producto_similar_id].predict(X)[0]
            return {
                'cantidad_kg': float(max(0, round(float(prediccion), 2))),
                'confianza': 0.60,
                'metodo': 'producto_similar',
                'mensaje': f'Basado en producto similar (id={producto_similar_id})'
            }
        
        # Método 3: Modelo global
        if self.global_model is not None and producto_id in self.product_encodings:
            X['producto_encoded'] = self.product_encodings[producto_id]
            prediccion = self.global_model.predict(X)[0]
            return {
                'cantidad_kg': float(max(0, round(float(prediccion), 2))),
                'confianza': 0.70,
                'metodo': 'modelo_global',
                'mensaje': 'Predicción basada en modelo global'
            }
        
        # Método 4: Promedio global si nada más funciona
        return {
            'cantidad_kg': None,
            'confianza': 0,
            'metodo': 'sin_datos',
            'mensaje': 'Sin datos históricos para este producto. Use entrada manual.'
        }
    
    def predict_month(self, productos_ids, año, mes):
        """
        Predice producción para múltiples productos en un mes.
        
        Returns:
            Lista de predicciones
        """
        resultados = []
        # Cargar modelos una sola vez
        self._ensure_models_loaded()
        for pid in productos_ids:
            pred = self.predict(pid, año, mes)
            pred['producto_id'] = pid
            resultados.append(pred)
        return resultados
    
    def get_training_status(self):
        """Retorna el estado del entrenamiento"""
        # Si no se cargaron modelos, responder desde metadata liviana
        if not self._models_loaded and os.path.exists(self.META_PATH):
            try:
                with open(self.META_PATH, 'r', encoding='utf-8') as f:
                    meta = json.load(f) or {}
                return {
                    'is_trained': bool(meta.get('is_trained', False)),
                    'productos_con_modelo': int(meta.get('productos_con_modelo', 0) or 0),
                    'tiene_modelo_global': bool(meta.get('tiene_modelo_global', False)),
                    'model_path': self.MODEL_PATH if os.path.exists(self.MODEL_PATH) else None,
                    'metadata': meta.get('metadata', {}) or {}
                }
            except Exception:
                pass

        # Compatibilidad hacia atrás: si hay modelo pickle pero no hay meta JSON,
        # cargar una sola vez para reconstruir metadata y luego persistirla.
        if not self._models_loaded and os.path.exists(self.MODEL_PATH):
            self._load_model()
            if self._models_loaded and not os.path.exists(self.META_PATH):
                self._save_metadata_only()

        return {
            'is_trained': self.is_trained,
            'productos_con_modelo': len(self.models),
            'tiene_modelo_global': self.global_model is not None,
            'model_path': self.MODEL_PATH if os.path.exists(self.MODEL_PATH) else None,
            'metadata': self.metadata or {}
        }


# Instancia global del predictor (protegida contra errores de carga)
try:
    predictor = ProductionPredictor(load_models=False)
except Exception as e:
    logger.error("predictor.init_failed error=%s", str(e))
    # Crear instancia vacía que no fallará
    predictor = None


def get_predictor():
    """Obtiene el predictor de forma segura, inicializándolo si es necesario"""
    global predictor
    if predictor is None:
        try:
            predictor = ProductionPredictor(load_models=False)
        except Exception as e:
            logger.error("predictor.lazy_init_failed error=%s", str(e))
            return None
    return predictor
