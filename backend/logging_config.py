import logging
import os
from logging.handlers import RotatingFileHandler


def configure_logging(app=None):
    """Configura logging para la app.

    - Consola + archivo rotativo (por defecto: backend/logs/app.log)
    - Nivel configurable por env: COSTOS_LOG_LEVEL (default INFO)
    """

    log_level_name = os.environ.get('COSTOS_LOG_LEVEL', 'INFO').upper()
    level = getattr(logging, log_level_name, logging.INFO)

    log_file = os.environ.get('COSTOS_LOG_FILE')
    if not log_file:
        # default: <backend>/logs/app.log
        base_dir = os.path.abspath(os.path.dirname(__file__))
        log_dir = os.path.join(base_dir, 'logs')
        os.makedirs(log_dir, exist_ok=True)
        log_file = os.path.join(log_dir, 'app.log')

    logger = logging.getLogger()
    logger.setLevel(level)

    # Evitar duplicar handlers si el módulo se importa más de una vez
    if getattr(logger, '_costos_configured', False):
        return

    formatter = logging.Formatter(
        fmt='%(asctime)s %(levelname)s %(name)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
    )

    stream_handler = logging.StreamHandler()
    stream_handler.setLevel(level)
    stream_handler.setFormatter(formatter)

    file_handler = RotatingFileHandler(
        log_file,
        maxBytes=int(os.environ.get('COSTOS_LOG_MAX_BYTES', '5242880')),  # 5MB
        backupCount=int(os.environ.get('COSTOS_LOG_BACKUP_COUNT', '5')),
        encoding='utf-8',
    )
    file_handler.setLevel(level)
    file_handler.setFormatter(formatter)

    logger.addHandler(stream_handler)
    logger.addHandler(file_handler)

    # Flask/Werkzeug suelen tener su propio logger: unificamos nivel
    if app is not None:
        app.logger.setLevel(level)

    logging.getLogger('werkzeug').setLevel(level)
    logger._costos_configured = True
