"""
Tests unitarios para las mejoras de series de tiempo en predictor.py
"""
import pytest
import numpy as np
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestStationarity:
    """Tests para el módulo de estacionariedad"""
    
    def test_adf_stationary_series(self):
        """Prueba ADF con serie estacionaria (ruido blanco)"""
        from stationarity import adf_test
        
        np.random.seed(42)
        stationary_series = np.random.randn(100)
        
        result = adf_test(stationary_series)
        
        assert result['pvalue'] is not None
        assert result['is_stationary'] == True  # Ruido blanco es estacionario
    
    def test_adf_nonstationary_series(self):
        """Prueba ADF con serie no estacionaria (random walk)"""
        from stationarity import adf_test
        
        np.random.seed(42)
        random_walk = np.cumsum(np.random.randn(100))
        
        result = adf_test(random_walk)
        
        assert result['pvalue'] is not None
        assert result['is_stationary'] == False  # Random walk no es estacionario
    
    def test_kpss_stationary_series(self):
        """Prueba KPSS con serie estacionaria"""
        from stationarity import kpss_test
        
        np.random.seed(42)
        stationary_series = np.random.randn(100)
        
        result = kpss_test(stationary_series)
        
        assert result['pvalue'] is not None
        assert result['is_stationary'] == True
    
    def test_check_stationarity_combined(self):
        """Prueba combinada ADF + KPSS"""
        from stationarity import check_stationarity
        
        np.random.seed(42)
        stationary_series = np.random.randn(100)
        
        result = check_stationarity(stationary_series)
        
        assert 'adf' in result
        assert 'kpss' in result
        assert 'conclusion' in result
        assert result['conclusion'] in ['stationary', 'trend_stationary', 'difference_stationary', 'non_stationary', 'inconclusive']
    
    def test_short_series_handling(self):
        """Verifica manejo de series muy cortas"""
        from stationarity import adf_test
        
        short_series = np.array([1, 2, 3])  # Muy corta
        
        result = adf_test(short_series)
        
        assert 'error' in result
        assert result['is_stationary'] is None


class TestPredictorFeatures:
    """Tests para las features del predictor"""
    
    def test_create_features_basic(self):
        """Verifica creación de features básicas"""
        import pandas as pd
        from predictor import ProductionPredictor
        
        predictor = ProductionPredictor()
        df = pd.DataFrame([
            {'año': 2024, 'mes': 1},
            {'año': 2024, 'mes': 6},
            {'año': 2024, 'mes': 12}
        ])
        
        features = predictor._create_features(df, include_lags=False)
        
        assert 'mes' in features.columns
        assert 'año' in features.columns
        assert 'trimestre' in features.columns
        assert 'mes_sin' in features.columns
        assert 'mes_cos' in features.columns
        assert len(features) == 3
    
    def test_create_features_with_lags(self):
        """Verifica creación de features con lags"""
        import pandas as pd
        from predictor import ProductionPredictor
        
        predictor = ProductionPredictor()
        df = pd.DataFrame({
            'año': [2024] * 15,
            'mes': list(range(1, 16)) if 16 <= 12 else list(range(1, 13)) + list(range(1, 4)),
            'cantidad_kg': [100 + i * 10 for i in range(15)]
        })
        # Fix months to be valid
        df['mes'] = [((i-1) % 12) + 1 for i in range(1, 16)]
        df['año'] = [2024 if i <= 12 else 2025 for i in range(1, 16)]
        
        features = predictor._create_features(df, include_lags=True, target_col='cantidad_kg')
        
        assert 'lag_1' in features.columns
        assert 'lag_2' in features.columns
        assert 'lag_3' in features.columns
        assert 'lag_12' in features.columns
        assert 'rolling_mean_3' in features.columns
        assert 'momentum' in features.columns
    
    def test_lags_nan_handling(self):
        """Verifica que los primeros valores tienen NaN por lags"""
        import pandas as pd
        from predictor import ProductionPredictor
        
        predictor = ProductionPredictor()
        df = pd.DataFrame({
            'año': [2024] * 5,
            'mes': [1, 2, 3, 4, 5],
            'cantidad_kg': [100, 110, 120, 130, 140]
        })
        
        features = predictor._create_features(df, include_lags=True, target_col='cantidad_kg')
        
        # lag_1 debe tener NaN en la primera fila
        assert np.isnan(features['lag_1'].iloc[0])
        # lag_1 no debe ser NaN después de la primera fila
        assert not np.isnan(features['lag_1'].iloc[1])


class TestPredictorTrain:
    """Tests para el entrenamiento del predictor"""
    
    def test_train_minimum_data(self):
        """Verifica entrenamiento con datos mínimos"""
        from predictor import ProductionPredictor
        
        predictor = ProductionPredictor()
        
        # Datos insuficientes
        result = predictor.train([{'producto_id': 1, 'año': 2024, 'mes': 1, 'cantidad_kg': 100}])
        
        assert result['success'] == False
        assert 'insuficientes' in result.get('error', '').lower()
    
    def test_train_with_stationarity(self):
        """Verifica que el entrenamiento incluye análisis de estacionariedad"""
        from predictor import ProductionPredictor
        
        predictor = ProductionPredictor()
        
        # Generar datos suficientes (>12 meses)
        data = []
        for year in [2023, 2024]:
            for month in range(1, 13):
                data.append({
                    'producto_id': 1,
                    'año': year,
                    'mes': month,
                    'cantidad_kg': 1000 + np.random.randn() * 100
                })
        
        result = predictor.train(data)
        
        assert result['success'] == True
        assert 'stationarity_check' in result
        if result['stationarity_check']:
            assert 'conclusion' in result['stationarity_check']
    
    def test_metadata_includes_version(self):
        """Verifica que metadata incluye versión de features"""
        from predictor import ProductionPredictor
        
        predictor = ProductionPredictor()
        
        data = []
        for month in range(1, 13):
            data.append({
                'producto_id': 1,
                'año': 2024,
                'mes': month,
                'cantidad_kg': 1000
            })
        
        predictor.train(data)
        
        assert predictor.metadata.get('features_version') == 'v2.0_with_lags'


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
