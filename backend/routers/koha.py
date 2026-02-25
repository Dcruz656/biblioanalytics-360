from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
from sqlalchemy import text
from database import engine
from services.koha_service import procesar_csv

router = APIRouter(prefix="/api/v1/koha", tags=["koha"])


class ConfirmarRequest(BaseModel):
    """
    El frontend retiene los registros limpios después del upload.
    Al confirmar, los envía aquí. Sin estado en servidor.
    """
    registros: List[Dict[str, Any]]


@router.post("/upload")
async def upload_koha(file: UploadFile = File(...)):
    """
    Recibe el CSV de Koha, lo limpia y devuelve:
    - reporte de calidad
    - preview (primeros 20 registros)
    - registros_limpios (TODOS los válidos, para que el frontend los retenga)

    El servidor NO guarda nada en memoria. El frontend decide si confirmar.
    """
    if not file.filename.endswith((".csv", ".CSV")):
        raise HTTPException(status_code=400, detail="Solo se aceptan archivos CSV")

    contenido = await file.read()
    resultado = procesar_csv(contenido)

    return {
        "archivo": file.filename,
        "reporte": resultado["reporte"],
        "preview": resultado["preview"],
        "registros_limpios": resultado["registros_limpios"],  # frontend los retiene
    }


@router.post("/confirmar")
def confirmar_ingesta(request: ConfirmarRequest):
    """
    Inserta los registros enviados por el frontend en Neon DB.
    Sin dependencia de estado previo en el servidor.
    """
    registros = request.registros
    if not registros:
        raise HTTPException(status_code=400, detail="No hay registros para insertar")

    insertados = 0
    errores = 0

    with engine.connect() as conn:
        for r in registros:
            try:
                conn.execute(text("""
                    INSERT INTO koha_prestamos (anio, mes, biblioteca, carrera, titulo, total_transacciones)
                    VALUES (:anio, :mes, :biblioteca, :carrera, :titulo, :total_transacciones)
                """), {
                    "anio": r.get("anio"),
                    "mes": r.get("mes"),
                    "biblioteca": r.get("biblioteca"),
                    "carrera": r.get("carrera"),
                    "titulo": r.get("titulo"),
                    "total_transacciones": r.get("total_transacciones"),
                })
                insertados += 1
            except Exception:
                errores += 1
        conn.commit()

    return {
        "status": "ok",
        "registros_insertados": insertados,
        "errores": errores,
        "mensaje": f"{insertados} registros insertados correctamente.",
    }


@router.get("/stats")
def stats_koha():
    """
    Estadísticas agregadas de préstamos desde Neon DB.
    """
    with engine.connect() as conn:
        total_registros = conn.execute(
            text("SELECT COUNT(*) FROM koha_prestamos")
        ).scalar()

        total_transacciones = conn.execute(
            text("SELECT COALESCE(SUM(total_transacciones), 0) FROM koha_prestamos")
        ).scalar()

        por_biblioteca = conn.execute(text("""
            SELECT biblioteca, SUM(total_transacciones) as total
            FROM koha_prestamos
            WHERE biblioteca IS NOT NULL
            GROUP BY biblioteca
            ORDER BY total DESC
        """)).fetchall()

        por_anio = conn.execute(text("""
            SELECT anio, SUM(total_transacciones) as total
            FROM koha_prestamos
            WHERE anio IS NOT NULL
            GROUP BY anio
            ORDER BY anio
        """)).fetchall()

        por_mes = conn.execute(text("""
            SELECT mes, SUM(total_transacciones) as total
            FROM koha_prestamos
            WHERE mes IS NOT NULL
            GROUP BY mes
            ORDER BY mes
        """)).fetchall()

        top_titulos = conn.execute(text("""
            SELECT titulo, SUM(total_transacciones) as total
            FROM koha_prestamos
            WHERE titulo IS NOT NULL
            GROUP BY titulo
            ORDER BY total DESC
            LIMIT 10
        """)).fetchall()

        top_carreras = conn.execute(text("""
            SELECT carrera, SUM(total_transacciones) as total
            FROM koha_prestamos
            WHERE carrera IS NOT NULL
            GROUP BY carrera
            ORDER BY total DESC
            LIMIT 10
        """)).fetchall()

    meses_nombre = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun",
                    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

    return {
        "total_registros": total_registros,
        "total_transacciones": int(total_transacciones),
        "por_biblioteca": {r.biblioteca: int(r.total) for r in por_biblioteca},
        "por_anio": {str(r.anio): int(r.total) for r in por_anio},
        "por_mes": {meses_nombre[r.mes]: int(r.total) for r in por_mes if 1 <= r.mes <= 12},
        "top_titulos": [{"titulo": r.titulo, "total": int(r.total)} for r in top_titulos],
        "top_carreras": [{"carrera": r.carrera, "total": int(r.total)} for r in top_carreras],
    }
