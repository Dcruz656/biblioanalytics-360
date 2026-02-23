from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

def init_db():
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS koha_prestamos (
                id SERIAL PRIMARY KEY,
                anio INTEGER,
                mes INTEGER,
                biblioteca TEXT,
                carrera TEXT,
                titulo TEXT,
                total_transacciones INTEGER,
                fecha_carga TIMESTAMP DEFAULT NOW()
            );
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS uso_computadoras (
                id SERIAL PRIMARY KEY,
                timestamp TEXT,
                biblioteca TEXT,
                id_usuario TEXT,
                tipo_usuario TEXT,
                hora_inicio TEXT,
                hora_fin TEXT,
                proposito TEXT,
                numero_equipo TEXT,
                duracion_minutos REAL,
                fecha_carga TIMESTAMP DEFAULT NOW()
            );
        """))
        conn.commit()
    print("Tablas creadas correctamente")

if __name__ == "__main__":
    init_db()